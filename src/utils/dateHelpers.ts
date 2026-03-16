function getTimezone(): string {
  return process.env.TZ ?? 'America/New_York';
}

function localDateISO(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: getTimezone() }); // en-CA gives YYYY-MM-DD
}

export function todayISO(): string {
  return localDateISO(new Date());
}

export function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateISO(d);
}

export function startOfYesterday(): string {
  return `${yesterdayISO()}T00:00:00.000Z`;
}

export function startOfToday(): string {
  return `${todayISO()}T00:00:00.000Z`;
}

export function todayFormatted(): string {
  return new Date().toLocaleDateString('en-US', {
    timeZone: getTimezone(),
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}
