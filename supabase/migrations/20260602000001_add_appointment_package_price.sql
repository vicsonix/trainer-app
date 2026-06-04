ALTER TABLE public.appointments
  ADD COLUMN package_id uuid REFERENCES public.packages(id) ON DELETE SET NULL,
  ADD COLUMN price      numeric(10, 2);
