import type { ClientSession } from 'mongoose';
import Category from '../models/Category';
import { Vendor } from '../models/Vendor';
import { BusinessApplication } from '../models/BusinessApplication';
import { businessWorkspaceKind } from './vendorWorkspaceService';

type DairyProduct = { sellerId: unknown; categoryId?: unknown; subCategoryId?: unknown; subcategoryId?: unknown; dairyDetails?: { dairyType?: string } };
type DairySettings = NonNullable<NonNullable<import('../models/BusinessApplication').IBusinessApplication['businessDetails']>['dairy']>;

class DairyOrderModeError extends Error {
  readonly statusCode = 409;
}

export async function isDairyCatalogProduct(product: DairyProduct, session?: ClientSession) {
  if (product.dairyDetails?.dairyType) return true;
  const subcategoryId = product.subCategoryId || product.subcategoryId;
  if (!product.categoryId || !subcategoryId) return false;
  const query = Category.find({ _id: { $in: [product.categoryId, subcategoryId] } }).select('_id name slug parentId');
  const categories = await (session ? query.session(session) : query).lean();
  const parent = categories.find(category => String(category._id) === String(product.categoryId));
  const child = categories.find(category => String(category._id) === String(subcategoryId));
  return !!parent && !!child && String(child.parentId) === String(parent._id) && businessWorkspaceKind(parent, child) === 'dairy';
}

export async function getDairySettings(userId: unknown, session?: ClientSession) {
  const query = BusinessApplication.findOne({ userId, status: { $in: ['verified', 'approved'] }, 'businessDetails.dairy.businessType': { $exists: true } })
    .sort({ updatedAt: -1 }).select('businessDetails.dairy');
  const application = await (session ? query.session(session) : query).lean();
  return application?.businessDetails?.dairy;
}

export async function getDairySettingsForVendor(vendorId: unknown) {
  const vendor = await Vendor.findById(vendorId).select('userId').lean();
  return vendor ? getDairySettings(vendor.userId) : undefined;
}

export function isDairyWeeklyHoliday(date: string, settings?: DairySettings) {
  return !!settings?.weeklyHoliday && settings.weeklyHoliday === new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

export function enforceDairyOrderMode(settings: DairySettings | undefined, mode: 'one_time' | 'subscription') {
  if (settings?.orderMode === 'subscription' && mode === 'one_time') throw new DairyOrderModeError('This dairy store accepts subscriptions only.');
  if (settings?.orderMode === 'one_time' && mode === 'subscription') throw new DairyOrderModeError('This dairy store accepts one-time orders only.');
}

export async function enforceOneTimeDairyOrder(products: DairyProduct[], session?: ClientSession) {
  const checked = new Set<string>();
  for (const product of products) {
    const seller = String(product.sellerId);
    if (checked.has(seller) || !await isDairyCatalogProduct(product, session)) continue;
    checked.add(seller);
    const query = Vendor.findOne({ $or: [{ _id: product.sellerId }, { userId: product.sellerId }] }).select('userId');
    const vendor = await (session ? query.session(session) : query).lean();
    if (vendor) enforceDairyOrderMode(await getDairySettings(vendor.userId, session), 'one_time');
  }
}
