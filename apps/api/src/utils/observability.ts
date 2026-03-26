type Level = 'info' | 'warn';

function write(level: Level, payload: Record<string, unknown>): void {
  const line = JSON.stringify(payload);
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.info(line);
}

export function logObservabilityEvent(event: string, payload: Record<string, unknown>, level: Level = 'info'): void {
  write(level, {
    event,
    ...payload,
    at: new Date().toISOString(),
  });
}
