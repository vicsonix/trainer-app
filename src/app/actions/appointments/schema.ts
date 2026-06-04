import { z } from 'zod'

export const appointmentSchema = z.object({
  client_id:  z.string().min(1, 'Klient jest wymagany').uuid('Nieprawidłowy klient'),
  package_id: z.string().nullish().transform(v => v || null).pipe(
    z.union([z.string().uuid('Nieprawidłowy pakiet'), z.null()])
  ),
  date:       z.string().min(1, 'Data jest wymagana'),
  start_time: z.string().min(1, 'Godzina jest wymagana'),
  duration:   z.enum(['30', '60', '90', '120'], { message: 'Nieprawidłowy czas trwania' }),
  notes:      z.string().nullish().transform(v => v ?? ''),
  price:      z.string().nullish().transform(v => v || null).pipe(
    z.union([
      z.string().regex(/^\d+(\.\d{1,2})?$/, 'Nieprawidłowa cena').transform(Number),
      z.null(),
    ])
  ),
  tz:         z.string().min(1, 'Strefa czasowa jest wymagana'),
})
