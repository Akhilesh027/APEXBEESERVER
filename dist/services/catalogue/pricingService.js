"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateServerSidePrice = void 0;
/**
 * Calculates item price server-side based on weight/volume/units.
 * Ensures security against client-side price tampering.
 */
const calculateServerSidePrice = (params) => {
    const { pricingMode, unitPrice, baseUnit = 'kg', selectedQuantity, selectedUnit = 'kg', depositAmount = 0, customWeightAllowed = false, } = params;
    if (unitPrice < 0) {
        return { finalPrice: 0, baseAmount: 0, depositAmount: 0, normalizedQuantityInBaseUnit: 0, isValid: false, error: 'Unit price cannot be negative' };
    }
    if (selectedQuantity <= 0) {
        return { finalPrice: 0, baseAmount: 0, depositAmount: 0, normalizedQuantityInBaseUnit: 0, isValid: false, error: 'Selected quantity must be greater than zero' };
    }
    if (pricingMode === 'fixed' || pricingMode === 'piece' || pricingMode === 'pack' || pricingMode === 'dozen' || pricingMode === 'bunch') {
        const baseAmount = unitPrice * selectedQuantity;
        return {
            finalPrice: Math.round(baseAmount * 100) / 100,
            baseAmount: Math.round(baseAmount * 100) / 100,
            depositAmount: 0,
            normalizedQuantityInBaseUnit: selectedQuantity,
            isValid: true,
        };
    }
    if (pricingMode === 'deposit_plus_product') {
        const baseAmount = unitPrice * selectedQuantity;
        const totalDeposit = depositAmount * selectedQuantity;
        const finalPrice = baseAmount + totalDeposit;
        return {
            finalPrice: Math.round(finalPrice * 100) / 100,
            baseAmount: Math.round(baseAmount * 100) / 100,
            depositAmount: Math.round(totalDeposit * 100) / 100,
            normalizedQuantityInBaseUnit: selectedQuantity,
            isValid: true,
        };
    }
    if (pricingMode === 'weight') {
        // Standard weight conversion to base unit (kg)
        let quantityInKg = selectedQuantity;
        const unitLower = selectedUnit.toLowerCase();
        if (unitLower === 'g' || unitLower === 'gram' || unitLower === 'grams') {
            quantityInKg = selectedQuantity / 1000;
        }
        else if (unitLower === 'kg' || unitLower === 'kilogram' || unitLower === 'kilograms') {
            quantityInKg = selectedQuantity;
        }
        // Supported standard weight steps if custom weight is not allowed
        const supportedKgSteps = [0.1, 0.25, 0.5, 0.75, 1, 2, 3, 5, 10];
        if (!customWeightAllowed) {
            const isSupportedStep = supportedKgSteps.some((step) => Math.abs(step - quantityInKg) < 0.001);
            if (!isSupportedStep && quantityInKg < 10) {
                return {
                    finalPrice: 0,
                    baseAmount: 0,
                    depositAmount: 0,
                    normalizedQuantityInBaseUnit: quantityInKg,
                    isValid: false,
                    error: `Weight ${selectedQuantity}${selectedUnit} is not a standard quantity option and custom weight is not enabled.`,
                };
            }
        }
        const baseAmount = unitPrice * quantityInKg;
        return {
            finalPrice: Math.round(baseAmount * 100) / 100,
            baseAmount: Math.round(baseAmount * 100) / 100,
            depositAmount: 0,
            normalizedQuantityInBaseUnit: quantityInKg,
            isValid: true,
        };
    }
    if (pricingMode === 'volume') {
        // Liquid volume conversion to base unit (litre)
        let quantityInLitres = selectedQuantity;
        const unitLower = selectedUnit.toLowerCase();
        if (unitLower === 'ml' || unitLower === 'millilitre') {
            quantityInLitres = selectedQuantity / 1000;
        }
        else if (unitLower === 'l' || unitLower === 'litre' || unitLower === 'litres') {
            quantityInLitres = selectedQuantity;
        }
        const baseAmount = unitPrice * quantityInLitres;
        return {
            finalPrice: Math.round(baseAmount * 100) / 100,
            baseAmount: Math.round(baseAmount * 100) / 100,
            depositAmount: 0,
            normalizedQuantityInBaseUnit: quantityInLitres,
            isValid: true,
        };
    }
    const baseAmount = unitPrice * selectedQuantity;
    return {
        finalPrice: Math.round(baseAmount * 100) / 100,
        baseAmount: Math.round(baseAmount * 100) / 100,
        depositAmount: 0,
        normalizedQuantityInBaseUnit: selectedQuantity,
        isValid: true,
    };
};
exports.calculateServerSidePrice = calculateServerSidePrice;
