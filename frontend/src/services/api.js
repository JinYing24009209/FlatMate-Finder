const apiBase = import.meta.env.VITE_API_URL || '/api';
export async function api(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({ message: 'Invalid server response.' }));
  if (response.status === 401 && !['/auth/login', '/auth/register'].includes(path))
    window.dispatchEvent(new CustomEvent('session-invalid', { detail: data.message }));
  if (!response.ok) throw new Error(data.message || 'Request failed.');
  return data;
}
