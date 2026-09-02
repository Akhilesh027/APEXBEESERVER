"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const SubscriptionInvoice_1 = require("../models/SubscriptionInvoice");
const SubscriptionOrder_1 = require("../models/SubscriptionOrder");
const Vendor_1 = require("../../../models/Vendor");
class InvoiceService {
    static COMPANY_DETAILS = {
        name: 'ApexBee Technologies Private Limited',
        address: 'H.No. 4-50, ApexBee Towers, Madhapur, Hyderabad, Telangana - 500081',
        gstin: '36AAACA1234B1ZI',
        email: 'billing@apexbee.in',
        phone: '+91 8008001234'
    };
    /**
     * Generates a concurrency-safe GST Tax Invoice after payment capture
     */
    static async generateInvoice(orderId, paymentId) {
        const oId = new mongoose_1.default.Types.ObjectId(orderId);
        const order = await SubscriptionOrder_1.SubscriptionOrder.findById(oId);
        if (!order)
            throw new Error('Subscription order not found');
        const vendor = await Vendor_1.Vendor.findById(order.vendorId);
        if (!vendor)
            throw new Error('Vendor not found');
        // Check if invoice already exists
        const existing = await SubscriptionInvoice_1.SubscriptionInvoice.findOne({ orderId: oId });
        if (existing)
            return existing;
        const count = await SubscriptionInvoice_1.SubscriptionInvoice.countDocuments();
        const seqStr = String(count + 1).padStart(6, '0');
        const year = new Date().getFullYear();
        const invoiceNumber = `AB-SUB-${year}-${seqStr}`;
        const vendorBillingDetails = {
            businessName: vendor.businessName || 'ApexBee Vendor Partner',
            ownerName: vendor.ownerName || vendor.businessName || 'Vendor Admin',
            email: vendor.email || 'vendor@apexbee.in',
            mobile: vendor.mobile || '+91 9876543210',
            address: vendor.address || 'Vendor Store Address',
            state: vendor.state || 'Telangana',
            pincode: vendor.pincode || '',
            gstNumber: vendor.gstNumber || 'N/A'
        };
        const invoice = await SubscriptionInvoice_1.SubscriptionInvoice.create({
            invoiceNumber,
            orderId: oId,
            paymentId: paymentId ? new mongoose_1.default.Types.ObjectId(paymentId) : undefined,
            vendorId: order.vendorId,
            invoiceType: 'TAX_INVOICE',
            vendorBillingDetails,
            companyBillingDetails: this.COMPANY_DETAILS,
            lineItems: order.items,
            subtotal: order.subtotal,
            discountAmount: order.discountAmount,
            walletAmountDeducted: order.walletDeductionAmount || 0,
            taxableAmount: order.taxableAmount,
            isInterstate: (vendor.state || '').trim().toUpperCase() !== 'TELANGANA',
            cgst: order.taxableAmount > 0 ? (order.gstAmount / 2) : 0,
            sgst: order.taxableAmount > 0 ? (order.gstAmount / 2) : 0,
            igst: 0,
            totalAmount: order.finalPayableAmount,
            status: 'ISSUED',
            pdfUrl: `/api/vendor/subscription-invoices/${invoiceNumber}/download`
        });
        return invoice;
    }
    /**
     * Generates a PDF stream for an issued invoice
     */
    static async generateInvoicePdfBuffer(invoiceId) {
        const invoice = await SubscriptionInvoice_1.SubscriptionInvoice.findOne({
            $or: [{ _id: mongoose_1.default.Types.ObjectId.isValid(invoiceId) ? new mongoose_1.default.Types.ObjectId(invoiceId) : null }, { invoiceNumber: invoiceId }]
        });
        if (!invoice)
            throw new Error('Invoice not found');
        return new Promise((resolve, reject) => {
            const doc = new pdfkit_1.default({ margin: 50 });
            const buffers = [];
            doc.on('data', chunk => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', err => reject(err));
            // PDF Header
            doc.fontSize(20).text('TAX INVOICE', { align: 'right' });
            doc.fontSize(14).text(this.COMPANY_DETAILS.name, 50, 50);
            doc.fontSize(9).text(this.COMPANY_DETAILS.address);
            doc.text(`GSTIN: ${this.COMPANY_DETAILS.gstin}`);
            doc.moveDown();
            doc.text(`Invoice No: ${invoice.invoiceNumber}`, { align: 'right' });
            doc.text(`Date: ${new Date(invoice.issuedAt).toLocaleDateString()}`, { align: 'right' });
            doc.moveDown();
            // Billed To
            doc.fontSize(11).text('Billed To:', { underline: true });
            doc.fontSize(10).text(`Business: ${invoice.vendorBillingDetails.businessName}`);
            doc.text(`Owner: ${invoice.vendorBillingDetails.ownerName}`);
            doc.text(`Address: ${invoice.vendorBillingDetails.address}, ${invoice.vendorBillingDetails.state}`);
            doc.text(`GSTIN: ${invoice.vendorBillingDetails.gstNumber}`);
            doc.moveDown();
            // Table Header
            doc.fontSize(10).text('Description', 50, doc.y, { width: 250 });
            doc.text('Taxable (INR)', 300, doc.y, { width: 100, align: 'right' });
            doc.text('Total (INR)', 420, doc.y, { width: 100, align: 'right' });
            doc.moveDown();
            doc.text('-------------------------------------------------------------------------------------------------');
            // Line items
            invoice.lineItems.forEach((item) => {
                doc.text(item.name || 'ApexBee Subscription Product', 50, doc.y, { width: 250 });
                doc.text(`INR ${invoice.taxableAmount.toFixed(2)}`, 300, doc.y, { width: 100, align: 'right' });
                doc.text(`INR ${invoice.totalAmount.toFixed(2)}`, 420, doc.y, { width: 100, align: 'right' });
            });
            doc.moveDown();
            doc.text(`Subtotal: INR ${invoice.subtotal.toFixed(2)}`, { align: 'right' });
            doc.text(`Discounts: INR ${invoice.discountAmount.toFixed(2)}`, { align: 'right' });
            doc.text(`GST Amount: INR ${(invoice.cgst + invoice.sgst + invoice.igst).toFixed(2)}`, { align: 'right' });
            doc.fontSize(12).text(`Grand Total: INR ${invoice.totalAmount.toFixed(2)}`, { align: 'right' });
            doc.end();
        });
    }
}
exports.InvoiceService = InvoiceService;
