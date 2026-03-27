export type RequiredDecisionControlType =
  | 'floorHeightMm'
  | 'select'
  | 'boolean'
  | 'scaleMode'
  | 'number'
  | 'issueResolution';

export interface RequiredDecisionFieldViewModel {
  key: string;
  label: string;
  description?: string;
  controlType: RequiredDecisionControlType;
  value: unknown;
  isRequired: boolean;
  isMissing: boolean;
  options?: { value: string; label: string }[];
  /** Для floorHeight — id этажа */
  floorId?: string;
  /** Для issue resolution — id issue */
  issueId?: string;
}

export interface IssueViewModel {
  id: string;
  code: string;
  severity: string;
  severityLabel: string;
  title: string;
  subtitle: string;
  relatedIdsLabel: string;
}

export interface ImportReviewJobViewModel {
  id: string;
  createdAtLabel: string;
  jobIdShort: string;
  extractionStatus: string;
  extractionStatusLabel: string;
  reviewStatus: string;
  reviewStatusLabel: string;
  candidateStatus: string;
  candidateStatusLabel: string;
  projectApplyStatus: string;
  projectApplyStatusLabel: string;
  sourceImagesCount: number;
  unresolvedCount: number;
  missingRequiredDecisionsCount: number;
  remainingBlockingIssuesCount: number;
  isReadyToApply: boolean;
  canSaveReview: boolean;
  canApplyReview: boolean;
  canPrepareCandidate: boolean;
  canApplyCandidate: boolean;
  requiredFields: RequiredDecisionFieldViewModel[];
  issues: IssueViewModel[];
  errorMessage: string | null;
  /** Краткая строка для header выбранного job */
  headerStatusLine: string;
}

export interface ImportReviewJobListItemViewModel {
  id: string;
  createdAtLabel: string;
  jobIdShort: string;
  extractionStatus: string;
  extractionStatusLabel: string;
  reviewStatus: string;
  reviewStatusLabel: string;
}

export type PanelStatusKind = 'idle' | 'loading' | 'error' | 'success' | 'warning';

export interface ImportReviewPanelMessage {
  kind: PanelStatusKind;
  title: string;
  detail?: string;
  code?: string;
}
