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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-images',
  'site-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view site images" on storage.objects;
create policy "Public can view site images"
on storage.objects
for select
to public
using (bucket_id = 'site-images');

drop policy if exists "Authenticated users can upload site images" on storage.objects;
create policy "Authenticated users can upload site images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'site-images');

drop policy if exists "Authenticated users can update site images" on storage.objects;
create policy "Authenticated users can update site images"
on storage.objects
for update
to authenticated
using (bucket_id = 'site-images')
with check (bucket_id = 'site-images');

drop policy if exists "Authenticated users can delete site images" on storage.objects;
create policy "Authenticated users can delete site images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'site-images');

create table if not exists public.orders (
  id text primary key,
  code text not null unique,
  status text not null,
  data jsonb not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  status_updated_at timestamptz not null default timezone('utc'::text, now()),
  status_updated_by uuid references auth.users (id) on delete set null
);

alter table public.orders enable row level security;

create or replace function public.touch_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());

  if new.status is distinct from old.status then
    new.status_updated_at = timezone('utc'::text, now());
  end if;

  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row
execute function public.touch_orders_updated_at();

drop policy if exists "Public can insert orders" on public.orders;
create policy "Public can insert orders"
on public.orders
for insert
to anon, authenticated
with check (true);

drop policy if exists "Authenticated users can read orders" on public.orders;
create policy "Authenticated users can read orders"
on public.orders
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can update orders" on public.orders;
create policy "Authenticated users can update orders"
on public.orders
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
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
