import { describe, expect, it } from 'vitest';
import { createEmptyBuildingModel } from '@2wix/domain-model';
import type { ImportJob } from '@2wix/shared-types';
import { mapImportSummaryViewModel } from '../viewModel/importSummaryMapper';
import type { ImportSummaryViewModel } from '../viewModel/importSummaryViewModel.types';
import {
  CLIPBOARD_SUMMARY_TITLE,
  formatImportSummaryForClipboard,
  hasImportSummaryClipboardContent,
} from './formatImportSummaryForClipboard';

function jobBase(over: Partial<ImportJob> = {}): ImportJob {
  return {
    id: 'j1',
    projectId: 'p1',
    status: 'needs_review',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'u1',
    importSchemaVersion: 1,
    sourceImages: [],
    snapshot: {
      projectMeta: {},
      floors: [
        { id: 'f1', label: '1 этаж' },
        { id: 'f2', label: '2 этаж' },
      ],
      walls: [],
      openings: [],
      stairs: [],
      unresolved: [],
      notes: [],
    },
    errorMessage: null,
    ...over,
  };
}

function assertNoNullTokens(text: string) {
  expect(text).not.toMatch(/\bundefined\b/);
  expect(text).not.toMatch(/\bnull\b/);
}

describe('formatImportSummaryForClipboard', () => {
  it('возвращает структурированный текст со статусами и без undefined/null', () => {
    const vm = mapImportSummaryViewModel(jobBase({ review: undefined }));
    const text = formatImportSummaryForClipboard(vm);
    expect(text.startsWith(CLIPBOARD_SUMMARY_TITLE)).toBe(true);
    expect(text).toMatch(/Статусы:/);
    expect(text).toMatch(/Экстракция:/);
    expect(text).toMatch(/Решения review:/);
    expect(text).toMatch(/Candidate:/);
    expect(text).toMatch(/Применение в проект:/);
    assertNoNullTokens(text);
  });

  it('решения review: высоты, крыша, масштаб, несущие, blocking count', () => {
    const vm = mapImportSummaryViewModel(
      jobBase({
        review: {
          status: 'applied',
          applyStatus: 'applied',
          decisions: {
            floorHeightsMmByFloorId: { f1: 2800, f2: 2500 },
            roofTypeConfirmed: 'gabled',
            scale: { mode: 'confirmed' },
            internalBearingWalls: { confirmed: true, wallIds: ['w1', 'w2'] },
            issueResolutions: [{ issueId: 'a' }, { issueId: 'b' }, { issueId: 'c' }],
          },
          missingRequiredDecisions: [],
          remainingBlockingIssueIds: [],
          isReadyToApply: true,
        },
      })
    );
    const text = formatImportSummaryForClipboard(vm);
    expect(text).toMatch(/Этажи:/);
    expect(text).toMatch(/Двускатная/);
    expect(text).toMatch(/Подтвердить авто-масштаб/);
    expect(text).toMatch(/несущие/);
    expect(text).toMatch(/Разрешений blocking issues: 3/);
    assertNoNullTokens(text);
  });

  it('без candidate и projectApply — fallback-строки', () => {
    const vm = mapImportSummaryViewModel(
      jobBase({
        review: {
          status: 'draft',
          applyStatus: 'not_ready',
          decisions: { floorHeightsMmByFloorId: { f1: 3000 } },
          missingRequiredDecisions: [],
          remainingBlockingIssueIds: [],
          isReadyToApply: false,
        },
      })
    );
    const text = formatImportSummaryForClipboard(vm);
    expect(text).toMatch(/candidate недоступен|ещё не подготовлено/);
    expect(text).toMatch(/не применяли|ещё не применено/);
    assertNoNullTokens(text);
  });

  it('candidate и project apply с деталями', () => {
    const model = createEmptyBuildingModel();
    model.floors = [
      { id: 'a', label: 'F1', elevationMm: 0, sortOrder: 0 },
      { id: 'b', label: 'F2', elevationMm: 3000, sortOrder: 1 },
    ];
    model.walls = Array.from({ length: 14 }, (_, i) => ({
      id: `wall-${i}`,
      floorId: 'a',
      type: 'exterior',
      geometry: { kind: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
    })) as typeof model.walls;
    model.openings = Array.from({ length: 9 }, (_, i) => ({
      id: `o-${i}`,
      wallId: 'wall-0',
      kind: 'window',
      geometry: { kind: 'rect', widthMm: 1000, heightMm: 1200, sillMm: 900 },
    })) as typeof model.openings;

    const vm = mapImportSummaryViewModel(
      jobBase({
        review: {
          status: 'applied',
          applyStatus: 'applied',
          decisions: {},
          missingRequiredDecisions: [],
          remainingBlockingIssueIds: [],
          isReadyToApply: true,
        },
        editorApply: {
          status: 'candidate_ready',
          candidate: {
            model,
            warnings: [{ code: 'w1' }, { code: 'w2' }],
            trace: Array.from({ length: 18 }, (_, i) => ({ step: i, message: 'x' })),
            mapperVersion: 'v1',
            generatedAt: '2026-03-27T14:22:00.000Z',
            basedOnImportJobId: 'j1',
            basedOnReviewedSnapshotVersion: 'rs',
            status: 'ready',
          },
        },
        projectApply: {
          status: 'applied',
          appliedVersionNumber: 12,
          appliedVersionId: 'abc123',
          appliedAt: '2026-03-27T14:25:00.000Z',
          appliedBy: 'ivan',
          note: 'candidate applied after review',
          summary: {
            createdOrUpdatedVersionId: 'abc123',
            appliedObjectCounts: { floors: 2, walls: 14, openings: 9, slabs: 0, roofs: 1 },
            warningsCount: 2,
            traceCount: 18,
            basedOnImportJobId: 'j1',
            basedOnMapperVersion: 'mv1',
            basedOnReviewedSnapshotVersion: 'rs',
          },
        },
      })
    );
    const text = formatImportSummaryForClipboard(vm);
    expect(text).toMatch(/этажей 2/);
    expect(text).toMatch(/стен 14/);
    expect(text).toMatch(/проёмов 9/);
    expect(text).toMatch(/Версия №/);
    expect(text).toMatch(/12/);
    expect(text).toMatch(/Заметка/);
    expect(text).toMatch(/candidate applied after review/);
    assertNoNullTokens(text);
  });

  it('hasImportSummaryClipboardContent: false без badges', () => {
    const empty: ImportSummaryViewModel = {
      sectionTitle: 'Сводка импорта',
      pipelineBadges: [],
      savedDecisions: { title: 'x', lines: [], hint: null },
      candidate: { title: 'c', lines: [], hint: null },
      projectApply: { title: 'p', lines: [], hint: null },
    };
    expect(hasImportSummaryClipboardContent(empty)).toBe(false);
  });

  it('hasImportSummaryClipboardContent: true при обычном vm', () => {
    const vm = mapImportSummaryViewModel(jobBase());
    expect(hasImportSummaryClipboardContent(vm)).toBe(true);
  });
});
