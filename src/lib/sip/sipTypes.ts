/** Метаданные проекта SIP API (совместимо с ответом GET /api/projects). */
export interface SipProjectRow {
  id: string;
  dealId: string | null;
  title: string;
  status: string;
  currentVersionId: string | null;
  currentVersionNumber: number | null;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}
