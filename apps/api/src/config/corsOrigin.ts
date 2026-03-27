/**
 * Разрешает origin’ы Netlify для одного сайта: production `slug.netlify.app`
 * и превью/ветки `*--slug.netlify.app`.
 */
export function isNetlifySiteOriginAllowed(origin: string, siteSlug: string | null | undefined): boolean {
  const slug = siteSlug?.trim();
  if (!slug) return false;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname;
    return h === `${slug}.netlify.app` || h.endsWith(`--${slug}.netlify.app`);
  } catch {
    return false;
  }
}
