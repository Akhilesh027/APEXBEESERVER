// Local layout fixtures only. No database writes, charges or real invoices.
import fs from 'node:fs';
import path from 'node:path';
import { renderBusinessPdf, statementPdfData } from '../services/businessPdfService';
async function main() {
  const destination = path.resolve(__dirname, '../../../tmp/dairy-review');
  const statement = { settlementStatus: 'draft', statementNumber: 'PREVIEW-ONLY-STM-001', generatedDate: '2026-11-30', periodStart: '2026-11-01', periodEnd: '2026-11-30', grossAmount: 1350, taxes: 0, platformCommission: 135, franchiseCommission: 0, netVendorAmount: 1215, deliveryItems: Array.from({ length: 30 }, (_, index) => ({ date: `2026-11-${String(index + 1).padStart(2, '0')}`, quantity: 1, unitPrice: 45, amount: 45 })) };
  const invoice = statementPdfData(statement, { businessName: 'SAMPLE DAIRY - NOT A REAL INVOICE', address: 'Example Street, Sample City' }, { productName: 'Cow Milk 500 ml - recurring doorstep delivery' }, 'Sample customer', true);
  fs.writeFileSync(path.join(destination, 'invoice-preview.pdf'), await renderBusinessPdf(invoice));
  fs.writeFileSync(path.join(destination, 'purchase-order-preview.pdf'), await renderBusinessPdf({ title: 'Purchase Order', number: 'PREVIEW-ONLY-PO-001', status: 'ordered', supplier: 'SAMPLE STORE - PREVIEW ONLY', recipient: 'Example supplier', date: '05-11-2026', columns: ['Product', 'Ordered', 'Unit cost', 'Amount'], rows: Array.from({ length: 24 }, (_, index) => [`Example dairy product ${index + 1} with a longer product description`, '10', 'INR 30.00', 'INR 300.00']), totals: [['Order estimate', 'INR 7,200.00']], notes: ['Sample document for layout checks. Not a real purchase order.'] }));
  fs.writeFileSync(path.join(destination, 'goods-receipt-preview.pdf'), await renderBusinessPdf({ title: 'Goods Received Note', number: 'PREVIEW-ONLY-GRN-001', status: 'partial', supplier: 'SAMPLE STORE - PREVIEW ONLY', recipient: 'Example supplier', date: '05-11-2026', columns: ['Product / batch', 'Accepted', 'Rejected'], rows: [['Cow Milk 500 ml\nBatch SAMPLE-001 - Expiry 2026-11-08', '9', '1']], notes: ['Sample document for layout checks. No inventory was updated.'] }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
