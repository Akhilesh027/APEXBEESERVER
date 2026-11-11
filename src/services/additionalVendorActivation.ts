import mongoose from 'mongoose';
import { BusinessApplication } from '../models/BusinessApplication';
import { Vendor } from '../models/Vendor';
import { VendorCategoryAccess } from '../models/VendorCategoryAccess';
import Category from '../models/Category';
import { approvedApplicationSubcategories } from './applicationSubcategoryDecisions';
import { mergeVendorBusinessAccess } from './additionalVendorAccess';
import Notification from '../models/Notification';

export async function activateAdditionalVendorAccess(applicationId: any) {
  const session = await mongoose.startSession(); let result: any;
  try {
    await session.withTransaction(async () => {
      const app = await BusinessApplication.findById(applicationId).session(session);
      if (!app || !app.isAdditionalCategoryApplication || app.applicationType !== 'vendor') throw new Error('Additional-category application not found.');
      if (app.status === 'verified') { result = app; return; }
      if (!['under_review', 'kyc_submitted'].includes(app.status) || app.kycStatus !== 'pending') throw new Error('Complete document submission and review before activating additional access.');
      const vendor = await Vendor.findOne({ userId: app.userId }).session(session);
      if (!vendor || vendor.status !== 'active' || vendor.marketplaceStatus !== 'Approved') throw new Error('The existing vendor must remain active and approved.');
      const names = approvedApplicationSubcategories(app);
      if (!names.length) throw new Error('Approve at least one requested subcategory before activation.');
      const children = await Category.find({ _id: { $in: (app.categorySelections || []).flatMap(row => row.subcategoryIds) }, name: { $in: names }, level: 2, isActive: true }).select('_id name parentId').session(session).lean();
      const parents = await Category.find({ _id: { $in: children.map(child => child.parentId) }, level: 1, isActive: true }).select('_id name').session(session).lean();
      if (children.length !== names.length || children.some(child => !parents.some(parent => String(parent._id) === String(child.parentId)))) throw new Error('An approved category is no longer available. Reopen the application review.');
      const merged = mergeVendorBusinessAccess(vendor, { categories: parents.map(parent => parent.name), allowedCategories: parents.map(parent => parent._id), approvedSubcategories: names, subCategories: names });
      for (const key of ['category', 'primaryCategory', 'categories', 'allowedCategories', 'subCategory', 'approvedSubcategories', 'subCategories']) (vendor as any)[key] = merged[key];
      await vendor.save({ session });
      for (const parent of parents) {
        const previous = await VendorCategoryAccess.findOne({ vendorId: vendor._id, parentCategoryId: parent._id }).session(session);
        const oldIds = previous && ['approved', 'partially_approved'].includes(previous.status) ? previous.approvedSubcategoryIds || [] : [];
        const ids = [...new Map([...oldIds, ...children.filter(child => String(child.parentId) === String(parent._id)).map(child => child._id)].map(id => [String(id), id])).values()];
        const restrictions = previous?.restrictions || {};
        await VendorCategoryAccess.findOneAndUpdate({ vendorId: vendor._id, parentCategoryId: parent._id }, { $set: { storeId: vendor._id, status: 'approved', approvedSubcategoryIds: ids, approvedAt: new Date(), approvedItemTypes: ['product', 'service'], restrictions: { canCreateProducts: true, canCreateServices: true, canOfferSubscriptions: true, canAcceptBulkOrders: true, canJoinFestivalCombos: true, canSellWholesale: true, ...(typeof (restrictions as any).toObject === 'function' ? (restrictions as any).toObject() : restrictions) } } }, { session, upsert: true, new: true, runValidators: true });
      }
      app.status = 'verified'; app.kycStatus = 'verified'; app.approvedSubcategories = names;
      await app.save({ session }); result = app;
      await Notification.create([{ recipientId: app.userId, recipientType: 'User', eventCode: 'application.additional_category_activated', title: 'Additional business access activated', message: `Your verified business access now includes ${names.join(', ')}. Open the vendor portal and select the new business.`, entityType: 'application', entityId: app._id, status: 'unread', deepLink: '/#dashboard' }], { session });
    });
    return result;
  } finally { await session.endSession(); }
}
