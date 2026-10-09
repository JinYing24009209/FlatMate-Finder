const pad = (value) => String(value).padStart(2, '0');

export function formatDate(value, fallback = '—') {
  if (!value) return fallback;
  const literal = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (literal) return `${literal[1]}-${literal[2]}-${literal[3]}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback
    : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
