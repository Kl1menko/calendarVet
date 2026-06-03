-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

-- 1. Appointments table
create table if not exists appointments (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  start_time  time not null,
  end_time    time not null,
  client      text not null,
  phone       text not null,
  pet         text not null,
  animal      text,
  service     text not null,
  doctor      text not null,
  status      text not null default 'Заплановано',
  comment     text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 2. Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger appointments_updated_at
  before update on appointments
  for each row execute function update_updated_at();

-- 3. Enable Row Level Security
alter table appointments enable row level security;

-- All authenticated users can read all appointments
create policy "authenticated can read"
  on appointments for select
  to authenticated
  using (true);

-- All authenticated users can insert
create policy "authenticated can insert"
  on appointments for insert
  to authenticated
  with check (true);

-- All authenticated users can update
create policy "authenticated can update"
  on appointments for update
  to authenticated
  using (true);

-- All authenticated users can delete
create policy "authenticated can delete"
  on appointments for delete
  to authenticated
  using (true);

-- 4. Enable Realtime for live updates across all doctors
alter publication supabase_realtime add table appointments;

-- 5. Notices table
create table if not exists notices (
  id          uuid primary key default gen_random_uuid(),
  text        text not null,
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now()
);

-- Enable Row Level Security
alter table notices enable row level security;

-- All authenticated users can read notices
create policy "authenticated can read notices"
  on notices for select
  to authenticated
  using (true);

-- All authenticated users can insert notices
create policy "authenticated can insert notices"
  on notices for insert
  to authenticated
  with check (true);

-- All authenticated users can delete notices
create policy "authenticated can delete notices"
  on notices for delete
  to authenticated
  using (true);
