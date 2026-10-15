import PDFDocument from 'pdfkit';
import { formatBps, formatCad, formatDate, formatDay } from '../reporting/format.js';
import { channelName, monthName, type StatementLine, type StatementTotals } from '../reporting/statement.js';

/**
 * The owner statement as a PDF, drawn with PDFKit (no headless browser in the API container). It prints exactly the
 * lines and totals it is given (reporting/statement.ts computes them); nothing is calculated here. Letter size,
 * built to fit a typical month on one page; longer months flow onto more pages with the table headings repeated.
 */
export interface StatementDocument {
  statementId: string;
  status: 'DRAFT' | 'FINALIZED' | 'RELEASED';
  property: { name: string; address: string[] };
  owners: string[];
  /** "YYYY-MM". */
  month: string;
  plan: { name: string; managementFeeBps: number } | null;
  totals: StatementTotals;
  lines: StatementLine[];
  released: { on: string; paymentReference: string | null } | null;
  generatedAt: Date;
}

const C = {
  brand: '#173f3a',
  brandInk: '#eef3f1',
  brandMuted: '#a9c2bb',
  ink: '#1a1d21',
  muted: '#5b6068',
  line: '#e4e4df',
  soft: '#f6f6f3',
  sage: '#ddebdf',
  gold: '#c99a2e',
  goldSoft: '#fbf3df',
};

const PAGE = { width: 612, height: 792, margin: 48 };
const CONTENT = PAGE.width - PAGE.margin * 2;
const FOOTER_TOP = PAGE.height - 56;

const CATEGORY: Record<string, string> = {
  SUPPLIES: 'Supplies',
  REPAIRS_MAINTENANCE: 'Repairs',
  FURNISHINGS: 'Furnishings',
  UTILITIES: 'Utilities',
  INTERNET: 'Internet',
  SUBSCRIPTIONS: 'Subscriptions',
  LICENSING_PERMITS: 'Licences & permits',
  INSURANCE: 'Insurance',
  STRATA: 'Strata',
  CLEANING: 'Cleaning',
  OTHER: 'Other',
};

/** PDF standard fonts have no U+2212, so documents use a plain hyphen for negatives. */
const money = (cents: number) => formatCad(cents).replace('−', '-');

/** "Sep 28 – Oct 3, 2026" for stays (years shown once, at the end). */
const stayDates = (from: string, to: string) => `${formatDay(from)} – ${formatDate(to)}`;

type Column = { label: string; width: number; align?: 'left' | 'right' };
type Cell = { text: string; note?: string; bold?: boolean };

