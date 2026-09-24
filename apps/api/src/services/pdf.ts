import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

// Desde src/services (dev y tests) o desde dist (bundle de producción).
const fontsDir = ['../../assets/fonts/', '../assets/fonts/']
  .map((rel) => fileURLToPath(new URL(rel, import.meta.url)))
  .find((dir) => existsSync(`${dir}IBMPlexSans-Regular.ttf`));
if (!fontsDir) throw new Error('No se encontraron las fuentes para generar PDF (apps/api/assets/fonts)');
const FONTS = {
  sans: `${fontsDir}IBMPlexSans-Regular.ttf`,
  bold: `${fontsDir}IBMPlexSans-SemiBold.ttf`,
  mono: `${fontsDir}IBMPlexMono-Medium.ttf`,
};

const INK = '#2B2420';
const MUTED = '#5F544B';
const LINE = '#BFB3A3';
const BASE = '#F5F0E8';
const MARGIN = 42;

export interface SheetRow { label: string; section: string | null; realLabel: string | null; realValue: number | null; formula: string; display: string }
export interface SheetPdfData {
  dancerName: string; groupName: string | null; moldName: string; sizeLabel: string | null; sizeOrigin: string | null;
  createdAt: string; measuredOn: string | null; rows: SheetRow[];
  manualInputs: { label: string; value: string }[]; choiceText: string | null; notes: string[];
  images: { buffer: Buffer; filename: string }[];
}
export interface ProductionPdfData {
  groupName: string; generatedAt: string; totalUnits: number;
  byGarment: { moldName: string; total: number; sizes: { label: string; count: number; dancers: string[] }[] }[];
  pending: { name: string; reason: string }[];
}

const fmt = (n: number | null) => (n === null ? '—' : String(n).replace('.', ','));
export const formatDate = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };

function newDoc(title: string) {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true, info: { Title: title, Producer: 'Hilanzapp' } });
  doc.registerFont('sans', FONTS.sans);
  doc.registerFont('bold', FONTS.bold);
  doc.registerFont('mono', FONTS.mono);
  return doc;
}

