drop index if exists public.appointments_trainer_id_starts_at_idx;

drop policy if exists "trainer owns appointments" on public.appointments;
drop policy if exists "trainer owns clients" on public.clients;
drop policy if exists "trainer owns packages" on public.packages;

drop table if exists public.appointments;
drop table if exists public.clients;
drop table if exists public.packages;