export function renderStatementPdf(d: StatementDocument): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: PAGE.margin, bottom: 8, left: PAGE.margin, right: PAGE.margin },
    bufferPages: true,
    info: {
      Title: `${d.property.name} · Owner statement · ${monthName(d.month)}`,
      Author: 'TruHost',
      Subject: 'Owner statement',
      CreationDate: d.generatedAt,
    },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  let y = header(doc, d);
  y = details(doc, d, y);
  y = summary(doc, d, y + 14);

  const stays = d.lines.filter((l) => l.kind === 'STAY');
  const cleanings = d.lines.filter((l) => l.kind === 'OWNER_STAY_CLEANING');
  const expenses = d.lines.filter((l) => l.kind === 'EXPENSE');
  const adjustments = d.lines.filter((l) => l.kind === 'ADJUSTMENT');

  y = table(
    doc,
    y + 16,
    'Stays',
    [
      { label: 'Dates', width: 150 },
      { label: 'Channel', width: 110 },
      { label: 'Nights', width: 106 },
      { label: 'Your share', width: CONTENT - 366, align: 'right' },
    ],
    stays.map((l) => [
      { text: stayDates(l.date, l.endDate!) },
      { text: l.channel ? channelName(l.channel) : '', note: l.cancelled ? 'Cancelled, paid out' : undefined },
      {
        text: l.cancelled ? '—' : l.nights === l.totalNights ? `${l.nights}` : `${l.nights} of ${l.totalNights}`,
        note: !l.cancelled && l.nights !== l.totalNights ? `in ${monthName(d.month).split(' ')[0]}` : undefined,
      },
      {
        text: money(l.amountCents),
        bold: true,
        note: l.payoutPending
          ? 'Payout not received'
          : !l.cancelled && l.nights !== l.totalNights && l.stayGrossCents !== null
            ? `of ${money(l.stayGrossCents)} for the stay`
            : undefined,
      },
    ]),
    'No guest stays this month.',
  );

  if (cleanings.length > 0) {
    y = table(
      doc,
      y + 12,
      'Owner stays',
      [
        { label: 'Dates', width: 150 },
        { label: 'Charge', width: 216 },
        { label: 'Amount', width: CONTENT - 366, align: 'right' },
      ],
      cleanings.map((l) => [
        { text: stayDates(l.date, l.endDate!) },
        { text: 'Cleaning after your stay', note: 'Standard cleaning fee' },
        { text: money(l.amountCents), bold: true },
      ]),
      '',
    );
  }

  y = table(
    doc,
    y + 12,
    'Expenses',
    [
      { label: 'Date', width: 90 },
      { label: 'Description', width: 196 },
      { label: 'Category', width: 100 },
      { label: 'Amount', width: CONTENT - 386, align: 'right' },
    ],
    expenses.map((l) => [
      { text: formatDate(l.date) },
      { text: l.description, note: l.detail ?? undefined },
      { text: l.category ? (CATEGORY[l.category] ?? l.category) : '' },
      { text: money(l.amountCents), bold: true },
    ]),
    'No expenses this month.',
  );

  if (adjustments.length > 0) {
    y = table(
      doc,
      y + 12,
      'Adjustments',
      [
        { label: 'Date', width: 90 },
        { label: 'Reason', width: 296 },
        { label: 'Amount', width: CONTENT - 386, align: 'right' },
      ],
      adjustments.map((l) => [
        { text: formatDate(l.date) },
        { text: l.description, note: l.detail ?? undefined },
        { text: money(l.amountCents), bold: true },
      ]),
      '',
    );
  }

  footers(doc, d);
  doc.end();
  return done;
}

function header(doc: PDFKit.PDFDocument, d: StatementDocument): number {
  doc.rect(0, 0, PAGE.width, 80).fill(C.brand);
  // The house mark from the app's sidebar logo (40-unit grid), scaled to 32pt.
  doc.save();
  doc.translate(PAGE.margin, 22).scale(0.8);
  doc
    .path('M6 18.5 20 6.5l14 12V33a1.5 1.5 0 0 1-1.5 1.5h-25A1.5 1.5 0 0 1 6 33z')
    .lineWidth(3)
    .lineJoin('round')
    .stroke(C.brandInk);
  doc.roundedRect(16, 20, 8, 7, 1).lineWidth(2.5).stroke(C.brandInk);
  doc.restore();
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor(C.brandInk)
    .text('TruHost', PAGE.margin + 42, 25, { lineBreak: false });
  doc
    .font('Helvetica-Bold')
    .fontSize(6.5)
    .fillColor(C.brandMuted)
    .text('VACATION RENTAL MANAGEMENT', PAGE.margin + 42, 48, { characterSpacing: 1, lineBreak: false });

  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(C.brandMuted)
    .text('OWNER STATEMENT', PAGE.margin, 24, { width: CONTENT, align: 'right', characterSpacing: 1.2 });
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#ffffff')
    .text(monthName(d.month), PAGE.margin, 37, { width: CONTENT, align: 'right' });

  let y = 80;
  if (d.status !== 'RELEASED') {
    doc.rect(0, y, PAGE.width, 24).fill(C.goldSoft);
    const note =
      d.status === 'DRAFT'
        ? 'PREVIEW · Draft: figures can still change until this statement is finalized.'
        : 'PREVIEW · Finalized, not yet released to the owner.';
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#7a5a12')
      .text(note, PAGE.margin, y + 8, { width: CONTENT, lineBreak: false });
    y += 24;
  }
  return y + 18;
}

