import PDFDocument from 'pdfkit';

export type BusinessPdfData = { title: string; number: string; status: string; supplier: string; address?: string; gst?: string; recipient?: string; period?: string; date: string; columns: string[]; rows: string[][]; totals?: Array<[string, string]>; notes?: string[] };
const clean = (value: unknown) => String(value ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').replace(/[\u2010-\u2015]/g, '-');
export const invoiceMoney = (value: number) => `INR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function renderBusinessPdf(input: BusinessPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: clean(input.title), Author: 'ApexBee' } });
    const buffers: Buffer[] = []; doc.on('data', chunk => buffers.push(chunk)); doc.on('error', reject); doc.on('end', () => resolve(Buffer.concat(buffers)));
    const width = doc.page.width - 80; let y = 0;
    function header(continued = false) {
      doc.save().rect(0, 0, doc.page.width, 76).fill('#102044').restore();
      doc.fillColor('#fbbf24').font('Helvetica-Bold').fontSize(18).text('ApexBee', 40, 22, { width: 160 });
      doc.font('Helvetica').fontSize(8).fillColor('#ffffff').text('Business records', 40, 47, { width: 160 });
      doc.font('Helvetica-Bold').fontSize(12).text(clean(input.title), 210, 20, { width: width - 170, align: 'right' });
      doc.font('Helvetica').fontSize(8).text(clean(input.number), 210, 46, { width: width - 170, align: 'right' });
      y = 96; doc.fillColor('#172033');
      if (continued) { doc.fontSize(9).text('Continued', 40, y); y += 20; }
    }
    function ensure(height: number) { if (y + height > doc.page.height - 64) { doc.addPage(); header(true); } }
    function paragraph(value: string, bold = false) {
      const text = clean(value); doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
      const words = text.split(/\s+/); let line = '';
      for (const word of words) {
        if (doc.widthOfString(`${line} ${word}`) > width && line) { ensure(15); doc.text(line, 40, y, { width, lineBreak: false }); y += 15; line = word; }
        else line = line ? `${line} ${word}` : word;
      }
      if (line) { ensure(15); doc.text(line, 40, y, { width, lineBreak: false }); y += 15; }
    }
    header(); paragraph(input.supplier, true);
    if (input.address) paragraph(input.address);
    if (input.gst) paragraph(`GST registration: ${input.gst}`);
    y += 10; paragraph(`Document date: ${input.date}    Status: ${input.status}`);
    if (input.recipient) paragraph(`Bill / supplied to: ${input.recipient}`);
    if (input.period) paragraph(`Period / reference: ${input.period}`);
    y += 16;
    const count = input.columns.length, firstWidth = count > 2 ? width * 0.43 : width * 0.7;
    const widths = input.columns.map((_, index) => index === 0 ? firstWidth : (width - firstWidth) / (count - 1));
    function tableHeader() {
      ensure(26); doc.save().rect(40, y, width, 25).fill('#eef2f7').restore();
      let x = 46; doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155');
      input.columns.forEach((column, index) => { doc.text(clean(column), x, y + 8, { width: widths[index] - 12, lineBreak: false, align: index ? 'right' : 'left' }); x += widths[index]; }); y += 25;
    }
    tableHeader();
    for (const row of input.rows) {
      doc.font('Helvetica').fontSize(9);
      const heights = row.map((cell, index) => doc.heightOfString(clean(cell), { width: widths[index] - 12 }));
      const height = Math.max(22, ...heights.map(h => h + 14));
      if (y + height > doc.page.height - 64) { doc.addPage(); header(true); tableHeader(); }
      let x = 46; doc.fillColor('#172033').font('Helvetica').fontSize(9);
      row.forEach((cell, index) => { doc.text(clean(cell), x, y + 7, { width: widths[index] - 12, align: index ? 'right' : 'left' }); x += widths[index]; });
      y += height; doc.save().strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, y).lineTo(40 + width, y).stroke().restore();
    }
    y += 18;
    if (input.totals?.length) ensure(input.totals.length * 24);
    for (const [label, amount] of input.totals || []) {
      ensure(24); doc.font('Helvetica-Bold').fontSize(10).text(clean(label), 40, y, { width: width * 0.65 });
      doc.text(clean(amount), 40 + width * 0.65, y, { width: width * 0.35, align: 'right' }); y += 24;
    }
    y += 12; for (const note of input.notes || []) { paragraph(note); y += 7; }
    const range = doc.bufferedPageRange();
    for (let page = 0; page < range.count; page++) {
      doc.switchToPage(page); doc.font('Helvetica').fontSize(8).fillColor('#64748b');
      const bottomMargin = doc.page.margins.bottom; doc.page.margins.bottom = 0;
      doc.text('Generated from ApexBee business records', 40, doc.page.height - 35, { width: width - 80, lineBreak: false });
      doc.text(`${page + 1} / ${range.count}`, doc.page.width - 100, doc.page.height - 35, { width: 60, align: 'right', lineBreak: false });
      doc.page.margins.bottom = bottomMargin;
    }
    doc.end();
  });
}

export function statementPdfData(statement: any, vendor: any, subscription: any, customerName: string, vendorCopy = false): BusinessPdfData {
  const final = ['settled', 'approved'].includes(statement.settlementStatus);
  const rows = statement.deliveryItems?.length ? statement.deliveryItems.map((item: any) => [`${item.date}\n${subscription.productName}`, String(item.quantity), invoiceMoney(item.unitPrice), invoiceMoney(item.amount)]) : [[`${subscription.productName}\n${statement.delivered} confirmed deliveries`, String(statement.quantity * statement.delivered), invoiceMoney(statement.unitPrice), invoiceMoney(statement.grossAmount)]];
  return { title: final ? 'Subscription Invoice' : 'Draft Billing Statement', number: statement.statementNumber, status: statement.settlementStatus, supplier: vendor.businessName || vendor.name || 'Vendor', address: [vendor.address, vendor.mandal, vendor.district, vendor.state, vendor.pincode].filter(Boolean).join(', '), gst: vendor.gstNumber,
    recipient: customerName, period: `${statement.periodStart || statement.billingPeriod} to ${statement.periodEnd || statement.billingPeriod}`, date: new Date(statement.generatedDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }), columns: ['Delivery / product', 'Packs', 'Unit price', 'Amount'], rows,
    totals: [['Delivery total', invoiceMoney(statement.grossAmount)], ['Tax recorded within total', invoiceMoney(statement.taxes)], ...(vendorCopy ? [['Platform commission', invoiceMoney(statement.platformCommission)], ['Franchise commission', invoiceMoney(statement.franchiseCommission)], ['Vendor settlement', invoiceMoney(statement.netVendorAmount)]] as Array<[string, string]> : [])],
    notes: [final ? 'This document records confirmed subscription deliveries for the stated period.' : 'DRAFT: This statement is awaiting review. It is not a payment receipt.', 'Payment status follows the recorded wallet and settlement ledger. Downloading this document does not charge a wallet or release a payout.'] };
}
