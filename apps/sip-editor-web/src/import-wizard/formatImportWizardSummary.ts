import type { ImportWizardFormValues, WizardFileItem } from './importWizardTypes';

const ROOF: Record<string, string> = {
  gabled: 'двускатная',
  'single-slope': 'односкатная',
  unknown: 'не уверен / уточню в review',
};

const BEARING: Record<string, string> = {
  none: 'нет внутренних несущих',
  confirm_in_review: 'есть — уточню в review',
  unsure: 'не уверен',
};

export function formatImportWizardSummary(files: WizardFileItem[], form: ImportWizardFormValues): string {
  const byKind = (k: WizardFileItem['kind']) => files.filter((f) => f.kind === k).length;
  const lines: string[] = [];
  lines.push(`Файлов: ${files.length} (план: ${byKind('plan')}, фасад: ${byKind('facade')}, прочее: ${byKind('other')})`);
  lines.push(`Этажность: ${form.floorCount}`);
  lines.push(`Высота 1 этажа: ${Math.round(form.floor1HeightMm)} мм`);
  if (form.floorCount === 2) lines.push(`Высота 2 этажа: ${Math.round(form.floor2HeightMm)} мм`);
  lines.push(`Крыша: ${ROOF[form.roof] ?? form.roof}`);
  lines.push(
    form.scale === 'exact'
      ? `Масштаб: точный, ${Number(form.mmPerPixel)} мм/px`
      : 'Масштаб: без точного значения (подтверждение авто в review)'
  );
  lines.push(`Внутренние несущие: ${BEARING[form.internalBearing] ?? form.internalBearing}`);
  return lines.join('\n');
}
