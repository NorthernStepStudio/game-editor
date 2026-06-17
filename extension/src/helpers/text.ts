export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function extractCodeFence(value: string): string | undefined {
  const match = value.match(/```(?:[\w-]+)?\r?\n([\s\S]*?)```/);
  return match?.[1]?.trim();
}
