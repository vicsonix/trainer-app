import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { log } from '@/lib/logger'

export const MAX_CONTEXT_CHARS = 8000

let _anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
    _anthropic = new Anthropic({ apiKey })
  }
  return _anthropic
}

type Message = { role: 'user' | 'assistant'; content: string }

export async function POST(request: NextRequest): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    log('warn', 'ai_chat_unauthorized')
    return new Response('Unauthorized', { status: 401 })
  }

  let messages: Message[]
  let context: string

  try {
    const body = await request.json()
    messages = body.messages
    context = typeof body.context === 'string' ? body.context : ''
  } catch (err) {
    log('warn', 'ai_chat_invalid_body', { error: err instanceof Error ? err.message : String(err) })
    return new Response('Invalid JSON', { status: 400 })
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('messages must be a non-empty array', { status: 400 })
  }

  const originalContextLength = context.length
  context = context.slice(0, MAX_CONTEXT_CHARS)
  if (context.length < originalContextLength) {
    log('info', 'ai_chat_context_truncated', { originalLength: originalContextLength, truncatedTo: MAX_CONTEXT_CHARS })
  }

  const systemPrompt =
    `You are a personal fitness trainer assistant. You have access to the following client information:\n\n${context}\n\nAnswer questions based ONLY on the information provided above. If the answer is not in the client data, say so clearly. Do not invent or assume any details about the client.`

  const streamResponse = getAnthropicClient().messages.stream({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of streamResponse) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta' &&
            event.delta.text
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`)
            )
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Stream error'
        log('error', 'ai_chat_stream_error', { message })
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`)
        )
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
}
