export function normalizeBookCode(code: string | number | undefined | null): string {
  if (code === undefined || code === null) return '';
  return String(code).trim().toUpperCase();
}

export function normalizeTrackingId(id: string | number | undefined | null): string {
  if (id === undefined || id === null) return '';
  return String(id).trim().toUpperCase();
}

export function normalizeMobileNumber(mobile: string | number | undefined | null): string {
  if (mobile === undefined || mobile === null) return '';
  // Convert number or string to string, preserving leading zeroes
  return String(mobile).trim();
}

export function normalizeEmail(email: string | undefined | null): string | null {
  if (!email) return null;
  const trimmed = String(email).trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}
