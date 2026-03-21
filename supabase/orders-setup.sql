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

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
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
