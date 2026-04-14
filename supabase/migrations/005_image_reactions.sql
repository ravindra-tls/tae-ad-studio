-- TAE Ad Studio — Image Reactions (Like / Dislike)
-- Tracks per-user reactions on generated images for quality analysis

create table public.image_reactions (
  id          uuid        primary key default gen_random_uuid(),
  image_id    uuid        not null references public.generated_images(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id)          on delete cascade,
  reaction    text        not null check (reaction in ('like', 'dislike')),
  created_at  timestamptz not null default now(),

  -- One reaction per user per image — upsert replaces previous vote
  unique (image_id, user_id)
);

alter table public.image_reactions enable row level security;

-- Users can insert/update their own reactions
create policy "Users can upsert own reactions"
  on public.image_reactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own reactions"
  on public.image_reactions for update
  using (auth.uid() = user_id);

-- Users can read their own reactions
create policy "Users can read own reactions"
  on public.image_reactions for select
  using (auth.uid() = user_id);

-- Admins can read all reactions (for stats)
create policy "Admins can read all reactions"
  on public.image_reactions for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Indexes
create index idx_image_reactions_image   on public.image_reactions (image_id);
create index idx_image_reactions_user    on public.image_reactions (user_id);
create index idx_image_reactions_created on public.image_reactions (created_at desc);
