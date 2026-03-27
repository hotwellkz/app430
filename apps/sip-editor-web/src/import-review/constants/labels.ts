import type { ImportRequiredDecision } from '@2wix/shared-types';

/** Человеко-понятные подписи для UI AI Import Review (не зашивать в JSX). */
export const IMPORT_REVIEW_UI = {
  panelTitle: 'AI Import Review',
  refresh: 'Обновить',
  selectJob: 'Выберите import-job',
  noJobs: 'Нет import-jobs для этого проекта.',
  loadingJobs: 'Загрузка списка import-jobs…',
  loadingDetail: 'Загрузка job…',
  noSelection: 'Выберите job в списке выше.',
  jobSummaryTitle: 'Сводка',
  requiredDecisionsTitle: 'Обязательные решения',
  issuesTitle: 'Неразрешённые и блокирующие',
  actionsTitle: 'Действия',
  saveDraft: 'Сохранить черновик review',
  applyReview: 'Применить review',
  prepareCandidate: 'Подготовить candidate',
  applyCandidate: 'Применить candidate к проекту',
  retry: 'Повторить',
  sourceImages: 'Исходных изображений',
  unresolved: 'Неразрешённых issues',
  missingDecisions: 'Незаполненных обязательных решений',
  blockingRemaining: 'Оставшихся blocking issues',
  readyToApply: 'Готово к apply-review',
  yes: 'да',
  no: 'нет',
  extractionBadge: 'Экстракция',
  reviewBadge: 'Review',
  candidateBadge: 'Candidate',
  projectApplyBadge: 'Проект',
  reviewReadiness: 'Готовность review',
  lastResult: 'Результат последнего действия',
  concurrencyHint:
    'Конфликт версии: модель в редакторе устарела относительно сервера. Сохраните или перезагрузите проект и повторите.',
  internalBearingSectionTitle: 'Внутренние несущие стены',
  internalBearingModeNo: 'Нет',
  internalBearingModeYes: 'Да, выбрать стены',
  internalBearingSelectedCount: (n: number) => `Выбрано: ${n}`,
  internalBearingEmptyCandidates:
    'В snapshot нет стен для выбора. Укажите «Нет» или дождитесь корректного импорта.',
  internalBearingWallListHint: 'Отметьте стены, которые считаете внутренними несущими.',
} as const;

/** Read-only блок «Сводка импорта» в панели AI Import Review. */
export const IMPORT_SUMMARY_UI = {
  sectionTitle: 'Сводка импорта',
  savedDecisionsTitle: 'Сохранённые решения review',
  candidateTitle: 'Candidate (подготовка к редактированию)',
  projectApplyTitle: 'Применение в проект',
  badgeExtraction: 'Экстракция',
  badgeReview: 'Review',
  badgeCandidatePrep: 'Подготовка candidate',
  badgeProject: 'Проект',
  floorHeightsPrefix: 'Этажи: ',
  roofPrefix: 'Тип крыши: ',
  scalePrefix: 'Масштаб: ',
  internalBearingPrefix: 'Внутренние несущие: ',
  internalBearingNo: 'нет',
  internalBearingYesCount: (n: number) => `да, стен: ${n}`,
  moreWalls: (n: number) => `+${n} ещё`,
  issueResolutionsPrefix: 'Разрешений blocking issues: ',
  hintNoReview: 'Review ещё не начат — сохраните черновик на сервере.',
  hintNoSavedDecisions: 'Решения пока не сохранены на сервере.',
  hintDecisionsEmpty: 'В сохранённом review нет заполненных полей решений.',
  candidateStatusLabel: 'Статус candidate',
  countsLabel: 'Объёмы модели',
  warningsTraceLabel: 'Предупреждения и trace',
  mapperVersionLabel: 'Версия mapper',
  generatedAtLabel: 'Сгенерировано',
  errorLabel: 'Ошибка',
  hintReviewNotAppliedForCandidate: 'Review ещё не применён к snapshot — candidate недоступен.',
  hintCandidateNotPrepared: 'Candidate ещё не подготовлен.',
  hintNotAppliedToProject: 'В проект ещё не применяли.',
  hintProjectAppliedNoDetails: 'Применение зафиксировано; подробный summary недоступен.',
  appliedVersionNumberLabel: 'Версия №',
  appliedVersionIdLabel: 'ID версии',
  appliedAtLabel: 'Применено',
  appliedByLabel: 'Кем',
  objectCountsLabel: 'Объекты в версии',
  warningsTraceShortLabel: 'Предупреждения / trace',
  basedOnMapperLabel: 'Mapper (источник)',
  noteLabel: 'Заметка',
  copySummaryButton: 'Скопировать сводку',
  copySummarySuccess: 'Сводка скопирована',
  copySummaryError: 'Не удалось скопировать. Проверьте разрешения браузера.',
} as const;

