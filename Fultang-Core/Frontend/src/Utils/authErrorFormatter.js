export function normalizeAuthErrorDetail(detail, fallback = 'Identifiants invalides') {
  if (!detail) return fallback;

  if (typeof detail === 'string') {
    const text = detail.trim();
    return text || fallback;
  }

  if (typeof detail === 'object') {
    if (Array.isArray(detail)) {
      const parts = detail.map((item) => normalizeAuthErrorDetail(item, fallback)).filter(Boolean);
      return parts.length ? parts.join(' ') : fallback;
    }

    if (typeof detail.message === 'string' && detail.message.trim()) {
      return detail.message.trim();
    }

    if (typeof detail.error_type === 'string' && detail.error_type.trim()) {
      return detail.message || detail.error_type;
    }

    return JSON.stringify(detail);
  }

  return String(detail) || fallback;
}
