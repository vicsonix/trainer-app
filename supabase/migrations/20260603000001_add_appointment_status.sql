ALTER TABLE public.appointments
  ADD COLUMN status text NOT NULL DEFAULT 'scheduled'
    CONSTRAINT appointments_status_check
      CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show'));