function details(doc: PDFKit.PDFDocument, d: StatementDocument, top: number): number {
  const colWidth = (CONTENT - 32) / 3;
  const block = (x: number, label: string, lines: { text: string; bold?: boolean }[]) => {
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.muted).text(label.toUpperCase(), x, top, {
      width: colWidth,
      characterSpacing: 0.8,
    });
    let y = top + 13;
    for (const l of lines) {
      doc
        .font(l.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(l.bold ? 10.5 : 9)
        .fillColor(l.bold ? C.ink : C.muted);
      doc.text(l.text, x, y, { width: colWidth });
      y = doc.y + 1;
    }
    return y;
  };
  const [y1, m1] = d.month.split('-').map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(y1, m1, 0)).getUTCDate();
  const ends = [
    block(PAGE.margin, 'Property', [
      { text: d.property.name, bold: true },
      ...d.property.address.map((text) => ({ text })),
    ]),
    block(
      PAGE.margin + colWidth + 16,
      d.owners.length > 1 ? 'Owners' : 'Owner',
      (d.owners.length ? d.owners : ['—']).map((text) => ({ text, bold: d.owners.length > 0 })),
    ),
    block(PAGE.margin + (colWidth + 16) * 2, 'Statement', [
      {
        text: `${formatDay(`${d.month}-01`)} – ${formatDate(`${d.month}-${String(lastDay).padStart(2, '0')}`)}`,
        bold: true,
      },
      { text: d.plan ? `${d.plan.name} · ${formatBps(d.plan.managementFeeBps)} of gross` : 'No plan' },
      {
        text: d.released
          ? `Paid ${formatDate(d.released.on)}${d.released.paymentReference ? ` · Ref. ${d.released.paymentReference}` : ''}`
          : 'Not released yet',
      },
    ]),
  ];
  return Math.max(...ends);
}

function summary(doc: PDFKit.PDFDocument, d: StatementDocument, top: number): number {
  const t = d.totals;
  const leftWidth = CONTENT - 190;
  const rows: { label: string; note: string; value: string }[] = [
    {
      label: 'Gross revenue',
      note: `Payouts less guest cleaning fees · ${t.nightsBooked} night${t.nightsBooked === 1 ? '' : 's'} booked`,
      value: money(t.grossCents),
    },
    {
      label: d.plan ? `${d.plan.name} fee` : 'Management fee',
      note: t.managementFeeBps !== null ? `${formatBps(t.managementFeeBps)} of gross revenue` : 'No plan in force',
      value: money(-t.managementFeeCents),
    },
    { label: 'Expenses', note: 'Purchases for the property, with receipts', value: money(-t.expensesCents) },
  ];
  if (t.ownerStayCleaningCents > 0) {
    rows.push({
      label: 'Owner-stay cleaning',
      note: 'Standard cleaning fee after your stays',
      value: money(-t.ownerStayCleaningCents),
    });
  }
  if (t.adjustmentsCents !== 0 || d.lines.some((l) => l.kind === 'ADJUSTMENT')) {
    rows.push({ label: 'Adjustments', note: 'Corrections, listed below', value: money(t.adjustmentsCents) });
  }

  doc.roundedRect(PAGE.margin, top, CONTENT, 20 + rows.length * 27, 10).fill(C.soft);
  let y = top + 10;
  for (const [i, r] of rows.entries()) {
    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor(C.ink)
      .text(r.label, PAGE.margin + 16, y, { width: leftWidth - 120 });
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(C.muted)
      .text(r.note, PAGE.margin + 16, y + 12, { width: leftWidth - 120 });
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(C.ink)
      .text(r.value, PAGE.margin + 16, y + 5, { width: leftWidth - 32, align: 'right' });
    if (i < rows.length - 1) {
      doc
        .moveTo(PAGE.margin + 16, y + 24)
        .lineTo(PAGE.margin + leftWidth - 16, y + 24)
        .lineWidth(0.5)
        .stroke(C.line);
    }
    y += 27;
  }

  // Net, on the brand green, beside the breakdown.
  const boxX = PAGE.margin + leftWidth;
  const boxH = 20 + rows.length * 27;
  doc.roundedRect(boxX, top, CONTENT - leftWidth, boxH, 10).fill(C.brand);
  const mid = top + boxH / 2;
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(C.brandMuted)
    .text('NET TO OWNER', boxX + 18, mid - 30, { characterSpacing: 1, width: CONTENT - leftWidth - 36 });
  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .fillColor('#ffffff')
    .text(money(t.netCents), boxX + 18, mid - 16, { width: CONTENT - leftWidth - 36 });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(C.brandInk)
    .text(d.released ? `Paid ${formatDate(d.released.on)}` : 'To be paid', boxX + 18, mid + 12, {
      width: CONTENT - leftWidth - 36,
    });
  return top + boxH;
}

