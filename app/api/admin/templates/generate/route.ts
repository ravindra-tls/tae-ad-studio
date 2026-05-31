/**
 * POST /api/admin/templates/generate
 *
 * Reads the image-to-template SKILL.md at runtime and uses it verbatim
 * as the Claude system prompt — the skill is the single source of truth.
 * Parses the Step 3 structured output (Name / Category / Aspect Ratio /
 * Prompt) and saves it to prompt_templates.
 *
 * Admin-only.
 */
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const CATEGORIES = [
  'Hero/Product', 'Social Proof', 'UGC', 'Comparison',
  'Educational', 'Native/Editorial', 'Lifestyle', 'Press/Authority', 'Offer/Promotion',
] as const;

const ASPECT_RATIOS = ['1:1', '4:5', '9:16', '16:9', '3:4'] as const;

// ─── Load skill at startup ────────────────────────────────────────────────────

function loadSkill(): string {
  const skillPath = path.join(process.cwd(), 'skills', 'image-to-template', 'SKILL.md');
  try {
    const raw = fs.readFileSync(skillPath, 'utf-8');
    // Strip YAML frontmatter (--- ... ---) if present
    const withoutFrontmatter = raw.replace(/^---[\s\S]*?---\n?/, '').trim();
    return withoutFrontmatter;
  } catch {
    // Should never happen — fail loud at startup rather than silently degrade
    throw new Error(`image-to-template skill not found at: ${skillPath}`);
  }
}

// Cache at module level so it's read once per server process
let SKILL_CONTENT: string;
try {
  SKILL_CONTENT = loadSkill();
} catch (e: any) {
  console.error('[generate/route] SKILL load failed:', e.message);
  SKILL_CONTENT = '';
}

// Appended after the skill content — tells Claude to produce ONLY the Step 3 block
const OUTPUT_INSTRUCTION = `

---

IMPORTANT OUTPUT INSTRUCTION:
Produce ONLY the Step 3 output block (starting with "TEMPLATE READY"). Do not add any text before or after it. Do not explain your reasoning. Do not add a preamble. Output the Step 3 format exactly as specified above.`;

// ─── Parse Step 3 output ──────────────────────────────────────────────────────

interface ParsedTemplate {
  name: string;
  category: string;
  aspect_ratio: string;
  template: string;
}

function parseSkillOutput(raw: string): ParsedTemplate | null {
  // Name, Category, Aspect Ratio lines
  const nameMatch     = raw.match(/^Name:\s*(.+)$/m);
  const categoryMatch = raw.match(/^Category:\s*(.+)$/m);
  const aspectMatch   = raw.match(/^Aspect Ratio:\s*(.+)$/m);

  // Prompt block: everything after "Prompt:\n\n" up to the next ─── separator
  const promptMatch = raw.match(/Prompt:\s*\r?\n\r?\n([\s\S]+?)(?=\r?\n[─\-]{5,})/);

  if (!nameMatch || !categoryMatch || !aspectMatch || !promptMatch) return null;

  return {
    name:         nameMatch[1].trim(),
    category:     categoryMatch[1].trim(),
    aspect_ratio: aspectMatch[1].trim(),
    template:     promptMatch[1].trim(),
  };
}

// ─── Admin guard ──────────────────────────────────────────────────────────────

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles').select('role').eq('id', user.id).single();
  return profile?.role === 'admin' ? service : null;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const service = await assertAdmin();
  if (!service) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!SKILL_CONTENT) {
    return NextResponse.json(
      { error: 'image-to-template skill not loaded — check skills/image-to-template/SKILL.md' },
      { status: 500 },
    );
  }

  const body = await request.json() as {
    description?: string;
    imageBase64?: string;
    mimeType?: string;
  };

  const { description, imageBase64, mimeType } = body;

  if (!description && !imageBase64) {
    return NextResponse.json({ error: 'Provide an image or description' }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Build message content
  const content: Anthropic.MessageParam['content'] = [];

  if (imageBase64) {
    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;
    const mediaType = ((mimeType || 'image/jpeg').split(';')[0]) as
      'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64Data },
    });
  }

  content.push({
    type: 'text',
    text: description
      ? `Create a template from this. Additional context: ${description}`
      : 'Create a template from this ad image.',
  });

  let raw: string;
  try {
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2000,
      system:     SKILL_CONTENT + OUTPUT_INSTRUCTION,
      messages:   [{ role: 'user', content }],
    });
    raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
  } catch (err: any) {
    return NextResponse.json({ error: `AI generation failed: ${err.message}` }, { status: 500 });
  }

  // Parse the Step 3 structured output
  const parsed = parseSkillOutput(raw);

  if (!parsed) {
    return NextResponse.json(
      { error: 'Failed to parse skill output — unexpected format', raw },
      { status: 500 },
    );
  }

  if (!parsed.name || !parsed.category || !parsed.aspect_ratio || !parsed.template) {
    return NextResponse.json({ error: 'Incomplete skill output', raw }, { status: 500 });
  }

  // Sanitise against known-good enum values
  if (!(CATEGORIES as readonly string[]).includes(parsed.category)) {
    parsed.category = 'Hero/Product';
  }
  if (!(ASPECT_RATIOS as readonly string[]).includes(parsed.aspect_ratio)) {
    parsed.aspect_ratio = '4:5';
  }

  // Derive next template number (column is NOT NULL, no DB default)
  const { data: maxRow } = await service
    .from('prompt_templates')
    .select('number')
    .order('number', { ascending: false })
    .limit(1)
    .single();
  const nextNumber = ((maxRow?.number as number | null) ?? 0) + 1;

  // Save to DB
  const { data, error } = await service
    .from('prompt_templates')
    .insert({
      number:               nextNumber,
      name:                 parsed.name.trim().slice(0, 120),
      category:             parsed.category,
      template:             parsed.template.trim(),
      default_aspect_ratio: parsed.aspect_ratio,
      version:              1,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
