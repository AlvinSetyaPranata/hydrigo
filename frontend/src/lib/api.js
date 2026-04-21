function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL

  if (configured && configured.trim()) {
    return trimTrailingSlash(configured.trim())
  }

  return '/api'
}

export function buildApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${getApiBaseUrl()}${normalizedPath}`
}
