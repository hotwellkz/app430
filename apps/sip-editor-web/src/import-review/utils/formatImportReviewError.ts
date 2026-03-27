import { SipApiError } from '@/api/http';

export interface FormattedImportReviewError {
  title: string;
  detail: string;
  code?: string;
}

export function formatImportReviewError(error: unknown, fallbackTitle: string): FormattedImportReviewError {
  if (error instanceof SipApiError) {
    const code = error.apiBody.code;
    const base = error.message;
    const details = error.apiBody.details;
    let extra = '';
    if (details && typeof details === 'object') {
      const d = details as Record<string, unknown>;
      if (Array.isArray(d.missingRequiredDecisions)) {
        extra = ` · missing: ${d.missingRequiredDecisions.length}`;
      }
      if (code === 'IMPORT_APPLY_CONCURRENCY_CONFLICT' || error.status === 409) {
        extra = extra || '';
      }
    }
    return {
      title: fallbackTitle,
      detail: `${base}${extra}${error.apiBody.requestId ? ` (requestId: ${error.apiBody.requestId})` : ''}`,
      code,
    };
  }
  if (error instanceof Error) {
    return { title: fallbackTitle, detail: error.message };
  }
  return { title: fallbackTitle, detail: String(error) };
}
