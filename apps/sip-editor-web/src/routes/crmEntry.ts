/** URL списка SIP-проектов в CRM (guard-экраны). Задайте VITE_CRM_ORIGIN, если редактор на другом origin. */
export function crmSipProjectsUrl(): string {
  const raw = import.meta.env.VITE_CRM_ORIGIN as string | undefined;
  if (typeof raw === 'string' && raw.trim()) {
    return `${raw.replace(/\/$/, '')}/sip-projects`;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/sip-projects`;
  }
  return '/sip-projects';
}
