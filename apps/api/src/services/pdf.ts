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
  /** Presente cuando la prenda todavía no tiene molde: hoja simplificada para trazar a mano. */
  noPattern?: { designName: string | null; category: string; sizeBasis: string; measures: { label: string; value: string | null; takenOn: string | null }[] };
}
export interface ProductionPdfData {
  groupName: string; generatedAt: string; totalUnits: number;
  byGarment: { moldName: string; hasPattern?: boolean; total: number; sizes: { label: string; count: number; dancers: string[] }[] }[];
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

const SIZE_BASIS: Record<string, string> = { pecho: 'pecho', cadera: 'cadera', both: 'pecho y cadera' };

/** P2 del diseño: prenda sin molde. Medidas para trazar a mano y un espacio grande para el dibujo. */
function drawNoPatternSheet(doc: PDFKit.PDFDocument, s: SheetPdfData) {
  const np = s.noPattern!;
  const W = doc.page.width - 2 * MARGIN;
  const right = doc.page.width - MARGIN;
  let y = MARGIN;
  doc.font('bold').fontSize(8).fillColor(MUTED).text(`HOJA DE PRENDA${np.designName ? ` · DISEÑO ${np.designName.toUpperCase()}` : ''}`, MARGIN, y);
  doc.font('bold').fontSize(26).fillColor(INK).text(s.dancerName, MARGIN, y + 14, { width: W - 150 });
  doc.font('sans').fontSize(10).fillColor(MUTED).text(s.groupName ? `Grupo ${s.groupName}` : '', MARGIN, y + 50, { width: W });
  doc.font('bold').fontSize(14).fillColor(INK).text('Hilanzapp', right - 140, y + 4, { width: 140, align: 'right' });
  doc.font('sans').fontSize(8).fillColor(MUTED).text(`Impreso ${formatDate(s.createdAt)}`, right - 140, y + 24, { width: 140, align: 'right' });
  y += 72;
  doc.moveTo(MARGIN, y).lineWidth(1.5).strokeColor(INK).lineTo(right, y).stroke();
  y += 14;

  const half = (W - 14) / 2;
  doc.font('bold').fontSize(7.5).fillColor(MUTED).text('PRENDA', MARGIN, y, { lineBreak: false });
  doc.font('bold').fontSize(16).fillColor(INK).text(s.moldName, MARGIN, y + 12, { width: half - 90, lineBreak: false, ellipsis: true });
  doc.lineWidth(1).strokeColor(INK).dash(1.5, { space: 2 }).roundedRect(MARGIN + half - 84, y + 12, 84, 18, 4).stroke().undash();
  doc.font('bold').fontSize(7.5).fillColor(INK).text('SIN MOLDE', MARGIN + half - 84, y + 18, { width: 84, align: 'center', lineBreak: false });
  const x2 = MARGIN + half + 14;
  doc.font('bold').fontSize(7.5).fillColor(MUTED).text('TALLE', x2, y, { lineBreak: false });
  const sizeText = s.sizeLabel ? `T${s.sizeLabel}` : 'sin talle';
  doc.font('bold').fontSize(16).fillColor(INK).text(sizeText, x2, y + 12, { lineBreak: false });
  doc.font('sans').fontSize(8.5).fillColor(MUTED).text(
    s.sizeLabel ? `${s.sizeOrigin === 'suggested' ? 'Sugerido' : 'Asignado a mano'} · según ${np.sizeBasis}` : `según ${np.sizeBasis}`, x2, y + 32, { width: half, lineBreak: false });
  y += 56;

  const cols = [W * 0.5, W * 0.25, W * 0.25];
  doc.rect(MARGIN, y, W, 20).fillColor(BASE).fill();
  doc.font('bold').fontSize(7.5).fillColor(INK);
  ['MEDIDA', 'REAL (CM)', 'TOMADA'].forEach((t, i) => doc.text(t, MARGIN + cols.slice(0, i).reduce((a, b) => a + b, 0) + 8, y + 6, { width: cols[i]! - 16, lineBreak: false }));
  doc.lineWidth(1.5).strokeColor(INK).undash().rect(MARGIN, y, W, 20).stroke();
  y += 20;
  for (const m of np.measures) {
    if (y + 30 > doc.page.height - MARGIN - 40) { doc.addPage(); y = MARGIN; }
    doc.font('sans').fontSize(10.5).fillColor(INK).text(m.label, MARGIN + 8, y + 9, { width: cols[0]! - 16, lineBreak: false, ellipsis: true });
    const x1 = MARGIN + cols[0]!;
    if (m.value !== null) {
      doc.lineWidth(1.2).strokeColor(INK).undash().rect(x1 + 8, y + 3, 70, 24).stroke();
      doc.font('bold').fontSize(13).fillColor(INK).text(m.value, x1 + 12, y + 9, { width: 62, lineBreak: false });
      doc.font('sans').fontSize(9).fillColor(MUTED).text(m.takenOn ? formatDate(m.takenOn) : '', x1 + cols[1]! + 8, y + 10, { lineBreak: false });
    } else {
      doc.lineWidth(1.2).strokeColor(INK).dash(3, { space: 2 }).rect(x1 + 8, y + 3, 70, 24).stroke().undash();
      doc.font('sans').fontSize(9).fillColor(MUTED).text('falta · anotar', x1 + cols[1]! + 8, y + 10, { lineBreak: false });
    }
    doc.lineWidth(0.5).strokeColor(LINE).undash().moveTo(MARGIN, y + 30).lineTo(right, y + 30).stroke();
    y += 30;
  }
  if (!np.measures.length) { doc.font('sans').fontSize(10).fillColor(MUTED).text('Esta prenda no tiene medidas requeridas.', MARGIN + 8, y + 9); y += 30; }
  y += 14;
  const room = doc.page.height - MARGIN - 24 - y;
  if (room > 80) {
    doc.font('bold').fontSize(7.5).fillColor(INK).text('TRAZADO Y NOTAS', MARGIN, y, { lineBreak: false });
    doc.lineWidth(0.8).strokeColor(LINE).undash().rect(MARGIN, y + 14, W, room - 14).stroke();
  }
}

function drawSheet(doc: PDFKit.PDFDocument, s: SheetPdfData) {
  if (s.noPattern) { drawNoPatternSheet(doc, s); return; }
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
    doc.font('sans').fontSize(10).fillColor(MUTED).text(`   ${g.hasPattern === false ? 'Sin molde · ' : ''}${g.total} ${g.total === 1 ? 'prenda' : 'prendas'}`);
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

export interface MissingPdfData {
  groupName: string; generatedAt: string;
  dancers: { name: string; missing: string[] }[];
}

/** P1 del diseño: faltantes del grupo, con casilleros para anotar a mano. */
export function renderMissing(d: MissingPdfData): Promise<Buffer> {
  const doc = newDoc(`Medidas que faltan · ${d.groupName}`);
  const W = doc.page.width - 2 * MARGIN;
  const right = doc.page.width - MARGIN;
  const total = d.dancers.reduce((n, x) => n + x.missing.length, 0);
  let y = MARGIN;
  doc.font('bold').fontSize(8).fillColor(MUTED).text('MEDIDAS QUE FALTAN', MARGIN, y);
  doc.font('bold').fontSize(26).fillColor(INK).text(`Grupo ${d.groupName}`, MARGIN, y + 14, { width: W - 150 });
  doc.font('sans').fontSize(10).fillColor(MUTED).text(`${d.dancers.length} ${d.dancers.length === 1 ? 'bailarina' : 'bailarinas'} con faltantes · ${total} ${total === 1 ? 'medida' : 'medidas'} por tomar`, MARGIN, y + 50, { width: W });
  doc.font('bold').fontSize(14).fillColor(INK).text('Hilanzapp', right - 140, y + 4, { width: 140, align: 'right' });
  doc.font('sans').fontSize(8).fillColor(MUTED).text(`Impreso ${formatDate(d.generatedAt)}`, right - 140, y + 24, { width: 140, align: 'right' })
    .text('Tomadas por: ____________', right - 140, y + 38, { width: 140, align: 'right' });
  y += 72;
  doc.moveTo(MARGIN, y).lineWidth(1.5).strokeColor(INK).lineTo(right, y).stroke();
  y += 10;
  doc.font('sans').fontSize(9).fillColor(MUTED).text('Anotá cada valor en cm. Después cargalo en “Tomar medidas”: se guarda como versión nueva, sin pisar la anterior.', MARGIN, y, { width: W });
  y += 30;

  if (d.dancers.length === 0) doc.font('sans').fontSize(12).fillColor(INK).text('No falta ninguna medida.', MARGIN, y);
  const colW = (W - 20) / 2;
  for (const dancer of d.dancers) {
    const rows = Math.ceil(dancer.missing.length / 2);
    const h = 26 + rows * 24 + 8;
    if (y + h > doc.page.height - MARGIN - 30) { doc.addPage(); y = MARGIN; }
    doc.font('bold').fontSize(12).fillColor(INK).text(dancer.name, MARGIN, y, { continued: true });
    doc.font('sans').fontSize(9).fillColor(MUTED).text(`   Faltan ${dancer.missing.length}`);
    y += 20;
    dancer.missing.forEach((label, i) => {
      const x = MARGIN + (i % 2) * (colW + 20);
      const yy = y + Math.floor(i / 2) * 24;
      doc.font('sans').fontSize(10).fillColor(INK).text(label, x, yy + 6, { width: colW - 90, lineBreak: false, ellipsis: true });
      doc.lineWidth(1.2).strokeColor(INK).undash().rect(x + colW - 84, yy, 60, 20).stroke();
      doc.font('sans').fontSize(8).fillColor(MUTED).text('cm', x + colW - 20, yy + 6, { lineBreak: false });
    });
    y += rows * 24 + 12;
    doc.lineWidth(0.5).strokeColor(LINE).moveTo(MARGIN, y - 4).lineTo(right, y - 4).stroke();
  }
  const room = doc.page.height - MARGIN - 30 - y;
  if (room > 70) {
    doc.font('bold').fontSize(7.5).fillColor(INK).text('NOTAS', MARGIN, y + 6, { lineBreak: false });
    doc.lineWidth(0.8).strokeColor(LINE).rect(MARGIN, y + 20, W, room - 20).stroke();
  }
  return finish(doc, () => `Hilanzapp · ${d.groupName} · Faltantes`);
}
