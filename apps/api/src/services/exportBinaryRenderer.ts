import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { buildExportTables } from '@2wix/export-engine';
import type { ExportFormat, ExportPackageSnapshot } from '@2wix/shared-types';

function bufferFromPdf(snapshot: ExportPackageSnapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(14).text(`SIP Export Report: ${snapshot.projectSummary.projectTitle}`);
    doc.moveDown();
    doc.fontSize(10).text(`Project ID: ${snapshot.projectSummary.projectId}`);
    doc.text(`Version: v${snapshot.projectSummary.versionNumber} (${snapshot.projectSummary.versionId})`);
    doc.text(`Generated: ${new Date(snapshot.generatedAt).toLocaleString('ru-RU')}`);
    doc.moveDown();
    doc.text(`Floors: ${snapshot.projectSummary.floorsCount}`);
    doc.text(`Walls: ${snapshot.specSummary.wallCountIncluded}`);
    doc.text(`Slabs: ${snapshot.specSummary.slabCountIncluded ?? 0}`);
    doc.text(`Roof: ${snapshot.specSummary.roofCountIncluded ?? 0}`);
    doc.text(`Panels: ${snapshot.specSummary.totalPanels}`);
    doc.text(`Trimmed: ${snapshot.specSummary.totalTrimmedPanels}`);
    doc.text(`Area m2: ${snapshot.specSummary.totalPanelAreaM2}`);
    doc.text(`Warnings: ${snapshot.warnings.length}`);
    doc.moveDown();
    doc.fontSize(11).text('Aggregated BOM');
    const rows = buildExportTables(snapshot).bomRows.slice(0, 25);
    doc.fontSize(9);
    for (const r of rows) {
      doc.text(`${r.code} | ${r.name} | ${r.unit}: ${r.qty}`);
    }
    doc.end();
  });
}

export async function renderExportBinary(
  snapshot: ExportPackageSnapshot,
  format: ExportFormat
): Promise<{ buffer: Buffer; mimeType: string }> {
  const tables = buildExportTables(snapshot);
  if (format === 'csv') {
    const headers = Object.keys(tables.bomRows[0] ?? { code: '', name: '', unit: '', qty: '' });
    const lines = [headers.join(',')];
    for (const row of tables.bomRows) {
      lines.push(headers.map((h) => JSON.stringify(String(row[h] ?? ''))).join(','));
    }
    return {
      buffer: Buffer.from(lines.join('\n'), 'utf-8'),
      mimeType: 'text/csv; charset=utf-8',
    };
  }
  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.summaryRows), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.bomRows), 'BOM');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.wallRows), 'Walls');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.slabRows), 'Slabs');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.roofRows), 'Roof');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.warningRows), 'Warnings');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return {
      buffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
  return {
    buffer: await bufferFromPdf(snapshot),
    mimeType: 'application/pdf',
  };
}
