import { createClient } from '@supabase/supabase-js'
import { embedText, clientToEmbeddingText } from '../lib/embeddings'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function main() {
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, first_name, last_name, interview_notes')
    .is('embedding', null)

  if (error) {
    console.error('Failed to fetch clients:', error.message)
    process.exit(1)
  }

  console.log(`Found ${clients.length} client(s) without embeddings`)

  let ok = 0
  let fail = 0

  for (const client of clients) {
    try {
      const embedding = await embedText(clientToEmbeddingText(client))
      const { error: updateError } = await supabase
        .from('clients')
        .update({ embedding })
        .eq('id', client.id)

      if (updateError) throw new Error(updateError.message)

      console.log(`✓ ${client.first_name} ${client.last_name}`)
      ok++
    } catch (err) {
      console.error(`✗ ${client.first_name} ${client.last_name}:`, err instanceof Error ? err.message : err)
      fail++
    }
  }

  console.log(`\nDone. ${ok} succeeded, ${fail} failed.`)
}

main()
