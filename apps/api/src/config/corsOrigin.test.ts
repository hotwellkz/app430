import { describe, expect, it } from 'vitest';
import { isNetlifySiteOriginAllowed } from './corsOrigin.js';

describe('isNetlifySiteOriginAllowed', () => {
  it('отклоняет при пустом slug', () => {
    expect(isNetlifySiteOriginAllowed('https://x--mysite.netlify.app', null)).toBe(false);
    expect(isNetlifySiteOriginAllowed('https://x--mysite.netlify.app', '  ')).toBe(false);
  });

  it('разрешает production и deploy preview для slug', () => {
    const slug = 'papaya-seahorse-f4694d';
    expect(isNetlifySiteOriginAllowed(`https://${slug}.netlify.app`, slug)).toBe(true);
    expect(
      isNetlifySiteOriginAllowed('https://69c51ac08748eec65c0f5f43--papaya-seahorse-f4694d.netlify.app', slug)
    ).toBe(true);
  });

  it('разрешает branch deploy', () => {
    const slug = 'papaya-seahorse-f4694d';
    expect(isNetlifySiteOriginAllowed('https://feat-x--papaya-seahorse-f4694d.netlify.app', slug)).toBe(true);
  });

  it('отклоняет чужой Netlify-сайт', () => {
    expect(isNetlifySiteOriginAllowed('https://other-site.netlify.app', 'papaya-seahorse-f4694d')).toBe(false);
    expect(
      isNetlifySiteOriginAllowed('https://abc--other-site.netlify.app', 'papaya-seahorse-f4694d')
    ).toBe(false);
  });

  it('отклоняет http и невалидный URL', () => {
    expect(isNetlifySiteOriginAllowed('http://papaya-seahorse-f4694d.netlify.app', 'papaya-seahorse-f4694d')).toBe(
      false
    );
    expect(isNetlifySiteOriginAllowed('not-a-url', 'papaya-seahorse-f4694d')).toBe(false);
  });
});
