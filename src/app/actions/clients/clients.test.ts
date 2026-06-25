/* eslint-disable @typescript-eslint/no-explicit-any */
import { clientSchema } from './schema'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server')

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createClientAction, updateClientAction, deleteClientAction } from '.'

// ─── helpers ────────────────────────────────────────────────────────────────

const USER_ID = 'user-123'
const CLIENT_ID = 'client-456'

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  Object.entries(data).forEach(([k, v]) => fd.append(k, v))
  return fd
}

const VALID_FORM: Record<string, string> = {
  first_name:      'Jan',
  last_name:       'Kowalski',
  phone:           '600 100 200',
  email:           'jan@example.com',
  package_id:      '',
  interview_notes: 'Chce schudnąć 10kg.',
  plan_url:        '',
}

type MockQueryResult = { data?: any; error: null | { message: string } }

const DEFAULT_CLIENT_DATA = { id: CLIENT_ID, first_name: 'Jan', last_name: 'Kowalski', interview_notes: null }

function buildQueryChain(resolveWith: MockQueryResult = { data: DEFAULT_CLIENT_DATA, error: null }) {
  const singleFn = vi.fn().mockResolvedValue(resolveWith)
  const selectFn = vi.fn().mockReturnValue({ single: singleFn })

  const insertFn = vi.fn()
  const updateFn = vi.fn()
  const deleteFn = vi.fn()
  const eqFn    = vi.fn()

  const chain: any = {
    insert: insertFn,
    update: updateFn,
    delete: deleteFn,
    eq:     eqFn,
    select: selectFn,
    then:   (resolve: any, reject?: any) => Promise.resolve(resolveWith).then(resolve, reject),
    catch:  (fn: any) => Promise.resolve(resolveWith).catch(fn),
    finally:(fn: any) => Promise.resolve(resolveWith).finally(fn),
  }

  insertFn.mockReturnValue(chain)
  updateFn.mockReturnValue(chain)
  deleteFn.mockReturnValue(chain)
  eqFn.mockReturnValue(chain)

  return { chain, insertFn, updateFn, deleteFn, eqFn, selectFn, singleFn }
}

function setupMockSupabase(opts: {
  userId?: string | null
  queryChain?: ReturnType<typeof buildQueryChain>
}) {
  const userId = opts.userId !== undefined ? opts.userId : USER_ID
  const { chain, ...fns } = opts.queryChain ?? buildQueryChain()
  const fromFn    = vi.fn().mockReturnValue(chain)
  const getUserFn = vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } })

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: getUserFn },
    from: fromFn,
  } as any)

  return { fromFn, getUserFn, ...fns }
}

// ─── clientSchema tests ──────────────────────────────────────────────────────

