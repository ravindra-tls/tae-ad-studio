/**
 * Convert a template PROPOSAL (free text + optional prompt example) into a
 * prompt_templates draft. Two paths:
 *   direct — the prompt_example already contains [PLACEHOLDER] tokens; use it
 *            verbatim (trimmed) and only sanitize category/aspect.
 *   ai     — no tokens; run the same image-to-template SKILL used by the admin
 *            generate route, in text mode, to produce a tokenized template.
 *
 * Server-only. The caller (approve route) shows the draft to the admin for
 * editing BEFORE anything is written.
 */
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { extractTokens } from './compat';

export const TEMPLATE_CATEGORIES = [
  'Hero/Product', 'Social Proof', 'UGC', 'Comparison',
  'Educational', 'Native/Editorial', 'Lifestyle', 'Press/Authority', 'Offer/Promotion',
] as const;

const ASPECT_RATIOS = ['1:1', '4:5', '9:16', '16:9', '3:4'] as const;

export interface TemplateDraft {
  name: string;
  category: string;
  default_aspect_ratio: string;
  template: string;
  /** Which path produced it — surfaced in the approval modal. */
  source: 'direct' | 'ai';
}

export function sanitizeCategory(cat: string | null | undefined): string {
  const c = (cat ?? '').trim();
  const hit = TEMPLATE_CATEGORIES.find((k) => k.toLowerCase() === c.toLowerCase());
  return hit ?? 'Hero/Product';
}

export function sanitizeAspect(ar: string | null | undefined): string {
  const a = (ar ?? '').trim();
  return (ASPECT_RATIOS as readonly string[]).includes(a) ? a : '4:5';
}

function loadSkill(): string {
  const skillPath = path.join(process.cwd(), 'skills', 'image-to-template', 'SKILL.md');
  const raw = fs.readFileSync(skillPath, 'utf-8');
  return raw.replace(/^---[\s\S]*?---\n?/, '').trim();
}

const OUTPUT_INSTRUCTION = `

---

IMPORTANT OUTPUT INSTRUCTION:
Produce ONLY the Step 3 output block (starting with "TEMPLATE READY"). Do not add any text before or after it.`;

function parseSkillOutput(raw: string): { name: string; category: string; aspect_ratio: string; template: string } | null {
  const nameMatch     = raw.match(/^Name:\s*(.+)$/m);
  const categoryMatch = raw.match(/^Category:\s*(.+)$/m);
  const aspectMatch   = raw.match(/^Aspect Ratio:\s*(.+)$/m);
  const promptMatch   = raw.match(/Prompt:\s*\r?\n\r?\n([\s\S]+?)(?=\r?\n[─\-]{5,}|$)/);
  if (!nameMatch || !categoryMatch || !aspectMatch || !promptMatch) return null;
  return {
    name: nameMatch[1].trim(),
    category: categoryMatch[1].trim(),
    aspect_ratio: aspectMatch[1].trim(),
    template: promptMatch[1].trim(),
  };
}

export async function buildTemplateDraft(proposal: {
  template_name: string | null;
  template_category: string | null;
  prompt_example: string | null;
  title: string;
  message: string;
}): Promise<TemplateDraft> {
  const example = (proposal.prompt_example ?? '').trim();

  // Direct path: the example is already a tokenized template body.
  if (example && extractTokens(example).length >= 2) {
    return {
      name: (proposal.template_name ?? proposal.title).trim().slice(0, 120),
      category: sanitizeCategory(proposal.template_category),
      default_aspect_ratio: '4:5',
      template: example,
      source: 'direct',
    };
  }

  // AI path: convert the free-text description into a tokenized template.
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: loadSkill() + OUTPUT_INSTRUCTION,
    messages: [{
      role: 'user',
      content:
        `There is no reference image. Build a reusable ad template from this proposal instead:\n\n` +
        `Proposed name: ${proposal.template_name ?? proposal.title}\n` +
        `Proposed category: ${proposal.template_category ?? 'unknown'}\n` +
        `Description: ${proposal.message}\n` +
        (example ? `Draft prompt (not yet tokenized):\n${example}\n` : '') +
        `\nUse [PLACEHOLDER] tokens for every product-specific element.`,
    }],
  });

  const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
  const parsed = parseSkillOutput(raw);
  if (!parsed) throw new Error('AI conversion did not return a parseable template');

  return {
    name: (proposal.template_name ?? parsed.name).trim().slice(0, 120),
    category: sanitizeCategory(parsed.category || proposal.template_category),
    default_aspect_ratio: sanitizeAspect(parsed.aspect_ratio),
    template: parsed.template,
    source: 'ai',
  };
}
