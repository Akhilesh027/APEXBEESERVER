import { indiaDate, validDate } from './vendorWorkspaceService';

export const DAIRY_PRODUCT_TYPES = ['Cow Milk', 'Buffalo Milk', 'Organic Milk', 'Toned Milk', 'Full Cream Milk', 'Double Toned Milk', 'A2 Milk', 'Fresh Curd', 'Organic Curd', 'Butter', 'Ghee', 'Paneer', 'Cheese', 'Cream', 'Buttermilk', 'Flavoured Milk', 'Lassi'] as const;
export interface DairyProductDetails {
  dairyType: string; fatPercentage?: number; packSize: number; packUnit: 'ml' | 'g'; expiryDate: string;
}
const numericInput = (value: unknown) => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value));
export function dairyProductPackLabel(product: any): string {
  if (product?.waterDetails?.volumeLitres) return `${product.waterDetails.volumeLitres} L`;
  const details = product?.dairyDetails;
  if (details?.packSize && details.packUnit) return `${details.packSize} ${details.packUnit}`;
  const legacy = product?.attributes?.volume;
  return String(Array.isArray(legacy) ? legacy[0] || '' : legacy || '');
}
export function validateDairyProductPricing(body: any, existing?: any) {
  const mrp = Number(body.baseMrp ?? existing?.baseMrp);
  const price = Number(body.baseSellingPrice ?? existing?.baseSellingPrice);
  const stock = Number(body.stock ?? existing?.stock);
  if (!numericInput(body.baseMrp ?? existing?.baseMrp) || !numericInput(body.baseSellingPrice ?? existing?.baseSellingPrice) || mrp <= 0 || price <= 0 || price > mrp) throw new Error('Enter a positive dairy price no higher than MRP.');
  if (!numericInput(body.stock ?? existing?.stock) || !Number.isInteger(stock) || stock < 0) throw new Error('Available dairy quantity must be a whole number of packs, zero or more.');
}
export function parseDairyProductDetails(raw: unknown, today = indiaDate()): DairyProductDetails {
  let value: any = raw;
  if (typeof raw === 'string') { try { value = JSON.parse(raw); } catch { throw new Error('Check the dairy product details.'); } }
  if (!value || typeof value !== 'object' || Array.isArray(value) || !DAIRY_PRODUCT_TYPES.includes(value.dairyType)) throw new Error('Choose a dairy product type.');
  const packSize = Number(value.packSize);
  if (!numericInput(value.packSize) || ![250, 500, 1000, 2000].includes(packSize) || !['ml', 'g'].includes(value.packUnit)) throw new Error('Choose a pack size of 250, 500, 1000 or 2000 ml/g.');
  if (DAIRY_PRODUCT_TYPES.slice(0, 7).includes(value.dairyType) && value.packUnit !== 'ml') throw new Error('Milk pack sizes must be in millilitres.');
  const hasFat = value.fatPercentage !== undefined && value.fatPercentage !== null && value.fatPercentage !== '';
  const fatPercentage = hasFat ? Number(value.fatPercentage) : undefined;
  if ((DAIRY_PRODUCT_TYPES.slice(0, 7).includes(value.dairyType) && !hasFat) || (hasFat && (!numericInput(value.fatPercentage) || fatPercentage! < 0 || fatPercentage! > 100))) throw new Error('Enter a fat percentage from 0 to 100 (required for milk).');
  if (!validDate(value.expiryDate) || value.expiryDate < today) throw new Error('Choose an expiry date of today or later.');
  return { dairyType: value.dairyType, ...(hasFat ? { fatPercentage } : {}), packSize, packUnit: value.packUnit, expiryDate: value.expiryDate };
}
