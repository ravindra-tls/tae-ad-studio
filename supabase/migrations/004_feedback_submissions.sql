create table public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('feedback', 'template_proposal')),
  title text not null,
  message text not null,
  template_name text,
  template_category text,
  prompt_example text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'implemented', 'rejected')),
  reviewer_note text,
  created_at timestamptz not null default now()
);

alter table public.feedback_submissions enable row level security;

create policy "Users can view own feedback submissions"
  on public.feedback_submissions for select
  using (auth.uid() = user_id);

create policy "Users can create own feedback submissions"
  on public.feedback_submissions for insert
  with check (auth.uid() = user_id);

create policy "Admins can manage feedback submissions"
  on public.feedback_submissions for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create index idx_feedback_submissions_user on public.feedback_submissions(user_id);
create index idx_feedback_submissions_status on public.feedback_submissions(status);
create index idx_feedback_submissions_kind on public.feedback_submissions(kind);
