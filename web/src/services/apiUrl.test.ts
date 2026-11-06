import { describe, expect, it } from 'vitest';
import { joinApiUrl } from './apiUrl';

describe('joinApiUrl', () => {
  it('keeps same-origin /api when the build leaves the base empty', () => {
    expect(joinApiUrl('', '/api/chat/channels')).toBe('/api/chat/channels');
  });

  it('does not double the /api prefix used by the Hosting rewrite', () => {
    expect(joinApiUrl('/api', '/api/chat/channels')).toBe('/api/chat/channels');
    expect(joinApiUrl('/api/', '/chat/channels')).toBe('/api/chat/channels');
  });

  it('appends /api once when the base is a Cloud Run origin', () => {
    const origin = 'https://dispatch-api-337919645491.northamerica-northeast1.run.app';
    expect(joinApiUrl(origin, '/api/chat/channels')).toBe(`${origin}/api/chat/channels`);
    expect(joinApiUrl(`${origin}/api`, '/chat/channels')).toBe(`${origin}/api/chat/channels`);
  });

  it('leaves absolute endpoints unchanged', () => {
    expect(joinApiUrl('/api', 'https://example.com/health')).toBe('https://example.com/health');
  });
});
