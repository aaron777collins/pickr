const MATCH_THRESHOLD = 0.6;

function decodeEmbedding(b64: string): Float64Array {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Float64Array(bytes.buffer);
}

function cosineSimilarity(a: Float64Array, b: Float64Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function cosineMatch(embA: string, embB: string): boolean {
  return cosineSimilarity(decodeEmbedding(embA), decodeEmbedding(embB)) > MATCH_THRESHOLD;
}
