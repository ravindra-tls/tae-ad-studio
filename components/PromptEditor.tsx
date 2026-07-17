'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Copy, Sparkles, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PromptEditorProps {
  initialPrompt: string;
  templateName: string;
  templateNumber: number;
  category: string;
  defaultAspectRatio: string;
  referenceImageCount: number;
  remainingCredits: number;
  onGenerate: (prompt: string, aspectRatio: string) => void;
  isGenerating?: boolean;
}

const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1 (Square)' },
  { value: '4:5', label: '4:5 (Portrait)' },
  { value: '9:16', label: '9:16 (Story)' },
  { value: '16:9', label: '16:9 (Landscape)' },
  { value: '3:4', label: '3:4 (Classic)' },
];

export function PromptEditor({
  initialPrompt,
  templateName,
  templateNumber,
  category,
  defaultAspectRatio,
  referenceImageCount,
  remainingCredits,
  onGenerate,
  isGenerating = false,
}: PromptEditorProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [aspectRatio, setAspectRatio] = useState(defaultAspectRatio);
  const [showRatios, setShowRatios] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [prompt]);

  const handleGenerate = useCallback(() => {
    if (remainingCredits <= 0) return;
    onGenerate(prompt, aspectRatio);
  }, [prompt, aspectRatio, remainingCredits, onGenerate]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-brand-forest">#{templateNumber}.</span>
        <span className="text-lg font-semibold text-brand-forest">{templateName}</span>
        <Badge variant="secondary">{category}</Badge>
      </div>

      {/* Prompt textarea */}
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={10}
        className="font-mono text-sm leading-relaxed"
        placeholder="Enter your prompt..."
      />

      {/* Reference images indicator */}
      {referenceImageCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-brand-slate">
          <span className="font-medium">Reference images:</span>
          <Badge variant="outline">{referenceImageCount} attached</Badge>
        </div>
      )}

      {/* Aspect ratio selector */}
      <div className="relative">
        <label className="mb-1.5 block text-sm font-medium text-brand-forest">Aspect Ratio</label>
        <button
          onClick={() => setShowRatios(!showRatios)}
          className="flex w-full items-center justify-between rounded-md border border-brand-forest/20 bg-white px-3 py-2 text-sm hover:border-brand-forest/40 transition-colors"
        >
          <span>{ASPECT_RATIOS.find((r) => r.value === aspectRatio)?.label || aspectRatio}</span>
          <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', showRatios && 'rotate-180')} />
        </button>
        {showRatios && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-brand-forest/20 bg-white py-1 shadow-lg">
            {ASPECT_RATIOS.map((r) => (
              <button
                key={r.value}
                onClick={() => { setAspectRatio(r.value); setShowRatios(false); }}
                className={cn(
                  'block w-full px-3 py-2 text-left text-sm hover:bg-brand-cream/50',
                  aspectRatio === r.value && 'bg-brand-cream font-medium text-brand-forest'
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="mr-2 h-4 w-4" />
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        <Button
          size="lg"
          onClick={handleGenerate}
          disabled={isGenerating || remainingCredits <= 0 || !prompt.trim()}
          className="flex-1"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {isGenerating ? 'Generating...' : remainingCredits <= 0 ? 'Limit Reached' : 'Generate Image'}
        </Button>
      </div>
    </div>
  );
}
