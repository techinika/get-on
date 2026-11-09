export type AgentStreamEvent =
  | "message"
  | "status"
  | "delta"
  | "done"
  | "error";

export function encodeSse(event: AgentStreamEvent, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function chunkText(text: string, size = 32): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks;
}
