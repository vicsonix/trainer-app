ALTER TABLE public.appointments
  ADD COLUMN ends_at timestamptz,
  ADD COLUMN notes   text;

UPDATE public.appointments
SET ends_at = starts_at + interval '1 hour'
WHERE ends_at IS NULL;

ALTER TABLE public.appointments
  ALTER COLUMN ends_at SET NOT NULL;

ALTER TABLE public.appointments
  ADD CONSTRAINT chk_ends_after_starts CHECK (ends_at > starts_at);
