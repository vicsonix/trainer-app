/* eslint-disable @typescript-eslint/no-explicit-any */
import { appointmentSchema } from './schema'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server')

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  createAppointmentAction,
  updateAppointmentAction,
  deleteAppointmentAction,
  updateAppointmentStatusAction,
} from '.'

// ─── constants ───────────────────────────────────────────────────────────────

const USER_ID   = 'user-123'
const APPT_ID   = 'appt-456'
const CLIENT_ID = '550e8400-e29b-41d4-a716-446655440001'

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  Object.entries(data).forEach(([k, v]) => fd.append(k, v))
  return fd
}

const VALID_FORM: Record<string, string> = {
  client_id:  CLIENT_ID,
  package_id: '',
  date:       '2026-06-10',
  start_time: '10:00',
  duration:   '60',
  notes:      '',
  price:      '',
  tz:         'Europe/Warsaw',
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// Self-referential thenable chain — every method returns `this`, making the
// whole chain awaitable with the provided resolved value.
function makeChain(resolveWith: unknown) {
  const chain: any = {
    then:    (res: any, rej: any) => Promise.resolve(resolveWith).then(res, rej),
    catch:   (fn: any)            => Promise.resolve(resolveWith).catch(fn),
    finally: (fn: any)            => Promise.resolve(resolveWith).finally(fn),
  }
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'lt', 'gt']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  return chain
}

// Two-call setup: first from() = overlap check, second from() = write operation.
function setupDualCallMock(opts: {
  userId?: string | null
  overlapCount?: number
  writeError?: null | { message: string }
}) {
  const userId     = opts.userId !== undefined ? opts.userId : USER_ID
  const overlapCh  = makeChain({ count: opts.overlapCount ?? 0, error: null })
  const writeCh    = makeChain({ error: opts.writeError ?? null })
  const fromFn     = vi.fn()
    .mockReturnValueOnce(overlapCh)
    .mockReturnValueOnce(writeCh)
  const getUserFn  = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
  })
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: getUserFn },
    from: fromFn,
  } as any)
  return { fromFn, getUserFn, overlapCh, writeCh }
}

// Single-call setup: for delete and status actions that have one from() call.
function setupSingleCallMock(opts: {
  userId?: string | null
  resolveWith?: unknown
}) {
  const userId     = opts.userId !== undefined ? opts.userId : USER_ID
  const chain      = makeChain(opts.resolveWith ?? { error: null })
  const fromFn     = vi.fn().mockReturnValue(chain)
  const getUserFn  = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
  })
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: getUserFn },
    from: fromFn,
  } as any)
  return { fromFn, getUserFn, chain }
}

// ─── appointmentSchema ───────────────────────────────────────────────────────

