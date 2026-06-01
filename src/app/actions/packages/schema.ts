import { z } from 'zod'

export const packageSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana'),
  visit_count: z.coerce.number().int().positive('Liczba wizyt musi być większa od zera'),
  price: z.unknown()
    .transform(val => val === '' ? undefined : val)
    .pipe(z.coerce.number({ error: 'Cena jest wymagana' }).min(0, 'Cena nie może być ujemna')),
})
