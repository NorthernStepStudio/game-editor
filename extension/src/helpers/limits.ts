export function clampMinimum(value: number, minimum: number): number {
  return Math.max(minimum, Math.trunc(value));
}

export function limitItems<T>(items: readonly T[], limit: number): T[] {
  return items.slice(0, Math.max(0, limit));
}