describe('appointmentSchema', () => {
  it('accepts fully populated valid input', () => {
    const result = appointmentSchema.safeParse({
      client_id:  CLIENT_ID,
      package_id: '550e8400-e29b-41d4-a716-446655440002',
      date:       '2026-06-10',
      start_time: '10:00',
      duration:   '60',
      notes:      'Przynieś strój kąpielowy.',
      price:      '150.00',
      tz:         'Europe/Warsaw',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid input with blank notes and no package', () => {
    const result = appointmentSchema.safeParse({ ...VALID_FORM })
    expect(result.success).toBe(true)
  })

  it('rejects missing client_id', () => {
    const result = appointmentSchema.safeParse({ ...VALID_FORM, client_id: '' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(i => i.path[0] === 'client_id')).toBe(true)
  })

  it('rejects invalid duration value', () => {
    const result = appointmentSchema.safeParse({ ...VALID_FORM, duration: '45' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(i => i.path[0] === 'duration')).toBe(true)
  })
})

// ─── createAppointmentAction ─────────────────────────────────────────────────

describe('createAppointmentAction', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns success and inserts with trainer_id and correctly computed ends_at', async () => {
    const { fromFn, writeCh } = setupDualCallMock({})

    const result = await createAppointmentAction(null, makeFormData(VALID_FORM))

    expect(result).toEqual({ success: true })
    expect(fromFn).toHaveBeenCalledWith('appointments')
    expect(writeCh.insert).toHaveBeenCalledWith(
      expect.objectContaining({ trainer_id: USER_ID, client_id: CLIENT_ID })
    )
    const insertArg = writeCh.insert.mock.calls[0][0]
    const starts = new Date(insertArg.starts_at)
    const ends   = new Date(insertArg.ends_at)
    expect(ends.getTime() - starts.getTime()).toBe(60 * 60_000)
    expect(revalidatePath).toHaveBeenCalledWith('/calendar')
  })

  it('returns field errors without calling Supabase when validation fails', async () => {
    const { fromFn } = setupDualCallMock({})

    const result = await createAppointmentAction(null, makeFormData({ ...VALID_FORM, client_id: '' }))

    expect(result).toMatchObject({ errors: { client_id: expect.any(Array) } })
    expect(fromFn).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('returns session error when user is not authenticated', async () => {
    setupDualCallMock({ userId: null })

    const result = await createAppointmentAction(null, makeFormData(VALID_FORM))

    expect(result).toEqual({ errors: { _form: ['Sesja wygasła'] } })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('returns form error when an appointment already exists in that time slot', async () => {
    setupDualCallMock({ overlapCount: 1 })

    const result = await createAppointmentAction(null, makeFormData(VALID_FORM))

    expect(result).toMatchObject({ errors: { _form: expect.any(Array) } })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('returns form error when Supabase insert fails', async () => {
    setupDualCallMock({ writeError: { message: 'DB error' } })

    const result = await createAppointmentAction(null, makeFormData(VALID_FORM))

    expect(result).toMatchObject({ errors: { _form: expect.any(Array) } })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

// ─── updateAppointmentAction ─────────────────────────────────────────────────

describe('updateAppointmentAction', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls update with ownership check on valid input', async () => {
    const { fromFn, overlapCh, writeCh } = setupDualCallMock({})

    const result = await updateAppointmentAction(APPT_ID, null, makeFormData(VALID_FORM))

    expect(result).toEqual({ success: true })
    expect(fromFn).toHaveBeenCalledWith('appointments')
    expect(overlapCh.neq).toHaveBeenCalledWith('id', APPT_ID)
    expect(writeCh.update).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: CLIENT_ID })
    )
    expect(writeCh.eq).toHaveBeenCalledWith('id', APPT_ID)
    expect(writeCh.eq).toHaveBeenCalledWith('trainer_id', USER_ID)
    expect(revalidatePath).toHaveBeenCalledWith('/calendar')
  })

  it('returns field errors without calling Supabase when validation fails', async () => {
    const { fromFn } = setupDualCallMock({})

    const result = await updateAppointmentAction(APPT_ID, null, makeFormData({ ...VALID_FORM, duration: 'bad' }))

    expect(result).toMatchObject({ errors: { duration: expect.any(Array) } })
    expect(fromFn).not.toHaveBeenCalled()
  })

  it('returns session error when user is not authenticated', async () => {
    setupDualCallMock({ userId: null })

    const result = await updateAppointmentAction(APPT_ID, null, makeFormData(VALID_FORM))

    expect(result).toEqual({ errors: { _form: ['Sesja wygasła'] } })
  })
})

// ─── deleteAppointmentAction ─────────────────────────────────────────────────

describe('deleteAppointmentAction', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls delete with ownership check and revalidates', async () => {
    const { fromFn, chain } = setupSingleCallMock({})

    await deleteAppointmentAction(APPT_ID)

    expect(fromFn).toHaveBeenCalledWith('appointments')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', APPT_ID)
    expect(chain.eq).toHaveBeenCalledWith('trainer_id', USER_ID)
    expect(revalidatePath).toHaveBeenCalledWith('/calendar')
  })

  it('returns early without DB call when user is not authenticated', async () => {
    const { fromFn } = setupSingleCallMock({ userId: null })

    const result = await deleteAppointmentAction(APPT_ID)

    expect(result).toEqual({ error: 'Sesja wygasła' })
    expect(fromFn).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

// ─── updateAppointmentStatusAction ───────────────────────────────────────────

describe('updateAppointmentStatusAction', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls update with new status and revalidates', async () => {
    const { fromFn, chain } = setupSingleCallMock({})

    await updateAppointmentStatusAction(APPT_ID, 'completed')

    expect(fromFn).toHaveBeenCalledWith('appointments')
    expect(chain.update).toHaveBeenCalledWith({ status: 'completed' })
    expect(chain.eq).toHaveBeenCalledWith('id', APPT_ID)
    expect(chain.eq).toHaveBeenCalledWith('trainer_id', USER_ID)
    expect(revalidatePath).toHaveBeenCalledWith('/calendar')
  })

  it('returns session error without DB call when user is not authenticated', async () => {
    const { fromFn } = setupSingleCallMock({ userId: null })

    const result = await updateAppointmentStatusAction(APPT_ID, 'completed')

    expect(result).toEqual({ error: 'Sesja wygasła' })
    expect(fromFn).not.toHaveBeenCalled()
  })
})
