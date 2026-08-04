"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorPricingService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const SubscriptionCustomerTypePricing_1 = require("../models/SubscriptionCustomerTypePricing");
const SubscriptionVendorPricing_1 = require("../models/SubscriptionVendorPricing");
const SubscriptionVendorAgreement_1 = require("../models/SubscriptionVendorAgreement");
class VendorPricingService {
    /**
     * Resolves the starting base price for a vendor according to the priority:
     * 1. Active Enterprise Vendor Agreement
     * 2. Active Vendor Custom Negotiated Pricing Override
     * 3. Customer Type / Category Pricing
     * 4. Standard Plan Default Price
     */
    static async resolveVendorBasePrice(vendorId, vendorType, productId, priceId, defaultPriceAmount) {
        const vId = new mongoose_1.default.Types.ObjectId(vendorId);
        const pId = new mongoose_1.default.Types.ObjectId(productId);
        const prId = new mongoose_1.default.Types.ObjectId(priceId);
        // 1. Check Enterprise Contract Agreement
        const activeAgreement = await SubscriptionVendorAgreement_1.SubscriptionVendorAgreement.findOne({
            vendorId: vId,
            productId: pId,
            status: 'ACTIVE',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        });
        if (activeAgreement) {
            return {
                resolvedPrice: activeAgreement.lockedPricePerMonth,
                pricingSource: 'ENTERPRISE_AGREEMENT',
                sourceDetails: {
                    agreementNumber: activeAgreement.agreementNumber,
                    contractTitle: activeAgreement.contractTitle
                }
            };
        }
        // 2. Check Custom Vendor Pricing Override
        const activeVendorPricing = await SubscriptionVendorPricing_1.SubscriptionVendorPricing.findOne({
            vendorId: vId,
            productId: pId,
            status: 'ACTIVE',
            validFrom: { $lte: new Date() },
            $or: [{ validTill: { $exists: false } }, { validTill: null }, { validTill: { $gte: new Date() } }]
        });
        if (activeVendorPricing) {
            return {
                resolvedPrice: activeVendorPricing.finalPrice,
                pricingSource: 'VENDOR_OVERRIDE',
                sourceDetails: {
                    originalPrice: activeVendorPricing.originalPrice,
                    overridePrice: activeVendorPricing.overridePrice,
                    reason: activeVendorPricing.reason,
                    validTill: activeVendorPricing.validTill
                }
            };
        }
        // 3. Check Customer Type Pricing
        const customerTypePricing = await SubscriptionCustomerTypePricing_1.SubscriptionCustomerTypePricing.findOne({
            productId: pId,
            priceId: prId,
            vendorType: vendorType.toLowerCase(),
            isActive: true
        });
        if (customerTypePricing) {
            return {
                resolvedPrice: customerTypePricing.customAmount,
                pricingSource: 'CUSTOMER_TYPE_PRICE',
                sourceDetails: {
                    vendorType: customerTypePricing.vendorType
                }
            };
        }
        // 4. Default Plan Price
        return {
            resolvedPrice: defaultPriceAmount,
            pricingSource: 'DEFAULT_PRICE'
        };
    }
}
exports.VendorPricingService = VendorPricingService;
