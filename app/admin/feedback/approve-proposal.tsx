'use client';

/**
 * "Approve as template…" — two-step proposal approval UI over
 * POST /api/admin/proposals/[id]/approve.
 *
 * Open → dry run ({ dryRun: true }) builds a TemplateDraft (nothing written)
 * → the admin edits name/category/aspect/template → Approve commits
 * ({ draft }) which flips the proposal to 'approved' and inserts the
 * workspace-scoped prompt_templates row.
 */
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Sparkles, Check, Loader2, AlertTriangle } from 'lucide-react';

const ASPECT_RATIOS = ['1:1', '4:5', '9:16', '16:9', '3:4'] as const;

interface TemplateDraft {
  name: string;
  category: string;
  default_aspect_ratio: string;
  template: string;
  source: 'direct' | 'ai';
}

interface ApproveProposalProps {
  proposalId: string;
  /** Shown in the modal header for context. */
  proposalTitle: string;
  /** TEMPLATE_CATEGORIES — passed from the server page (the module is server-only). */
  categories: string[];
}

export function ApproveProposal({ proposalId, proposalTitle, categories }: ApproveProposalProps) {
  const router = useRouter();

  const [open,       setOpen]       = useState(false);
  const [loading,    setLoading]    = useState(false); // dry run in flight
  const [submitting, setSubmitting] = useState(false); // commit in flight
  const [error,      setError]      = useState<string | null>(null);

  // Editable draft fields (prefilled from the dry run)
  const [source,   setSource]   = useState<'direct' | 'ai' | null>(null);
  const [name,     setName]     = useState('');
  const [category, setCategory] = useState('');
  const [aspect,   setAspect]   = useState('4:5');
  const [template, setTemplate] = useState('');

  const loadDraft = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSource(null);
    try {
      const res = await fetch(`/api/admin/proposals/${proposalId}/approve`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Draft generation failed');
      const draft = data.draft as TemplateDraft;
      setName(draft.name);
      setCategory(draft.category);
      setAspect(draft.default_aspect_ratio);
      setTemplate(draft.template);
      setSource(draft.source);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  // Dry run on open
  useEffect(() => {
    if (open) loadDraft();
  }, [open, loadDraft]);

  const handleApprove = async () => {
    if (!name.trim() || !template.trim()) {
      setError('Name and template are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/proposals/${proposalId}/approve`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          draft: {
            name:                 name.trim(),
            category,
            default_aspect_ratio: aspect,
            template:             template.trim(),
          },
        }),
      });
      const data = await res.json();
      if (res.status !== 201) throw new Error(data.error || 'Approval failed');
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const hasDraft = source !== null;

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="bg-brand-forest hover:bg-brand-forest/90"
      >
        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        Approve as template…
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          disableClose={loading || submitting}
          maxWidth="max-w-2xl"
          title={
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-brand-lime" />
              Approve as Template
            </span>
          }
          subtitle={`${proposalTitle} — review the draft, then approve to add it to your workspace`}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading || submitting}>
                Cancel
              </Button>
              {!loading && !hasDraft ? (
                <Button size="sm" onClick={loadDraft} className="bg-brand-forest hover:bg-brand-forest/90">
                  Retry draft
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={loading || submitting || !hasDraft}
                  className="bg-brand-forest hover:bg-brand-forest/90"
                >
                  {submitting
                    ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Approving…</>
                    : <><Check className="mr-1.5 h-3.5 w-3.5" />Approve</>
                  }
                </Button>
              )}
            </div>
          }
        >
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-forest/60" />
                  <p className="text-sm text-brand-slate">Building a template draft from the proposal…</p>
                  <p className="text-[10px] text-brand-slate/50">
                    Untokenized proposals are converted by Claude — this can take a few seconds
                  </p>
                </div>
              ) : hasDraft ? (
                <>
                  {source === 'ai' && (
                    <p className="flex items-center gap-1.5 rounded-lg border border-amber-300/60 bg-amber-100 px-3 py-2 text-xs text-amber-700">
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      AI-converted from the proposal — review carefully
                    </p>
                  )}

                  {/* Name + Category row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-brand-slate">Name</label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-brand-slate">Category</label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent className="z-[60]">
                          {categories.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Aspect ratio */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-brand-slate">Default Aspect Ratio</label>
                    <Select value={aspect} onValueChange={setAspect}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Aspect ratio" />
                      </SelectTrigger>
                      <SelectContent className="z-[60]">
                        {ASPECT_RATIOS.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Template body */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-brand-slate">Template Prompt</label>
                    <Textarea
                      value={template}
                      onChange={(e) => setTemplate(e.target.value)}
                      rows={12}
                      className="resize-none rounded-lg border-brand-sage/30 bg-brand-cream/30 font-mono text-xs leading-relaxed text-brand-navy focus-visible:ring-brand-forest/20"
                    />
                  </div>
                </>
              ) : null}

              {error && (
                <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}
            </div>

        </Modal>
      )}
    </>
  );
}