/** A titled table. Rows that would cross the footer go to a new page, with the headings repeated. */
function table(
  doc: PDFKit.PDFDocument,
  top: number,
  title: string,
  columns: Column[],
  rows: Cell[][],
  empty: string,
): number {
  const rowHeight = (cells: Cell[]) => (cells.some((c) => c.note) ? 24 : 17);
  const headings = (y: number) => {
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.ink).text(title, PAGE.margin, y);
    let x = PAGE.margin;
    const hy = y + 16;
    for (const col of columns) {
      doc
        .font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(C.muted)
        .text(col.label.toUpperCase(), x, hy, {
          width: col.width - 8,
          align: col.align ?? 'left',
          characterSpacing: 0.6,
        });
      x += col.width;
    }
    doc
      .moveTo(PAGE.margin, hy + 11)
      .lineTo(PAGE.margin + CONTENT, hy + 11)
      .lineWidth(0.75)
      .stroke(C.line);
    return hy + 16;
  };

  // Keep the heading with at least one row.
  let y = top;
  if (y + 32 + (rows[0] ? rowHeight(rows[0]) : 17) > FOOTER_TOP) {
    doc.addPage();
    y = PAGE.margin;
  }
  y = headings(y);
  if (rows.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor(C.muted).text(empty, PAGE.margin, y);
    return y + 14;
  }
  for (const cells of rows) {
    const h = rowHeight(cells);
    if (y + h > FOOTER_TOP) {
      doc.addPage();
      y = headings(PAGE.margin);
    }
    let x = PAGE.margin;
    for (const [i, cell] of cells.entries()) {
      const col = columns[i]!;
      doc
        .font(cell.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(9)
        .fillColor(C.ink)
        .text(cell.text, x, y, { width: col.width - 8, align: col.align ?? 'left', lineBreak: false, ellipsis: true });
      if (cell.note) {
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor(C.muted)
          .text(cell.note, x, y + 11, {
            width: col.width - 8,
            align: col.align ?? 'left',
            lineBreak: false,
            ellipsis: true,
          });
      }
      x += col.width;
    }
    doc
      .moveTo(PAGE.margin, y + h - 4)
      .lineTo(PAGE.margin + CONTENT, y + h - 4)
      .lineWidth(0.5)
      .stroke(C.line);
    y += h;
  }
  return y;
}

function footers(doc: PDFKit.PDFDocument, d: StatementDocument) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .moveTo(PAGE.margin, FOOTER_TOP + 10)
      .lineTo(PAGE.margin + CONTENT, FOOTER_TOP + 10)
      .lineWidth(0.5)
      .stroke(C.line);
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(C.muted)
      .text(
        'Amounts in Canadian dollars. TruHost is not registered for GST, so no tax is charged. Gross revenue is each stay’s payout less the guest cleaning fee, split per night across months.',
        PAGE.margin,
        FOOTER_TOP + 17,
        { width: CONTENT - 130 },
      );
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, PAGE.margin, FOOTER_TOP + 17, {
      width: CONTENT,
      align: 'right',
      lineBreak: false,
    });
    doc.text(`Statement ${d.statementId.slice(0, 8)}`, PAGE.margin, FOOTER_TOP + 27, {
      width: CONTENT,
      align: 'right',
      lineBreak: false,
    });
  }
}
