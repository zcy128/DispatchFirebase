// Join the build-time API origin with a request path.
// Production leaves the origin empty so the browser calls same-origin /api,
// and Firebase Hosting rewrites /api/** to Cloud Run.
// Paths from callers already start with /api. A base of /api must not be
// prefixed again, or Hosting receives /api/api/... and Cloud Run returns 404.
export function joinApiUrl(base: string, endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  let path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (!path.startsWith('/api/') && path !== '/api') {
    path = `/api${path}`;
  }

  const normalizedBase = base.trim().replace(/\/+$/, '');
  if (!normalizedBase) {
    return path;
  }

  if (normalizedBase === '/api' || normalizedBase.endsWith('/api')) {
    return `${normalizedBase.slice(0, -'/api'.length)}${path}`;
  }

  return `${normalizedBase}${path}`;
}
