/* eslint-disable @typescript-eslint/no-explicit-any */
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server')
vi.mock('@/lib/ai/context', () => ({
  buildTrainerContext: vi.fn(),
  MAX_CONTEXT_CHARS: 12_000,
}))
vi.mock('@/lib/ai/tools', () => ({
  makeTools: vi.fn().mockReturnValue({}),
}))
vi.mock('@/lib/embeddings', () => ({
  embedText: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/logger', () => ({
  log: vi.fn(),
}))
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn().mockReturnValue('mock-model'),
}))
vi.mock('ai', () => ({
  streamText: vi.fn(),
  createUIMessageStreamResponse: vi.fn(),
  convertToModelMessages: vi.fn().mockResolvedValue([]),
  stepCountIs: vi.fn().mockReturnValue(vi.fn()),
}))

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildTrainerContext } from '@/lib/ai/context'
import { streamText, createUIMessageStreamResponse } from 'ai'
import { POST } from './route'

// ─── constants ───────────────────────────────────────────────────────────────

const TRAINER_ID = 'trainer-1'

const VALID_MESSAGES = [
  {
    role: 'user',
    id: 'msg-1',
    parts: [{ type: 'text', text: 'Hello' }],
    content: [{ type: 'text', text: 'Hello' }],
  },
]

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function setupMockSupabase(userId: string | null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
      }),
    },
    from: vi.fn().mockReturnValue({}),
    rpc: vi.fn().mockResolvedValue({ data: null }),
  } as any)
}

// ─── POST /api/ai/chat ────────────────────────────────────────────────────────

describe('POST /api/ai/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(streamText).mockReturnValue({
      toUIMessageStream: vi.fn().mockReturnValue(new ReadableStream()),
    } as any)

    vi.mocked(createUIMessageStreamResponse).mockReturnValue(
      new Response('ok', { status: 200 }),
    )
  })

  it('returns 401 when user is not authenticated', async () => {
    setupMockSupabase(null)

    const response = await POST(makeRequest({ messages: VALID_MESSAGES }))

    expect(response.status).toBe(401)
    expect(buildTrainerContext).not.toHaveBeenCalled()
  })

  it('calls buildTrainerContext with the authenticated trainer id only', async () => {
    setupMockSupabase(TRAINER_ID)
    vi.mocked(buildTrainerContext).mockResolvedValue(
      'Anna Nowak (id: client-trainer-1)\nNotes: knee rehab',
    )

    const response = await POST(makeRequest({ messages: VALID_MESSAGES }))

    expect(response.status).toBe(200)

    // Context is scoped to the authenticated trainer
    expect(buildTrainerContext).toHaveBeenCalledWith(
      expect.anything(),
      TRAINER_ID,
      undefined,
    )

    // System prompt contains the grounding instruction
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('Do not invent or assume any details'),
      }),
    )
  })
})
