/**
 * Имена коллекций изолированы от CRM, чтобы не пересечься с существующими документами.
 * Логическая модель: projects + projectVersions (см. docs/technical-decisions.md).
 */
export const COLLECTIONS = {
  PROJECTS: 'sipEditor_projects',
  PROJECT_VERSIONS: 'sipEditor_projectVersions',
  PROJECT_EXPORTS: 'sipEditor_projectExports',
} as const;
