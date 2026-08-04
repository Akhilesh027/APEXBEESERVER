"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionInvoice = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SubscriptionInvoiceSchema = new mongoose_1.Schema({
    invoiceNumber: { type: String, required: true, unique: true, uppercase: true },
    orderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'SubscriptionOrder', required: true },
    paymentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'SubscriptionPayment' },
    vendorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    invoiceType: { type: String, enum: ['TAX_INVOICE', 'CREDIT_NOTE', 'REFUND_INVOICE'], default: 'TAX_INVOICE' },
    vendorBillingDetails: { type: mongoose_1.Schema.Types.Mixed, required: true },
    companyBillingDetails: { type: mongoose_1.Schema.Types.Mixed, required: true },
    lineItems: { type: mongoose_1.Schema.Types.Mixed, required: true },
    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    walletAmountDeducted: { type: Number, default: 0 },
    taxableAmount: { type: Number, required: true },
    isInterstate: { type: Boolean, default: false },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ['ISSUED', 'PAID', 'VOID', 'REFUNDED'], default: 'ISSUED' },
    pdfUrl: { type: String, default: '' },
    issuedAt: { type: Date, default: Date.now }
}, { timestamps: { createdAt: true, updatedAt: false } });
SubscriptionInvoiceSchema.index({ invoiceNumber: 1, vendorId: 1, orderId: 1 });
exports.SubscriptionInvoice = mongoose_1.default.model('SubscriptionInvoice', SubscriptionInvoiceSchema);
