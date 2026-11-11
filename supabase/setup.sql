-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- One row of progress per account; each user can only see and change their own row.

create table if not exists public.progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

drop policy if exists "read own progress"   on public.progress;
drop policy if exists "insert own progress" on public.progress;
drop policy if exists "update own progress" on public.progress;

create policy "read own progress"   on public.progress for select to authenticated using (auth.uid() = user_id);
create policy "insert own progress" on public.progress for insert to authenticated with check (auth.uid() = user_id);
create policy "update own progress" on public.progress for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
