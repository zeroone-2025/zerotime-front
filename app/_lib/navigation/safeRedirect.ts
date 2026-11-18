/**
 * Returns `value` only when it is an in-app path that resolves to the current
 * origin; otherwise null. Rejects protocol-relative (`//host`), backslash
 * (`/\host`, which WHATWG URL treats as `//host`), absolute and `javascript:`
 * URLs, so callers can fall back to their own default route.
 */
export function toSafeInternalPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return null;
  }
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const origin = window.location.origin;
    return new URL(value, origin).origin === origin ? value : null;
  } catch {
    return null;
  }
}
