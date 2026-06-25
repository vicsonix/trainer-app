/* eslint-disable @typescript-eslint/no-explicit-any */
vi.mock('@/lib/logger', () => ({ log: vi.fn() }))

import { buildTrainerContext, MAX_CONTEXT_CHARS } from './context'

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeChain(data: any[]) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    then: (resolve: any, reject?: any) =>
      Promise.resolve({ data, error: null }).then(resolve, reject),
    catch: (fn: any) => Promise.resolve({ data, error: null }).catch(fn),
    finally: (fn: any) => Promise.resolve({ data, error: null }).finally(fn),
  }
  return chain
}

function makeMockSupabase(opts: {
  clients?: any[]
  appointments?: any[]
  packages?: any[]
}) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'clients') return makeChain(opts.clients ?? [])
      if (table === 'appointments') return makeChain(opts.appointments ?? [])
      if (table === 'packages') return makeChain(opts.packages ?? [])
      return makeChain([])
    }),
  } as any
}

// ─── buildTrainerContext ──────────────────────────────────────────────────────

describe('buildTrainerContext', () => {
  it('returns a string no longer than MAX_CONTEXT_CHARS when data is large', async () => {
    const longNotes = 'A'.repeat(2_000)
    const clients = Array.from({ length: 20 }, (_, i) => ({
      id: `client-${i}`,
      first_name: `Klient${i}`,
      last_name: 'Testowy',
      interview_notes: longNotes,
      email: null,
      phone: null,
      packages: null,
    }))

    const supabase = makeMockSupabase({ clients, appointments: [], packages: [] })

    const result = await buildTrainerContext(supabase, 'trainer-1')

    expect(result.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS)
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns fallback string when all Supabase queries fail', async () => {
    const supabase = {
      from: vi.fn().mockImplementation(() => {
        throw new Error('network error')
      }),
    } as any

    const result = await buildTrainerContext(supabase, 'trainer-1')

    expect(result).toBe('No client data available.')
  })
})