describe('clientSchema', () => {
  it('accepts fully populated valid input', () => {
    const result = clientSchema.safeParse({
      first_name:      'Jan',
      last_name:       'Kowalski',
      phone:           '600 100 200',
      email:           'jan@example.com',
      package_id:      '550e8400-e29b-41d4-a716-446655440000',
      interview_notes: 'Cel: redukcja wagi.',
      plan_url:        'https://docs.google.com/plan',
    })
    expect(result.success).toBe(true)
  })

  it('accepts minimal required fields only', () => {
    const result = clientSchema.safeParse({
      first_name: 'Jan',
      last_name:  'Kowalski',
      phone: '', email: '', package_id: '', interview_notes: '', plan_url: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty first_name', () => {
    const result = clientSchema.safeParse({ ...VALID_FORM, first_name: '' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(i => i.path[0] === 'first_name')).toBe(true)
  })

  it('rejects empty last_name', () => {
    const result = clientSchema.safeParse({ ...VALID_FORM, last_name: '' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(i => i.path[0] === 'last_name')).toBe(true)
  })

  it('accepts empty string for optional email', () => {
    const result = clientSchema.safeParse({ ...VALID_FORM, email: '' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email format when non-empty', () => {
    const result = clientSchema.safeParse({ ...VALID_FORM, email: 'not-an-email' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(i => i.path[0] === 'email')).toBe(true)
  })

  it('accepts empty string for optional package_id', () => {
    const result = clientSchema.safeParse({ ...VALID_FORM, package_id: '' })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID package_id when non-empty', () => {
    const result = clientSchema.safeParse({ ...VALID_FORM, package_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(i => i.path[0] === 'package_id')).toBe(true)
  })

  it('accepts empty string for optional plan_url', () => {
    const result = clientSchema.safeParse({ ...VALID_FORM, plan_url: '' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid URL for plan_url when non-empty', () => {
    const result = clientSchema.safeParse({ ...VALID_FORM, plan_url: 'not-a-url' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(i => i.path[0] === 'plan_url')).toBe(true)
  })

  it('accepts valid URL for plan_url', () => {
    const result = clientSchema.safeParse({ ...VALID_FORM, plan_url: 'https://docs.google.com/plan' })
    expect(result.success).toBe(true)
  })

  it('coerces null to empty string for optional fields', () => {
    const result = clientSchema.safeParse({
      first_name: 'Jan', last_name: 'K',
      phone: null, email: null, package_id: null, interview_notes: null, plan_url: null,
    })
    expect(result.success).toBe(true)
  })
})

// ─── createClientAction tests ────────────────────────────────────────────────

describe('createClientAction', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns success and inserts with trainer_id on valid input', async () => {
    const { fromFn, insertFn } = setupMockSupabase({})

    const result = await createClientAction(null, makeFormData(VALID_FORM))

    expect(result).toEqual({ success: true })
    expect(fromFn).toHaveBeenCalledWith('clients')
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ trainer_id: USER_ID, first_name: 'Jan', last_name: 'Kowalski' })
    )
    expect(revalidatePath).toHaveBeenCalledWith('/clients')
  })

  it('converts empty optional strings to null before insert', async () => {
    const { insertFn } = setupMockSupabase({})

    await createClientAction(null, makeFormData({ ...VALID_FORM, email: '', package_id: '', plan_url: '' }))

    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ email: null, package_id: null, plan_url: null })
    )
  })

  it('returns field errors without calling Supabase when validation fails', async () => {
    const { fromFn } = setupMockSupabase({})

    const result = await createClientAction(null, makeFormData({ ...VALID_FORM, first_name: '' }))

    expect(result).toMatchObject({ errors: { first_name: expect.any(Array) } })
    expect(fromFn).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('returns session error when user is not authenticated', async () => {
    setupMockSupabase({ userId: null })

    const result = await createClientAction(null, makeFormData(VALID_FORM))

    expect(result).toEqual({ errors: { _form: ['Sesja wygasła'] } })
  })

  it('returns form error when Supabase insert fails', async () => {
    setupMockSupabase({ queryChain: buildQueryChain({ error: { message: 'DB error' } }) })

    const result = await createClientAction(null, makeFormData(VALID_FORM))

    expect(result).toMatchObject({ errors: { _form: expect.any(Array) } })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

// ─── updateClientAction tests ────────────────────────────────────────────────

describe('updateClientAction', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls update with ownership check on valid input', async () => {
    const { fromFn, updateFn, eqFn } = setupMockSupabase({})

    const result = await updateClientAction(CLIENT_ID, null, makeFormData(VALID_FORM))

    expect(result).toEqual({ success: true })
    expect(fromFn).toHaveBeenCalledWith('clients')
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ first_name: 'Jan', last_name: 'Kowalski' })
    )
    expect(eqFn).toHaveBeenCalledWith('id', CLIENT_ID)
    expect(eqFn).toHaveBeenCalledWith('trainer_id', USER_ID)
    expect(revalidatePath).toHaveBeenCalledWith('/clients')
  })

  it('returns field errors without calling Supabase when validation fails', async () => {
    const { fromFn } = setupMockSupabase({})

    const result = await updateClientAction(CLIENT_ID, null, makeFormData({ ...VALID_FORM, last_name: '' }))

    expect(result).toMatchObject({ errors: { last_name: expect.any(Array) } })
    expect(fromFn).not.toHaveBeenCalled()
  })

  it('returns session error when user is not authenticated', async () => {
    setupMockSupabase({ userId: null })

    const result = await updateClientAction(CLIENT_ID, null, makeFormData(VALID_FORM))

    expect(result).toEqual({ errors: { _form: ['Sesja wygasła'] } })
  })
})

// ─── deleteClientAction tests ────────────────────────────────────────────────

describe('deleteClientAction', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls delete with ownership check and revalidates', async () => {
    const { fromFn, deleteFn, eqFn } = setupMockSupabase({})

    await deleteClientAction(CLIENT_ID)

    expect(fromFn).toHaveBeenCalledWith('clients')
    expect(deleteFn).toHaveBeenCalled()
    expect(eqFn).toHaveBeenCalledWith('id', CLIENT_ID)
    expect(eqFn).toHaveBeenCalledWith('trainer_id', USER_ID)
    expect(revalidatePath).toHaveBeenCalledWith('/clients')
  })

  it('returns early without DB call when user is not authenticated', async () => {
    const { fromFn } = setupMockSupabase({ userId: null })

    await deleteClientAction(CLIENT_ID)

    expect(fromFn).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
