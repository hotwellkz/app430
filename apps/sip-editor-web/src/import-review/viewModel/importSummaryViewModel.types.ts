export type ImportSummaryBadgeTone = 'neutral' | 'ok' | 'warn' | 'bad';

/** Бейдж одного шага pipeline (экстракция / review / candidate / проект). */
export interface ImportSummaryBadgeViewModel {
  key: string;
  label: string;
  text: string;
  tone: ImportSummaryBadgeTone;
}

export interface ImportSummaryKeyValueLine {
  label: string;
  value: string;
}

/** Read-only сводка импорта для панели AI Import Review. */
export interface ImportSummaryViewModel {
  sectionTitle: string;
  pipelineBadges: ImportSummaryBadgeViewModel[];
  savedDecisions: {
    title: string;
    lines: string[];
    hint: string | null;
  };
  candidate: {
    title: string;
    lines: ImportSummaryKeyValueLine[];
    hint: string | null;
  };
  projectApply: {
    title: string;
    lines: ImportSummaryKeyValueLine[];
    hint: string | null;
  };
}
