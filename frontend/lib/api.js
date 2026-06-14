'use client';
// Tiny API client. Stores the JWT in localStorage and attaches it to requests.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('cc_token');
}
export function getUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('cc_user');
  return raw ? JSON.parse(raw) : null;
}
export function setSession(token, user) {
  localStorage.setItem('cc_token', token);
  localStorage.setItem('cc_user', JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem('cc_token');
  localStorage.removeItem('cc_user');
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
