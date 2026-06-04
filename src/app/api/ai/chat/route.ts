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
  const context = await buildTrainerContext(supabase, user.id)

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
