'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquarePlus, Lightbulb, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/Breadcrumb';
import { formatDate } from '@/lib/utils';
import type { FeedbackSubmission } from '@/types';

interface FeedbackWorkspaceProps {
  submissions: FeedbackSubmission[];
}

const TEMPLATE_CATEGORIES = [
  'Hero/Product',
  'Social Proof',
  'UGC',
  'Comparison',
  'Educational',
  'Native/Editorial',
  'Lifestyle',
  'Press/Authority',
  'Offer/Promotion',
];

export function FeedbackWorkspace({ submissions }: FeedbackWorkspaceProps) {
  const router = useRouter();
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateMessage, setTemplateMessage] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState(TEMPLATE_CATEGORIES[0]);
  const [promptExample, setPromptExample] = useState('');
  const [submittingKind, setSubmittingKind] = useState<'feedback' | 'template_proposal' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitFeedback = async (kind: 'feedback' | 'template_proposal') => {
    setSubmittingKind(kind);
    setError(null);

    const payload = kind === 'feedback'
      ? {
          kind,
          title: feedbackTitle,
          message: feedbackMessage,
        }
      : {
          kind,
          title: templateTitle,
          message: templateMessage,
          templateName,
          templateCategory,
          promptExample,
        };

    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Submission failed' }));
      setError(data.error || 'Submission failed');
      setSubmittingKind(null);
      return;
    }

    if (kind === 'feedback') {
      setFeedbackTitle('');
      setFeedbackMessage('');
    } else {
      setTemplateTitle('');
      setTemplateMessage('');
      setTemplateName('');
      setTemplateCategory(TEMPLATE_CATEGORIES[0]);
      setPromptExample('');
    }

    setSubmittingKind(null);
    router.refresh();
  };

  return (
    <div className="animate-fade-in">
      <Breadcrumb crumbs={[{ label: 'Feedback & Templates' }]} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-forest">Feedback & Template Ideas</h1>
        <p className="mt-1 text-sm text-brand-slate">
          Share product feedback, workflow issues, or propose new prompt templates for the team to review.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5 text-brand-forest" />
              <CardTitle>General Feedback</CardTitle>
            </div>
            <CardDescription>Tell us what is working, broken, confusing, or slow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-teal">Title</label>
              <Input
                value={feedbackTitle}
                onChange={(e) => setFeedbackTitle(e.target.value)}
                placeholder="Dashboard sessions should be easier to scan"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-teal">Details</label>
              <Textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="Describe the issue or idea in as much detail as helpful..."
                rows={7}
              />
            </div>
            <Button
              onClick={() => submitFeedback('feedback')}
              disabled={submittingKind !== null}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {submittingKind === 'feedback' ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-brand-forest" />
              <CardTitle>Propose New Template</CardTitle>
            </div>
            <CardDescription>Suggest a new ad angle or prompt structure the team should add.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-teal">Proposal Title</label>
              <Input
                value={templateTitle}
                onChange={(e) => setTemplateTitle(e.target.value)}
                placeholder="Before/after comparison with ingredient callouts"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-teal">Template Name</label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Ingredient Spotlight Transformation"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-teal">Category</label>
              <select
                value={templateCategory}
                onChange={(e) => setTemplateCategory(e.target.value)}
                className="flex h-10 w-full rounded-md border border-brand-teal/20 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/50"
              >
                {TEMPLATE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-teal">Why this template matters</label>
              <Textarea
                value={templateMessage}
                onChange={(e) => setTemplateMessage(e.target.value)}
                placeholder="Explain the use case, channel, or campaign need this should solve..."
                rows={4}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-teal">Prompt Example</label>
              <Textarea
                value={promptExample}
                onChange={(e) => setPromptExample(e.target.value)}
                placeholder="Optional: draft the kind of prompt structure you want added..."
                rows={5}
              />
            </div>
            <Button
              onClick={() => submitFeedback('template_proposal')}
              disabled={submittingKind !== null}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {submittingKind === 'template_proposal' ? 'Submitting...' : 'Submit Proposal'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Your Recent Submissions</CardTitle>
          <CardDescription>Track what you have already shared with the team.</CardDescription>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <p className="text-sm text-brand-slate">No submissions yet.</p>
          ) : (
            <div className="space-y-3">
              {submissions.map((submission) => (
                <div key={submission.id} className="rounded-lg border border-brand-teal/10 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-brand-forest">{submission.title}</p>
                    <Badge variant={submission.kind === 'feedback' ? 'outline' : 'secondary'}>
                      {submission.kind === 'feedback' ? 'Feedback' : 'Template Proposal'}
                    </Badge>
                    <Badge
                      variant={
                        submission.status === 'implemented'
                          ? 'success'
                          : submission.status === 'rejected'
                          ? 'destructive'
                          : submission.status === 'reviewed'
                          ? 'warning'
                          : 'outline'
                      }
                    >
                      {submission.status}
                    </Badge>
                    <span className="ml-auto text-xs text-brand-slate">{formatDate(submission.created_at)}</span>
                  </div>
                  {submission.template_name && (
                    <p className="mt-2 text-sm text-brand-slate">
                      <span className="font-medium text-brand-forest">Template:</span> {submission.template_name}
                      {submission.template_category ? ` · ${submission.template_category}` : ''}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-brand-slate whitespace-pre-wrap">{submission.message}</p>
                  {submission.prompt_example && (
                    <div className="mt-3 rounded-md bg-brand-cream/40 p-3">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-brand-slate">Prompt Example</p>
                      <p className="text-sm text-brand-slate whitespace-pre-wrap">{submission.prompt_example}</p>
                    </div>
                  )}
                  {submission.reviewer_note && (
                    <p className="mt-3 text-sm text-brand-forest">
                      <span className="font-medium">Team note:</span> {submission.reviewer_note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
