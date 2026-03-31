-- Migration 002: Add product context JSONB column
-- This stores rich ad-generation context: colors, benefits, stats,
-- testimonials, transformation narrative, CTAs, scene settings, etc.

alter table public.products
  add column if not exists context jsonb default null;

comment on column public.products.context is
  'Rich ad-generation context: colors, benefits, stats, testimonials, transformation, CTAs, scene settings';
