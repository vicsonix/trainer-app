-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Embedding column on clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(512);

-- IVFFlat index (lists=1 is correct for ≤20 rows; re-tune to sqrt(row_count) when dataset grows)
CREATE INDEX IF NOT EXISTS clients_embedding_idx
  ON public.clients
  USING ivfflat (embedding extensions.vector_cosine_ops)
  WITH (lists = 1);

-- Semantic client search scoped to a trainer
CREATE OR REPLACE FUNCTION match_clients(
  query_embedding extensions.vector(512),
  trainer_uuid    uuid,
  match_threshold float DEFAULT 0.65,
  match_count     int   DEFAULT 5
)
RETURNS TABLE (
  id              uuid,
  first_name      text,
  last_name       text,
  interview_notes text,
  similarity      float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.first_name,
    c.last_name,
    c.interview_notes,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.clients c
  WHERE
    c.trainer_id = trainer_uuid
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
