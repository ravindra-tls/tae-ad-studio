'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Send, X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ProposalData {
  templateText:     string;
  templateName:     string;
  templateCategory: string;
  referenceImageUrl: string | null;
}

const CATEGORIES = [
  'Hero/Product', 'Social Proof', 'UGC', 'Comparison',
  'Educational', 'Native/Editorial', 'Lifestyle', 'Press/Authority', 'Offer/Promotion',
];

export function SubmitAsTemplateButton({ groupId }: { groupId: string }) {
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted]     = useState(false);

  // Form state
  const [name, setName]           = useState('');
  const [category, setCategory]   = useState('');
  const [notes, setNotes]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    setMounted(true);
    try {
      const raw = sessionStorage.getItem(`copy_ad_proposal_${groupId}`);
      if (raw) {
        const data = JSON.parse(raw) as ProposalData;
        setProposal(data);
        setName(data.templateName || '');
        setCategory(data.templateCategory || '');
      }
    } catch { /* non-critical */ }
  }, [groupId]);

  const openModal = () => {
    setShowModal(true);
    setSubmitted(false);
    setError('');
  };

  const closeModal = () => setShowModal(false);

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Please enter a template name.'); return; }
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind:             'template_proposal',
          title:            `Template Proposal: ${name.trim()}`,
          message:          notes.trim() || 'Proposed via Copy-from-Ad workflow.',
          templateName:     name.trim(),
          templateCategory: category.trim() || undefined,
          promptExample:    proposal?.templateText || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Submission failed');
      }

      setSubmitted(true);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={openModal}>
        <Send className="mr-1.5 h-3.5 w-3.5" />
        Propose as Template
      </Button>

      {mounted && showModal && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        >
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-brand-forest/10">
              <h2 className="text-base font-bold text-brand-forest">Propose as Template</h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-brand-slate/60 hover:text-brand-forest hover:bg-brand-cream transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {submitted ? (
              <div className="p-8 flex flex-col items-center text-center gap-4">
                <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
                  <Check className="h-7 w-7 text-green-600" />
                </div>
                <div>
                  <p className="text-base font-semibold text-brand-forest mb-1">Proposal sent!</p>
                  <p className="text-sm text-brand-slate">
                    An admin will review it and may add it to the template library.
                  </p>
                </div>
                <Button className="mt-2" onClick={closeModal}>Done</Button>
              </div>
            ) : (
              <div className="p-5 flex flex-col gap-4">
                <p className="text-xs text-brand-slate">
                  This creative pattern will be sent to admins as a template proposal. They can review and publish it for all users.
                </p>

                <div>
                  <label className="text-xs font-medium text-brand-forest mb-1 block">
                    Template name <span className="text-brand-wine">*</span>
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Plant Lifestyle Hero"
                    className="text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-brand-forest mb-1 block">Category</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat === category ? '' : cat)}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-medium border transition-all',
                          category === cat
                            ? 'bg-brand-forest text-white border-brand-forest'
                            : 'border-brand-forest/20 text-brand-slate hover:border-brand-forest/40 hover:text-brand-forest',
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-brand-forest mb-1 block">
                    Notes for admin (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any context about this creative pattern…"
                    rows={3}
                    className="w-full text-xs rounded-lg border border-brand-forest/20 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-forest/30"
                  />
                </div>

                {proposal?.templateText && (
                  <details className="text-xs">
                    <summary className="text-brand-slate cursor-pointer hover:text-brand-forest">
                      View extracted template prompt
                    </summary>
                    <pre className="mt-2 p-3 bg-brand-cream/50 rounded-lg text-[11px] text-brand-slate whitespace-pre-wrap overflow-auto max-h-40 font-mono">
                      {proposal.templateText}
                    </pre>
                  </details>
                )}

                {error && (
                  <p className="text-xs text-brand-wine">{error}</p>
                )}

                <Button
                  className="w-full"
                  disabled={submitting || !name.trim()}
                  onClick={handleSubmit}
                >
                  {submitting ? (
                    <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Sending…</>
                  ) : (
                    <><Send className="mr-1.5 h-3.5 w-3.5" /> Submit Proposal</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