export const IMPORT_JOB_STATUS_LABELS: Record<string, string> = {
  queued: 'В очереди',
  running: 'Выполняется',
  needs_review: 'Нужен review',
  failed: 'Ошибка',
};

export const IMPORT_REVIEW_STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  complete: 'Заполнено',
  applied: 'Применён',
};

export const IMPORT_APPLY_STATUS_LABELS: Record<string, string> = {
  not_ready: 'Не готово',
  ready: 'Готово к apply',
  applied: 'Применено',
};

export const IMPORT_EDITOR_APPLY_STATUS_LABELS: Record<string, string> = {
  draft: 'Не подготовлен',
  candidate_ready: 'Candidate готов',
  failed: 'Ошибка подготовки',
};

export const IMPORT_PROJECT_APPLY_STATUS_LABELS: Record<string, string> = {
  draft: 'Не применялся',
  applied: 'Применён в проект',
  failed: 'Ошибка применения',
};

export const REQUIRED_DECISION_LABELS: Record<ImportRequiredDecision['code'], string> = {
  FLOOR_HEIGHTS_REQUIRED: 'Высоты этажей',
  ROOF_TYPE_CONFIRMATION_REQUIRED: 'Тип крыши',
  INTERNAL_BEARING_WALLS_CONFIRMATION_REQUIRED: 'Внутренние несущие стены',
  INTERNAL_BEARING_WALL_IDS_REQUIRED: 'Выбор стен (несущие)',
  INTERNAL_BEARING_WALL_CANDIDATES_UNAVAILABLE: 'Нет стен в snapshot',
  SCALE_DECISION_REQUIRED: 'Масштаб',
  SCALE_OVERRIDE_VALUE_REQUIRED: 'Значение mm/px для override',
  BLOCKING_ISSUES_RESOLUTION_REQUIRED: 'Разрешение blocking issues',
};

export const REQUIRED_DECISION_HINTS: Partial<Record<ImportRequiredDecision['code'], string>> = {
  FLOOR_HEIGHTS_REQUIRED: 'Укажите высоту (мм) для каждого этажа из snapshot.',
  ROOF_TYPE_CONFIRMATION_REQUIRED: 'Подтвердите тип крыши, если он есть в snapshot.',
  INTERNAL_BEARING_WALLS_CONFIRMATION_REQUIRED:
    'Подтвердите наличие/отсутствие внутренних несущих стен.',
  INTERNAL_BEARING_WALL_IDS_REQUIRED:
    'При ответе «да» отметьте хотя бы одну стену из списка.',
  INTERNAL_BEARING_WALL_CANDIDATES_UNAVAILABLE:
    'В импортированном snapshot нет стен для выбора — нельзя подтвердить «да» без данных.',
  SCALE_DECISION_REQUIRED: 'Подтвердите авто-масштаб или задайте override.',
  SCALE_OVERRIDE_VALUE_REQUIRED: 'Для режима override укажите положительный mmPerPixel.',
  BLOCKING_ISSUES_RESOLUTION_REQUIRED:
    'Для каждого blocking issue выберите действие (например, подтвердить).',
};

export const ISSUE_SEVERITY_LABELS: Record<string, string> = {
  warning: 'Предупреждение',
  blocking: 'Блокирующий',
};

export const ROOF_TYPE_OPTIONS: { value: 'gabled' | 'single-slope' | 'unknown'; label: string }[] = [
  { value: 'gabled', label: 'Двускатная' },
  { value: 'single-slope', label: 'Односкатная' },
  { value: 'unknown', label: 'Неизвестно' },
];

export const SCALE_MODE_OPTIONS: { value: 'confirmed' | 'override'; label: string }[] = [
  { value: 'confirmed', label: 'Подтвердить авто-масштаб' },
  { value: 'override', label: 'Override (mm/px)' },
];

export const ISSUE_RESOLUTION_OPTIONS: { value: 'confirm' | 'exclude' | 'override' | 'manual'; label: string }[] =
  [
    { value: 'confirm', label: 'Подтвердить' },
    { value: 'exclude', label: 'Исключить' },
    { value: 'override', label: 'Override' },
    { value: 'manual', label: 'Вручную' },
  ];
