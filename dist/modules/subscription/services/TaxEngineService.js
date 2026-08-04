"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxEngineService = void 0;
class TaxEngineService {
    static COMPANY_STATE = 'TELANGANA'; // Default registered company state
    /**
     * Calculates tax components based on company state vs vendor state
     */
    static calculateTax(baseTaxable, gstRate = 18, vendorState, taxMode = 'EXCLUSIVE') {
        if (taxMode === 'NOT_APPLICABLE' || gstRate <= 0) {
            return {
                gstRate: 0,
                isInterstate: false,
                taxableAmount: baseTaxable,
                cgstAmount: 0,
                sgstAmount: 0,
                igstAmount: 0,
                totalGstAmount: 0,
                finalAmount: baseTaxable
            };
        }
        const cleanVendorState = (vendorState || '').trim().toUpperCase();
        const isInterstate = cleanVendorState !== '' && cleanVendorState !== this.COMPANY_STATE;
        let taxableAmount = baseTaxable;
        let totalGstAmount = 0;
        if (taxMode === 'INCLUSIVE') {
            // Derive taxable from gross inclusive amount: Taxable = Gross / (1 + Rate/100)
            taxableAmount = Math.round((baseTaxable / (1 + gstRate / 100)) * 100) / 100;
            totalGstAmount = Math.round((baseTaxable - taxableAmount) * 100) / 100;
        }
        else {
            // Exclusive mode: GST = Taxable * Rate / 100
            totalGstAmount = Math.round(((baseTaxable * gstRate) / 100) * 100) / 100;
        }
        let cgstAmount = 0;
        let sgstAmount = 0;
        let igstAmount = 0;
        if (isInterstate) {
            igstAmount = totalGstAmount;
        }
        else {
            cgstAmount = Math.round((totalGstAmount / 2) * 100) / 100;
            sgstAmount = Math.round((totalGstAmount - cgstAmount) * 100) / 100;
        }
        const finalAmount = taxMode === 'INCLUSIVE' ? baseTaxable : Math.round((taxableAmount + totalGstAmount) * 100) / 100;
        return {
            gstRate,
            isInterstate,
            taxableAmount,
            cgstAmount,
            sgstAmount,
            igstAmount,
            totalGstAmount,
            finalAmount
        };
    }
}
exports.TaxEngineService = TaxEngineService;
