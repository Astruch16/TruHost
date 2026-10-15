import PDFDocument from 'pdfkit';
import { formatCad, formatDate } from '../reporting/format.js';

/** A one-page stand-in receipt for a seeded expense, so seeded months can be finalized (receipts are required). */
export function sampleReceiptPdf(e: {
  vendor: string;
  description: string;
  amountCents: number;
  date: string;
}): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [288, 360],
    margin: 24,
    info: { CreationDate: new Date(`${e.date}T12:00:00Z`) },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  doc.font('Helvetica-Bold').fontSize(16).text(e.vendor);
  doc.font('Helvetica').fontSize(9).fillColor('#5b6068').text(formatDate(e.date)).moveDown();
  doc.fillColor('#1a1d21').fontSize(10).text(e.description).moveDown();
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(`Total ${formatCad(e.amountCents)}`);
  doc.moveDown(2).font('Helvetica').fontSize(8).fillColor('#5b6068').text('Sample receipt from the TruHost dev seed.');
  doc.end();
  return done;
}
