/** Unique id for filter rows and ephemeral UI keys */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}
