'use server'

import type { UIMessage } from 'ai'
import { createClient } from '@/lib/supabase/server'

export async function createConversationAction(
  firstMessage: string,
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesja wygasła' }

  const title = firstMessage.slice(0, 60)
  const { data, error } = await supabase
    .from('conversations')
    .insert({ trainer_id: user.id, title })
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { id: data.id }
}

export async function saveMessageAction(
  conversationId: string,
  message: UIMessage,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      content: message as unknown as Record<string, unknown>,
    })

  // Bump conversation updated_at so it floats to top of list
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('trainer_id', user.id)
}

export async function loadConversationAction(
  conversationId: string,
): Promise<UIMessage[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('conversation_messages')
    .select('content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  return (data ?? []).map((row) => row.content as unknown as UIMessage)
}

export async function listConversationsAction(): Promise<
  Array<{ id: string; title: string; updated_at: string }>
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('conversations')
    .select('id, title, updated_at')
    .eq('trainer_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  return data ?? []
}

export async function renameConversationAction(
  id: string,
  title: string,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('trainer_id', user.id)
}

export async function deleteConversationAction(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('conversations')
    .delete()
    .eq('id', id)
    .eq('trainer_id', user.id)
}