function finish(doc: PDFKit.PDFDocument, footer: (page: number) => string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const y = doc.page.height - MARGIN + 6;
      doc.font('sans').fontSize(8).fillColor(MUTED);
      doc.page.margins.bottom = 0;
      doc.text(footer(i), MARGIN, y, { width: doc.page.width - 2 * MARGIN - 60, lineBreak: false });
      doc.text(`${i + 1} / ${range.count}`, doc.page.width - MARGIN - 60, y, { width: 60, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}

function drawSheet(doc: PDFKit.PDFDocument, s: SheetPdfData) {
  const W = doc.page.width - 2 * MARGIN;
  const right = doc.page.width - MARGIN;
  let y = MARGIN;

  doc.font('bold').fontSize(8).fillColor(MUTED).text(`HOJA DE MOLDE · ${s.moldName.toUpperCase()}`, MARGIN, y);
  doc.font('bold').fontSize(26).fillColor(INK).text(s.dancerName, MARGIN, y + 14, { width: W - 150 });
  const size = s.sizeLabel ? `talle T${s.sizeLabel}${s.sizeOrigin === 'suggested' ? ' (sugerido)' : ' (a mano)'}` : 'sin talle';
  doc.font('sans').fontSize(10).fillColor(MUTED).text([s.moldName, s.groupName ? `Grupo ${s.groupName}` : null, size, s.choiceText].filter(Boolean).join(' · '), MARGIN, y + 50, { width: W });
  doc.font('bold').fontSize(14).fillColor(INK).text('Hilanzapp', right - 140, y + 4, { width: 140, align: 'right' });
  doc.font('sans').fontSize(8).fillColor(MUTED)
    .text(`Impreso ${formatDate(s.createdAt)}`, right - 140, y + 24, { width: 140, align: 'right' })
    .text(s.measuredOn ? `Medidas tomadas ${formatDate(s.measuredOn)}` : '', right - 140, y + 36, { width: 140, align: 'right' });
  y += 72;
  doc.moveTo(MARGIN, y).lineWidth(1.5).strokeColor(INK).lineTo(right, y).stroke();
  y += 12;

  // Leyenda
  doc.lineWidth(1.2).strokeColor(INK).undash().rect(MARGIN, y + 1, 16, 10).stroke();
  doc.font('sans').fontSize(8).fillColor(MUTED).text('Medida real (cinta)', MARGIN + 22, y + 2);
  doc.dash(3, { space: 2 }).rect(MARGIN + 130, y + 1, 16, 10).stroke().undash();
  doc.text('Resultado calculado', MARGIN + 152, y + 2);
  y += 24;

  const cols = [W * 0.36, W * 0.24, W * 0.2, W * 0.2];
  const header = (yy: number) => {
    doc.rect(MARGIN, yy, W, 20).fillColor(BASE).fill();
    doc.font('bold').fontSize(7.5).fillColor(INK);
    ['PIEZA', 'REAL (CM)', 'FÓRMULA', 'RESULTADO (CM)'].forEach((t, i) => {
      const x = MARGIN + cols.slice(0, i).reduce((a, b) => a + b, 0) + 8;
      doc.text(t, x, yy + 6, { width: cols[i]! - 16, align: i === 3 ? 'right' : 'left', lineBreak: false });
    });
    doc.lineWidth(1.5).strokeColor(INK).rect(MARGIN, yy, W, 20).stroke();
    return yy + 20;
  };

  y = header(y);
  let lastSection: string | null = null;
  for (const r of s.rows) {
    const needSection = r.section && r.section !== lastSection;
    const rowH = 38;
    if (y + rowH + (needSection ? 18 : 0) > doc.page.height - MARGIN - 40) {
      doc.addPage();
      y = header(MARGIN);
    }
    if (needSection) {
      doc.rect(MARGIN, y, W, 18).fillColor(BASE).fill();
      doc.font('bold').fontSize(8).fillColor(MUTED).text(r.section!.toUpperCase(), MARGIN + 8, y + 5, { lineBreak: false });
      y += 18;
    }
    lastSection = r.section;
    doc.font('sans').fontSize(10).fillColor(INK).text(r.label, MARGIN + 8, y + 12, { width: cols[0]! - 16, lineBreak: false, ellipsis: true });

    const x1 = MARGIN + cols[0]!;
    if (r.realValue !== null) {
      doc.lineWidth(1.2).strokeColor(INK).undash().rect(x1 + 8, y + 6, cols[1]! - 24, 26).stroke();
      doc.font('sans').fontSize(6.5).fillColor(MUTED).text(r.realLabel ?? '', x1 + 12, y + 9, { width: cols[1]! - 32, lineBreak: false, ellipsis: true });
      doc.font('bold').fontSize(13).fillColor(INK).text(fmt(r.realValue), x1 + 12, y + 17, { width: cols[1]! - 32, lineBreak: false });
    } else {
      doc.font('sans').fontSize(9).fillColor(MUTED).text('—', x1 + 12, y + 13, { lineBreak: false });
    }
    doc.font('mono').fontSize(10).fillColor(INK).text(r.formula, x1 + cols[1]! + 8, y + 12, { width: cols[2]! - 12, lineBreak: false, ellipsis: true });
    const x3 = MARGIN + cols[0]! + cols[1]! + cols[2]!;
    doc.lineWidth(1.2).strokeColor(INK).dash(3, { space: 2 }).rect(x3 + 12, y + 5, cols[3]! - 24, 28).stroke().undash();
    doc.font('bold').fontSize(17).fillColor(INK).text(r.display, x3 + 12, y + 10, { width: cols[3]! - 32, align: 'right', lineBreak: false });
    doc.lineWidth(0.5).strokeColor(LINE).moveTo(MARGIN, y + rowH).lineTo(right, y + rowH).stroke();
    y += rowH;
  }
  doc.lineWidth(1.5).strokeColor(INK).moveTo(MARGIN, y).lineTo(right, y).stroke();
  y += 16;

  const boxW = (W - 14) / 2;
  const box = (x: number, title: string, lines: string[]) => {
    const h = 22 + Math.max(1, lines.length) * 13;
    if (y + h > doc.page.height - MARGIN - 20) { doc.addPage(); y = MARGIN; }
    doc.lineWidth(0.8).strokeColor(LINE).undash().rect(x, y, boxW, h).stroke();
    doc.font('bold').fontSize(7.5).fillColor(INK).text(title.toUpperCase(), x + 8, y + 7, { lineBreak: false });
    doc.font('sans').fontSize(9).fillColor(INK);
    (lines.length ? lines : ['—']).forEach((l, i) => doc.text(l, x + 8, y + 21 + i * 13, { width: boxW - 16, lineBreak: false, ellipsis: true }));
    return h;
  };
  const h1 = box(MARGIN, 'Campos manuales', s.manualInputs.map((m) => `${m.label}: ${m.value} cm`));
  const h2 = box(MARGIN + boxW + 14, 'Notas', s.notes);
  y += Math.max(h1, h2) + 14;

  if (s.images.length) {
    const room = doc.page.height - MARGIN - 20 - y;
    if (room < 110) { doc.addPage(); y = MARGIN; }
    doc.font('bold').fontSize(7.5).fillColor(INK).text('REFERENCIA DEL DISEÑO', MARGIN, y, { lineBreak: false });
    let x = MARGIN;
    for (const img of s.images.slice(0, 3)) {
      try {
        doc.image(img.buffer, x, y + 14, { fit: [150, 96] });
        x += 160;
      } catch { /* imagen ilegible: se omite */ }
    }
  }
}

export function renderPatternSheets(sheets: SheetPdfData[]): Promise<Buffer> {
  const doc = newDoc(sheets.length === 1 ? `Hoja de molde · ${sheets[0]!.dancerName}` : 'Hojas de molde');
  const starts: number[] = [];
  sheets.forEach((s, i) => {
    if (i > 0) doc.addPage();
    starts.push(doc.bufferedPageRange().count - 1);
    drawSheet(doc, s);
  });
  return finish(doc, (page) => {
    let owner = 0;
    starts.forEach((start, i) => { if (start <= page) owner = i; });
    const s = sheets[owner]!;
    return `Hilanzapp · ${s.groupName ? `${s.groupName} · ` : ''}${s.dancerName}`;
  });
}

export function renderProduction(p: ProductionPdfData): Promise<Buffer> {
  const doc = newDoc(`Producción · ${p.groupName}`);
  const W = doc.page.width - 2 * MARGIN;
  let y = MARGIN;
  doc.font('bold').fontSize(8).fillColor(MUTED).text('RESUMEN DE PRODUCCIÓN', MARGIN, y);
  doc.font('bold').fontSize(26).fillColor(INK).text(p.groupName, MARGIN, y + 14);
  doc.font('sans').fontSize(10).fillColor(MUTED).text(`${p.totalUnits} ${p.totalUnits === 1 ? 'prenda' : 'prendas'} · ${formatDate(p.generatedAt)}`, MARGIN, y + 48);
  y += 76;
  doc.lineWidth(1.5).strokeColor(INK).moveTo(MARGIN, y).lineTo(MARGIN + W, y).stroke();
  y += 14;

  const ensure = (h: number) => { if (y + h > doc.page.height - MARGIN - 20) { doc.addPage(); y = MARGIN; } };
  for (const g of p.byGarment) {
    ensure(40 + g.sizes.length * 16);
    doc.font('bold').fontSize(14).fillColor(INK).text(g.moldName, MARGIN, y, { continued: true });
    doc.font('sans').fontSize(10).fillColor(MUTED).text(`   ${g.total} ${g.total === 1 ? 'prenda' : 'prendas'}`);
    y += 24;
    for (const s of g.sizes) {
      const names = s.dancers.join(', ');
      const h = doc.font('sans').fontSize(10).heightOfString(names, { width: W - 90 });
      ensure(h + 10);
      doc.lineWidth(1.2).strokeColor(INK).undash().roundedRect(MARGIN, y, 76, 22, 4).stroke();
      doc.font('bold').fontSize(11).fillColor(INK).text(`T${s.label}  ×${s.count}`, MARGIN, y + 6, { width: 76, align: 'center', lineBreak: false });
      doc.font('sans').fontSize(10).fillColor(INK).text(names, MARGIN + 90, y + 6, { width: W - 90 });
      y += Math.max(28, h + 12);
    }
    y += 10;
  }
  if (p.byGarment.length === 0) { doc.font('sans').fontSize(11).fillColor(MUTED).text('Todavía no hay prendas para producir.', MARGIN, y); y += 24; }

  if (p.pending.length) {
    ensure(30 + p.pending.length * 14);
    doc.font('bold').fontSize(9).fillColor(INK).text('PENDIENTES (no entran en el conteo)', MARGIN, y);
    y += 16;
    for (const x of p.pending) { doc.font('sans').fontSize(10).fillColor(INK).text(`${x.name} · ${x.reason}`, MARGIN, y); y += 14; }
  }
  return finish(doc, () => `Hilanzapp · Producción · ${p.groupName}`);
}
