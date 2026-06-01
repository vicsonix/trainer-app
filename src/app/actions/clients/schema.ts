import { z } from 'zod'

export const clientSchema = z.object({
  first_name:      z.string().min(1, 'Imię jest wymagane'),
  last_name:       z.string().min(1, 'Nazwisko jest wymagane'),
  phone:           z.string().nullish().transform(v => v ?? ''),
  email:           z.string().nullish().transform(v => v ?? '').pipe(
    z.union([z.string().email('Nieprawidłowy adres email'), z.literal('')])
  ),
  package_id:      z.string().nullish().transform(v => v ?? '').pipe(
    z.union([z.string().uuid('Nieprawidłowy pakiet'), z.literal('')])
  ),
  interview_notes: z.string().nullish().transform(v => v ?? ''),
  plan_url:        z.string().nullish().transform(v => v ?? '').pipe(
    z.union([z.string().url('Nieprawidłowy URL planu'), z.literal('')])
  ),
})
