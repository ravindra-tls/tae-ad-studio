-- TAE Ad Studio — Initial Schema
-- Run this in Supabase SQL Editor or via CLI migration

-- ═══════════════════════════════════════════════════════
-- 1. PROFILES
-- ═══════════════════════════════════════════════════════
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique not null,
  full_name     text,
  role          text not null default 'user' check (role in ('user', 'admin')),
  usage_cap     integer not null default 30,
  usage_count   integer not null default 0,
  cycle_reset   timestamptz not null default (now() + interval '30 days'),
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read/update their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admins can read/update all profiles
create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update all profiles"
  on public.profiles for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usage increment function
create or replace function public.increment_usage(user_id uuid)
returns void as $$
begin
  update public.profiles
  set usage_count = usage_count + 1
  where id = user_id;
end;
$$ language plpgsql security definer;

-- Auto-reset usage on cycle date
create or replace function public.reset_expired_usage()
returns void as $$
begin
  update public.profiles
  set usage_count = 0,
      cycle_reset = now() + interval '30 days'
  where cycle_reset < now();
end;
$$ language plpgsql security definer;


-- ═══════════════════════════════════════════════════════
-- 2. PRODUCTS
-- ═══════════════════════════════════════════════════════
create table public.products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  brand           text not null,
  sub_brand       text,
  description     text,
  ingredients     jsonb not null default '[]'::jsonb,
  claims          jsonb not null default '[]'::jsonb,
  color_palette   jsonb not null default '[]'::jsonb,
  prompt_modifier text,
  compliance_rules text[] not null default '{}',
  thumbnail_url   text,
  created_at      timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Authenticated users can view products"
  on public.products for select
  using (auth.role() = 'authenticated');

create policy "Admins can manage products"
  on public.products for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );


-- ═══════════════════════════════════════════════════════
-- 3. PRODUCT IMAGES
-- ═══════════════════════════════════════════════════════
create table public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  url         text not null,
  label       text,
  is_reference boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.product_images enable row level security;

create policy "Authenticated users can view product images"
  on public.product_images for select
  using (auth.role() = 'authenticated');

create policy "Admins can manage product images"
  on public.product_images for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );


-- ═══════════════════════════════════════════════════════
-- 4. PROMPT TEMPLATES
-- ═══════════════════════════════════════════════════════
create table public.prompt_templates (
  id                  uuid primary key default gen_random_uuid(),
  number              integer unique not null,
  name                text not null,
  category            text not null,
  template            text not null,
  default_aspect_ratio text not null default '1:1',
  version             integer not null default 1,
  created_at          timestamptz not null default now()
);

alter table public.prompt_templates enable row level security;

create policy "Authenticated users can view templates"
  on public.prompt_templates for select
  using (auth.role() = 'authenticated');

create policy "Admins can manage templates"
  on public.prompt_templates for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );


-- ═══════════════════════════════════════════════════════
-- 5. SESSIONS
-- ═══════════════════════════════════════════════════════
create table public.sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  name        text not null,
  status      text not null default 'active' check (status in ('active', 'archived')),
  created_at  timestamptz not null default now()
);

alter table public.sessions enable row level security;

create policy "Users can view own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "Users can create sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.sessions for update
  using (auth.uid() = user_id);

create policy "Admins can view all sessions"
  on public.sessions for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );


-- ═══════════════════════════════════════════════════════
-- 6. GENERATED IMAGES
-- ═══════════════════════════════════════════════════════
create table public.generated_images (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions(id) on delete cascade,
  prompt_used   text not null,
  aspect_ratio  text not null default '1:1',
  image_url     text,
  api_provider  text,
  model_id      text,
  request_id    text,
  status        text not null default 'queued' check (status in ('queued', 'in_progress', 'completed', 'failed', 'nsfw')),
  error_message text,
  created_at    timestamptz not null default now()
);

alter table public.generated_images enable row level security;

create policy "Users can view own generated images"
  on public.generated_images for select
  using (
    exists (select 1 from public.sessions where id = session_id and user_id = auth.uid())
  );

create policy "Users can create generated images"
  on public.generated_images for insert
  with check (
    exists (select 1 from public.sessions where id = session_id and user_id = auth.uid())
  );

create policy "System can update generated images"
  on public.generated_images for update
  using (true);

create policy "Admins can view all generated images"
  on public.generated_images for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );


-- ═══════════════════════════════════════════════════════
-- 7. CONTEXT CONTRIBUTIONS
-- ═══════════════════════════════════════════════════════
create table public.context_contributions (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  content       text not null,
  content_type  text not null default 'general' check (content_type in ('ingredient', 'claim', 'image', 'general')),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_note text,
  created_at    timestamptz not null default now()
);

alter table public.context_contributions enable row level security;

create policy "Users can view own contributions"
  on public.context_contributions for select
  using (auth.uid() = user_id);

create policy "Users can create contributions"
  on public.context_contributions for insert
  with check (auth.uid() = user_id);

create policy "Admins can manage all contributions"
  on public.context_contributions for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );


-- ═══════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════
create index idx_sessions_user on public.sessions(user_id);
create index idx_sessions_product on public.sessions(product_id);
create index idx_generated_images_session on public.generated_images(session_id);
create index idx_generated_images_status on public.generated_images(status);
create index idx_product_images_product on public.product_images(product_id);
create index idx_context_contributions_status on public.context_contributions(status);
create index idx_prompt_templates_category on public.prompt_templates(category);


-- ═══════════════════════════════════════════════════════
-- STORAGE BUCKETS
-- ═══════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('generated-images', 'generated-images', true),
  ('reference-uploads', 'reference-uploads', false);

-- Public read for product and generated images
create policy "Public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Public read generated images"
  on storage.objects for select
  using (bucket_id = 'generated-images');

-- Authenticated upload to reference-uploads
create policy "Authenticated upload references"
  on storage.objects for insert
  with check (bucket_id = 'reference-uploads' and auth.role() = 'authenticated');

create policy "Users read own references"
  on storage.objects for select
  using (bucket_id = 'reference-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
