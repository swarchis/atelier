-- Suggestion inbox on the Home dashboard — real submissions, not a mailto link.
create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_name text,
  type text not null default 'suggestion', -- suggestion | bug
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.feedback_submissions enable row level security;
create policy "brand access select feedback" on public.feedback_submissions for select using (public.has_brand_access(brand_id));
create policy "brand access insert feedback" on public.feedback_submissions for insert with check (public.has_brand_access(brand_id));
