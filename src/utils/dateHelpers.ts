export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export function startOfYesterday(): string {
  return `${yesterdayISO()}T00:00:00.000Z`;
}

export function startOfToday(): string {
  return `${todayISO()}T00:00:00.000Z`;
}

export function todayFormatted(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}
