'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { BrandConfig } from '@/types';

interface BrandConfigFormProps {
  config: BrandConfig;
}

type StrictnessValue = BrandConfig['default_strictness'];

/**
 * Admin editor for the singleton brand config.
 *
 * Strategy: structured inputs for the stable scalar fields (name,
 * default_strictness) and for the string-array field (non_negotiables).
 * voice/visual stay as JSON textareas until their shape solidifies — a rigid
 * form would force premature schema decisions on Ravindra.
 */
export function BrandConfigForm({ config }: BrandConfigFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [name, setName] = useState(config.name);
  const [strictness, setStrictness] = useState<StrictnessValue>(config.default_strictness);
  const [nonNegotiables, setNonNegotiables] = useState<string[]>(
    config.non_negotiables ?? [],
  );
  const [newRule, setNewRule] = useState('');
  const [voiceText, setVoiceText] = useState(
    JSON.stringify(config.voice ?? {}, null, 2),
  );
  const [visualText, setVisualText] = useState(
    JSON.stringify(config.visual ?? {}, null, 2),
  );

  const addRule = () => {
    const t = newRule.trim();
    if (!t) return;
    if (nonNegotiables.includes(t)) {
      setNewRule('');
      return;
    }
    setNonNegotiables([...nonNegotiables, t]);
    setNewRule('');
  };

  const removeRule = (idx: number) => {
    setNonNegotiables(nonNegotiables.filter((_, i) => i !== idx));
  };

  const prettifyVoice = () => tryPrettify(voiceText, setVoiceText, 'voice');
  const prettifyVisual = () => tryPrettify(visualText, setVisualText, 'visual');

  const tryPrettify = (
    text: string,
    setter: (s: string) => void,
    label: string,
  ) => {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setError(`${label} must be a JSON object`);
        return;
      }
      setter(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (err) {
      setError(`${label}: ${(err as Error).message}`);
    }
  };

  const save = () => {
    setError(null);
    setSavedAt(null);

    // Parse + validate JSON textareas client-side before sending.
    let voice: Record<string, unknown>;
    let visual: Record<string, unknown>;
    try {
      voice = JSON.parse(voiceText);
      if (typeof voice !== 'object' || voice === null || Array.isArray(voice)) {
        throw new Error('voice must be a JSON object');
      }
    } catch (err) {
      setError(`voice: ${(err as Error).message}`);
      return;
    }
    try {
      visual = JSON.parse(visualText);
      if (typeof visual !== 'object' || visual === null || Array.isArray(visual)) {
        throw new Error('visual must be a JSON object');
      }
    } catch (err) {
      setError(`visual: ${(err as Error).message}`);
      return;
    }

    startTransition(async () => {
      const res = await fetch('/api/admin/brand-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          default_strictness: strictness,
          non_negotiables: nonNegotiables,
          voice,
          visual,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Save failed');
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Name + strictness */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-slate">
            Brand name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            className="w-full rounded border border-brand-teal/20 px-3 py-2 text-sm focus:border-brand-teal focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-slate">
            Default strictness
          </label>
          <select
            value={strictness}
            onChange={(e) => setStrictness(e.target.value as StrictnessValue)}
            disabled={pending}
            className="w-full rounded border border-brand-teal/20 px-3 py-2 text-sm focus:border-brand-teal focus:outline-none"
          >
            <option value="off">off — brand guardrails disabled</option>
            <option value="loose">loose — encourage, don&apos;t enforce</option>
            <option value="tight">tight — enforce non-negotiables hard</option>
          </select>
          <p className="mt-1 text-xs text-brand-slate/50">
            Applied when a session doesn&apos;t override it.
          </p>
        </div>
      </div>

      {/* Non-negotiables */}
      <div>
        <label className="mb-1 block text-xs font-medium text-brand-slate">
          Non-negotiables (enforced in critique when strictness ≠ off)
        </label>
        <div className="mb-2 flex gap-2">
          <input
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addRule();
              }
            }}
            placeholder='e.g. "Never claim instant results"'
            disabled={pending}
            className="flex-1 rounded border border-brand-teal/20 px-3 py-1.5 text-sm focus:border-brand-teal focus:outline-none"
          />
          <Button size="sm" variant="outline" onClick={addRule} disabled={pending}>
            Add
          </Button>
        </div>
        {nonNegotiables.length === 0 ? (
          <p className="text-xs text-brand-slate/50">No rules yet.</p>
        ) : (
          <ul className="space-y-1">
            {nonNegotiables.map((rule, i) => (
              <li
                key={`${rule}-${i}`}
                className="flex items-center gap-2 rounded border border-brand-teal/10 bg-brand-cream/30 px-3 py-1.5 text-sm"
              >
                <span className="flex-1 text-brand-teal">{rule}</span>
                <button
                  type="button"
                  onClick={() => removeRule(i)}
                  disabled={pending}
                  className="rounded-full p-1 text-brand-slate/60 hover:bg-brand-teal/10 hover:text-brand-teal"
                  aria-label="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Voice JSON */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs font-medium text-brand-slate">
            Voice (JSON object)
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={prettifyVoice}
            disabled={pending}
          >
            Format
          </Button>
        </div>
        <textarea
          value={voiceText}
          onChange={(e) => setVoiceText(e.target.value)}
          disabled={pending}
          spellCheck={false}
          rows={8}
          className="w-full rounded border border-brand-teal/20 px-3 py-2 font-mono text-xs focus:border-brand-teal focus:outline-none"
        />
        <p className="mt-1 text-xs text-brand-slate/50">
          e.g. <code>{"{ \"tone\": [\"warm\", \"expert\"], \"phrases_we_use\": [...] }"}</code>
        </p>
      </div>

      {/* Visual JSON */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs font-medium text-brand-slate">
            Visual system (JSON object)
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={prettifyVisual}
            disabled={pending}
          >
            Format
          </Button>
        </div>
        <textarea
          value={visualText}
          onChange={(e) => setVisualText(e.target.value)}
          disabled={pending}
          spellCheck={false}
          rows={8}
          className="w-full rounded border border-brand-teal/20 px-3 py-2 font-mono text-xs focus:border-brand-teal focus:outline-none"
        />
        <p className="mt-1 text-xs text-brand-slate/50">
          e.g. <code>{"{ \"palette\": {...}, \"layout_rules\": [...], \"typography\": {...} }"}</code>
        </p>
      </div>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      {savedAt && !error && (
        <p className="rounded bg-green-50 px-3 py-2 text-xs text-green-700">
          Saved at {savedAt}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-brand-teal/10 pt-4">
        <p className="text-xs text-brand-slate/40">
          Last updated {new Date(config.updated_at).toLocaleString()}
        </p>
        <Button onClick={save} disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
