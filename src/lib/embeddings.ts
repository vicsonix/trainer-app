export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new Error('VOYAGE_API_KEY is not set')

  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: 'voyage-3-lite', input: text }),
  })

  if (!response.ok) {
    throw new Error(`Voyage AI error: ${response.status} ${response.statusText}`)
  }

  const json = await response.json() as { data: Array<{ embedding: number[] }> }
  return json.data[0].embedding
}

export function clientToEmbeddingText(client: {
  first_name: string
  last_name: string
  interview_notes: string | null
}): string {
  return `${client.first_name} ${client.last_name}\n${client.interview_notes ?? ''}`
}
