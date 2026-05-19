-- trainer-app schema
-- Run this in the Supabase SQL editor after creating your project.

-- packages: training session bundles sold to clients
create table public.packages (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  visit_count int  not null check (visit_count > 0),
  price       numeric(10, 2) not null check (price >= 0),
  created_at  timestamptz not null default now()
);

-- clients: trainer's clients
create table public.clients (
  id              uuid primary key default gen_random_uuid(),
  trainer_id      uuid not null references auth.users(id) on delete cascade,
  first_name      text not null,
  last_name       text not null,
  phone           text,
  email           text,
  package_id      uuid references public.packages(id) on delete set null,
  interview_notes text,
  plan_url        text,
  created_at      timestamptz not null default now()
);

-- appointments: individual sessions in the trainer's calendar
create table public.appointments (
  id         uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete cascade,
  starts_at  timestamptz not null,
  created_at timestamptz not null default now()
);

-- Row Level Security: each trainer sees only their own data
alter table public.packages     enable row level security;
alter table public.clients      enable row level security;
alter table public.appointments enable row level security;

create policy "trainer owns packages"
  on public.packages for all
  using (trainer_id = auth.uid());

create policy "trainer owns clients"
  on public.clients for all
  using (trainer_id = auth.uid());

create policy "trainer owns appointments"
  on public.appointments for all
  using (trainer_id = auth.uid());

-- Index for weekly calendar queries
create index on public.appointments (trainer_id, starts_at);
