/**
 * Document text extraction for the product synthesis flow.
 *
 * Handles:
 *   - application/pdf → handled upstream (Claude native `document` content block,
 *                       NOT parsed here — we pass the base64 straight to the API).
 *   - application/vnd.openxmlformats-officedocument.wordprocessingml.document (.docx)
 *       → mammoth.extractRawText() returns plain text.
 *   - application/vnd.openxmlformats-officedocument.presentationml.presentation (.pptx)
 *       → jszip + XML regex over ppt/slides/slide*.xml + ppt/notesSlides/notesSlide*.xml.
 *         We don't try to preserve layout, just surface visible slide text & speaker notes.
 *   - text/plain, text/markdown → UTF-8 decode of the base64 payload.
 *
 * Legacy .doc / .ppt binary formats are NOT supported — the client-side file
 * input only accepts the above media types, so we reject anything else defensively.
 *
 * Each extraction is capped to keep a single doc from blowing past Claude's
 * context window. 24k chars (~6-8k tokens) is a pragmatic per-doc ceiling; if
 * a user needs more, they should split the document.
 */

import mammoth from 'mammoth';
import JSZip from 'jszip';

/** Per-document character cap after extraction — see file-header rationale. */
const MAX_EXTRACTED_CHARS = 24_000;

/** File size cap per document. Matches Claude's PDF upload cap. */
export const MAX_DOCUMENT_BYTES = 32 * 1024 * 1024; // 32 MB

/** Media types the synthesize pipeline understands. */
export const SUPPORTED_DOC_MEDIA_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
] as const;

export type SupportedDocMediaType = (typeof SUPPORTED_DOC_MEDIA_TYPES)[number];

export function isSupportedDocMediaType(m: string): m is SupportedDocMediaType {
  return (SUPPORTED_DOC_MEDIA_TYPES as readonly string[]).includes(m);
}

/** Shape of a document entry sent from the client (base64, to match images). */
export type DocumentInput = {
  name: string;
  data: string;         // base64 (no data URL prefix)
  mediaType: string;
};

/** Result of extracting text from a non-PDF doc. */
export type ExtractedText = {
  name: string;
  text: string;
  truncated: boolean;
};

function cap(s: string): { text: string; truncated: boolean } {
  if (s.length <= MAX_EXTRACTED_CHARS) return { text: s, truncated: false };
  return { text: s.slice(0, MAX_EXTRACTED_CHARS), truncated: true };
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function extractPptx(buffer: Buffer): Promise<string> {
  // A .pptx is a ZIP containing XML parts. Slide text lives in
  // ppt/slides/slideN.xml inside <a:t> elements; speaker notes in
  // ppt/notesSlides/notesSlideN.xml. We don't need layout fidelity here —
  // just concatenate visible text per slide so the LLM can reason over it.
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)/)?.[1] ?? 0);
      return na - nb;
    });

  const out: string[] = [];
  for (const path of slideFiles) {
    const xml = await zip.files[path].async('string');
    const slideNum = path.match(/slide(\d+)/)?.[1] ?? '?';
    const texts: string[] = [];
    for (const m of xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)) {
      const t = m[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .trim();
      if (t) texts.push(t);
    }

    // Speaker notes for this slide, if present
    const notesPath = `ppt/notesSlides/notesSlide${slideNum}.xml`;
    if (zip.files[notesPath]) {
      const notesXml = await zip.files[notesPath].async('string');
      const notes: string[] = [];
      for (const m of notesXml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)) {
        const t = m[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .trim();
        if (t) notes.push(t);
      }
      if (notes.length > 0) {
        texts.push(`[Speaker notes: ${notes.join(' ')}]`);
      }
    }

    if (texts.length > 0) {
      out.push(`--- Slide ${slideNum} ---\n${texts.join('\n')}`);
    }
  }
  return out.join('\n\n').trim();
}

/**
 * Extract plain text from a non-PDF document. PDFs should be handed to Claude
 * directly as a `document` content block — do not call this for them.
 *
 * Returns `null` + logs a warning if the media type isn't supported or
 * extraction fails, rather than throwing — synthesis should continue with the
 * remaining inputs.
 */
export async function extractDocumentText(
  doc: DocumentInput,
): Promise<ExtractedText | null> {
  try {
    const buffer = Buffer.from(doc.data, 'base64');

    if (buffer.byteLength > MAX_DOCUMENT_BYTES) {
      console.warn(
        `[document-extractor] skipping "${doc.name}": exceeds ${MAX_DOCUMENT_BYTES} bytes`,
      );
      return null;
    }

    let raw: string;
    switch (doc.mediaType) {
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        raw = await extractDocx(buffer);
        break;
      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        raw = await extractPptx(buffer);
        break;
      case 'text/plain':
      case 'text/markdown':
        raw = buffer.toString('utf-8').trim();
        break;
      case 'application/pdf':
        // Shouldn't reach here — the route handles PDFs upstream as native
        // Claude document blocks rather than extracting text server-side.
        console.warn('[document-extractor] PDFs should be routed to Claude natively, not extracted');
        return null;
      default:
        console.warn(`[document-extractor] unsupported media type: ${doc.mediaType}`);
        return null;
    }

    if (!raw) {
      console.warn(`[document-extractor] "${doc.name}" produced empty text`);
      return { name: doc.name, text: '', truncated: false };
    }

    const { text, truncated } = cap(raw);
    return { name: doc.name, text, truncated };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[document-extractor] failed to extract "${doc.name}": ${msg}`);
    return null;
  }
}
