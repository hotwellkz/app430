import type { ImportSummaryViewModel } from '../viewModel/importSummaryViewModel.types';

/** Заголовок текста для буфера (отличается от заголовка карточки в UI). */
export const CLIPBOARD_SUMMARY_TITLE = 'Сводка AI-импорта';

function safePart(value: string | undefined | null): string {
  if (value == null) return '';
  const s = String(value).trim();
  return s;
}

/** Есть ли что копировать (корректный vm с pipeline). */
export function hasImportSummaryClipboardContent(vm: ImportSummaryViewModel): boolean {
  return Array.isArray(vm.pipelineBadges) && vm.pipelineBadges.length > 0;
}

/**
 * Plain-text сводка для чата / Telegram / саппорта.
 * Источник данных — только ImportSummaryViewModel (без сырых DTO).
 */
export function formatImportSummaryForClipboard(vm: ImportSummaryViewModel): string {
  const lines: string[] = [];

  lines.push(CLIPBOARD_SUMMARY_TITLE);
  lines.push('');
  lines.push('Статусы:');
  for (const b of vm.pipelineBadges) {
    const label = safePart(b.label);
    const text = safePart(b.text);
    lines.push(`• ${label || '—'}: ${text || 'данные недоступны'}`);
  }

  lines.push('');
  lines.push('Решения review:');
  if (vm.savedDecisions.lines.length > 0) {
    for (const raw of vm.savedDecisions.lines) {
      const line = safePart(raw);
      if (line) lines.push(`• ${line}`);
    }
  } else if (vm.savedDecisions.hint) {
    lines.push(`• ${safePart(vm.savedDecisions.hint)}`);
  } else {
    lines.push('• решение не сохранено');
  }

  lines.push('');
  lines.push('Candidate:');
  if (vm.candidate.lines.length > 0) {
    for (const row of vm.candidate.lines) {
      const lab = safePart(row.label);
      const val = safePart(row.value);
      lines.push(`• ${lab || '—'}: ${val || 'данные недоступны'}`);
    }
  } else if (vm.candidate.hint) {
    lines.push(`• ${safePart(vm.candidate.hint)}`);
  } else {
    lines.push('• ещё не подготовлено');
  }

  lines.push('');
  lines.push('Применение в проект:');
  if (vm.projectApply.lines.length > 0) {
    for (const row of vm.projectApply.lines) {
      const lab = safePart(row.label);
      const val = safePart(row.value);
      lines.push(`• ${lab || '—'}: ${val || 'данные недоступны'}`);
    }
  } else if (vm.projectApply.hint) {
    lines.push(`• ${safePart(vm.projectApply.hint)}`);
  } else {
    lines.push('• ещё не применено');
  }

  return lines.join('\n');
}
