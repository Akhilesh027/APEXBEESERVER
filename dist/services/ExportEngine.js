"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportEngine = void 0;
const exceljs_1 = __importDefault(require("exceljs"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const pptxgenjs_1 = __importDefault(require("pptxgenjs"));
class ExportEngine {
    /**
     * Generates and streams dynamic reports depending on format criteria.
     */
    static async exportReport(res, type, timeframe, data, format) {
        const fileName = `ApexBee_${type}_report_${timeframe.toLowerCase()}`;
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}.csv`);
            const csv = this.convertToCSV(data);
            res.status(200).send(csv);
            return;
        }
        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}.json`);
            res.status(200).send(JSON.stringify(data, null, 2));
            return;
        }
        if (format === 'xlsx') {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}.xlsx`);
            const workbook = new exceljs_1.default.Workbook();
            const sheet = workbook.addWorksheet('Operational Report');
            // Styles
            sheet.getRow(1).values = ['ApexBee Business Intelligence Operational Report'];
            sheet.getRow(1).font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
            sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
            sheet.mergeCells('A1:D1');
            sheet.getRow(3).values = [`Timeframe: ${timeframe}`, `Generated: ${new Date().toISOString().split('T')[0]}`];
            sheet.getRow(3).font = { italic: true };
            if (data.length > 0) {
                const headers = Object.keys(data[0]);
                sheet.getRow(5).values = headers.map(h => h.toUpperCase());
                sheet.getRow(5).font = { bold: true };
                sheet.getRow(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                data.forEach((row, idx) => {
                    sheet.getRow(6 + idx).values = Object.values(row);
                });
            }
            await workbook.xlsx.write(res);
            res.end();
            return;
        }
        if (format === 'pdf') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}.pdf`);
            const doc = new pdfkit_1.default({ margin: 40 });
            doc.pipe(res);
            // PDF Title Page Header
            doc.rect(0, 0, 612, 100).fill('#2563EB');
            doc.fillColor('#FFFFFF').fontSize(20).text('ApexBee Ledger & BI Audit Sheet', 40, 40);
            doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString()}`, 40, 70);
            doc.fillColor('#334155').fontSize(14).text(`Report Type: ${type.toUpperCase()}`, 40, 130);
            doc.fontSize(10).text(`Reporting Timeframe: ${timeframe}`, 40, 150);
            doc.moveDown(2);
            if (data.length > 0) {
                const headers = Object.keys(data[0]);
                let y = 190;
                // Draw Header
                doc.rect(40, y, 532, 20).fill('#F1F5F9');
                doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold');
                headers.forEach((h, i) => {
                    doc.text(h.toUpperCase(), 45 + (i * 120), y + 6);
                });
                // Draw Rows
                y += 20;
                doc.font('Helvetica');
                data.forEach((row) => {
                    if (y > 700) {
                        doc.addPage();
                        y = 50;
                    }
                    doc.fillColor('#334155');
                    const values = Object.values(row);
                    values.forEach((val, i) => {
                        const txt = typeof val === 'number' ? val.toFixed(2) : String(val);
                        doc.text(txt, 45 + (i * 120), y + 6);
                    });
                    y += 20;
                });
            }
            else {
                doc.fontSize(12).text('No records found in selected scope.', 40, 190);
            }
            doc.end();
            return;
        }
        if (format === 'pptx') {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}.pptx`);
            const pptx = new pptxgenjs_1.default();
            // Title slide
            const titleSlide = pptx.addSlide();
            titleSlide.background = { fill: '2563EB' };
            titleSlide.addText('ApexBee Business Intelligence Report', {
                x: 1, y: 2, w: 8, h: 1.5, fontSize: 32, bold: true, color: 'FFFFFF', align: 'center'
            });
            titleSlide.addText(`Timeframe: ${timeframe} · Date: ${new Date().toLocaleDateString()}`, {
                x: 1, y: 3.5, w: 8, h: 1, fontSize: 14, color: 'E2E8F0', align: 'center'
            });
            // Data summary slide
            const dataSlide = pptx.addSlide();
            dataSlide.addText(`${type.toUpperCase()} Operations Summary`, {
                x: 0.5, y: 0.5, w: 9, h: 0.8, fontSize: 24, bold: true, color: '1E293B'
            });
            if (data.length > 0) {
                const headers = Object.keys(data[0]);
                const rows = [headers.map(h => ({ text: h.toUpperCase() }))];
                data.slice(0, 8).forEach(row => {
                    rows.push(Object.values(row).map(v => ({ text: typeof v === 'number' ? v.toFixed(0) : String(v) })));
                });
                dataSlide.addTable(rows, {
                    x: 0.5, y: 1.5, w: 9, h: 4.5,
                    border: { pt: 1, color: 'E2E8F0' },
                    fill: { color: 'F8FAFC' },
                    fontSize: 10,
                    color: '334155'
                });
            }
            else {
                dataSlide.addText('No records found in scope.', { x: 0.5, y: 1.5, fontSize: 14, color: '64748B' });
            }
            const buffer = await pptx.write({ outputType: 'nodebuffer' });
            res.status(200).send(buffer);
            return;
        }
        res.status(400).send('Unsupported export format');
    }
    static convertToCSV(data) {
        if (data.length === 0)
            return '';
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];
        data.forEach(row => {
            const values = headers.map(h => {
                const val = row[h];
                const strVal = typeof val === 'number' ? val.toString() : String(val);
                return `"${strVal.replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
        });
        return csvRows.join('\n');
    }
}
exports.ExportEngine = ExportEngine;
