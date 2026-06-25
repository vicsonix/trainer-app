import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  type UIMessage,
} from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildTrainerContext, MAX_CONTEXT_CHARS } from '@/lib/ai/context'
import { makeTools } from '@/lib/ai/tools'
import { embedText } from '@/lib/embeddings'
import { log } from '@/lib/logger'

export { MAX_CONTEXT_CHARS }

export async function POST(request: NextRequest): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    log('warn', 'ai_chat_unauthorized')
    return new Response('Unauthorized', { status: 401 })
  }

  let messages: UIMessage[]

  try {
    const body = await request.json()
    messages = body.messages
  } catch (err) {
    log('warn', 'ai_chat_invalid_body', { error: err instanceof Error ? err.message : String(err) })
    return new Response('Invalid JSON', { status: 400 })
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('messages must be a non-empty array', { status: 400 })
  }

  const tools = makeTools(supabase, user.id)

  let vectorResults: Array<{ id: string; similarity: number }> | undefined
  if (process.env.VOYAGE_API_KEY) {
    try {
      const lastUserText = messages
        .filter(m => m.role === 'user')
        .pop()
        ?.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map(p => p.text)
        .join(' ')
        .trim()

      if (lastUserText) {
        const embedding = await embedText(lastUserText)
        const { data } = await supabase.rpc('match_clients', {
          query_embedding: embedding,
          trainer_uuid: user.id,
          match_threshold: 0.65,
          match_count: 5,
        })
        if (data && data.length > 0) {
          vectorResults = (data as Array<{ id: string; similarity: number }>)
        }
      }
    } catch (err) {
      log('warn', 'vector_search_failed', { error: err instanceof Error ? err.message : String(err) })
    }
  }

  const context = await buildTrainerContext(supabase, user.id, vectorResults)

  const systemPrompt =
    `You are a personal fitness trainer assistant. You have access to the following client information:\n\n${context}\n\nAnswer questions based ONLY on the information provided above. If the answer is not in the client data, say so clearly. Do not invent or assume any details about the client. Respond in Polish by default; switch to the trainer's language only if they write in a different language.`

  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools,
  })

  return createUIMessageStreamResponse({
    stream: result.toUIMessageStream(),
  })
}
