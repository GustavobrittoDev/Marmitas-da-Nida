create table if not exists public.site_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.site_state enable row level security;

create or replace function public.touch_site_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists site_state_set_updated_at on public.site_state;
create trigger site_state_set_updated_at
before update on public.site_state
for each row
execute function public.touch_site_state_updated_at();

drop policy if exists "Public can read site state" on public.site_state;
create policy "Public can read site state"
on public.site_state
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can insert site state" on public.site_state;
create policy "Authenticated users can insert site state"
on public.site_state
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update site state" on public.site_state;
create policy "Authenticated users can update site state"
on public.site_state
for update
to authenticated
using (true)
with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'site_state'
  ) then
    alter publication supabase_realtime add table public.site_state;
  end if;
end;
$$;
