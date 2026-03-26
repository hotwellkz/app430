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
    const mode = snapshot.presentationMode ?? 'technical';
    doc.fontSize(14).text(`SIP Export Report (${mode}): ${snapshot.projectSummary.projectTitle}`);
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
    const tables = buildExportTables(snapshot);
    if (mode === 'commercial') {
      doc.fontSize(11).text('Commercial Sections');
      for (const r of tables.sectionRows.slice(0, 20)) {
        doc.fontSize(9).text(`${r.code} | ${r.title} | qty: ${r.totalQty} | area: ${r.totalAreaM2}`);
      }
      doc.moveDown();
      doc.fontSize(11).text('Commercial Items');
      for (const r of tables.commercialRows.slice(0, 25)) {
        doc.fontSize(9).text(`${r.code} | ${r.name} | ${r.unit}: ${r.qty}`);
      }
      doc.moveDown();
      doc.fontSize(11).text('Warnings Summary');
      for (const r of tables.warningRows.slice(0, 10)) {
        doc.fontSize(9).text(`${r.code}: ${r.message}`);
      }
      doc.end();
      return;
    }
    doc.fontSize(11).text('Aggregated BOM');
    const rows = tables.bomRows.slice(0, 25);
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
    const baseRows = tables.presentationMode === 'commercial' ? tables.commercialRows : tables.bomRows;
    const headers = Object.keys(baseRows[0] ?? { code: '', name: '', unit: '', qty: '' });
    const lines = [headers.join(',')];
    for (const row of baseRows) {
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
    if (tables.presentationMode === 'commercial') {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.commercialRows), 'Commercial');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.sectionRows), 'Sections');
    } else {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.bomRows), 'BOM');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.wallRows), 'Walls');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.slabRows), 'Slabs');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tables.roofRows), 'Roof');
    }
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
