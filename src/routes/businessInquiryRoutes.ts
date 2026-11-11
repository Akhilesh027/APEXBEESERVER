import { Router } from 'express';
import mongoose from 'mongoose';
import { protect, AuthRequest } from '../middleware/auth';
import Product from '../models/Product';
import { Vendor } from '../models/Vendor';
import { User } from '../models/User';
import { BusinessInquiry } from '../models/BusinessOperations';
import Notification from '../models/Notification';
import { approvedWorkspaces, indiaDate, validDate } from '../services/vendorWorkspaceService';
import { specialistTools } from '../services/businessSpecialists';
import { QuoteCheckoutService } from '../services/quoteCheckoutService';
const router = Router();
router.use(protect);
router.get('/', async (req: AuthRequest, res) => {
  try { const inquiries = await BusinessInquiry.find({ customerId: req.user!.id }).sort({ createdAt: -1 }).limit(100).lean(); res.json({ inquiries }); }
  catch { res.status(500).json({ message: 'Unable to load your business requests.' }); }
});
router.post('/', async (req: AuthRequest, res) => {
  try {
    if (!mongoose.isValidObjectId(req.body.productId)) throw new Error('Choose a valid product.');
    const product = await Product.findById(req.body.productId);
    if (!product || product.status !== 'Live' || !product.isActive) { res.status(404).json({ message: 'This product is not available for requests.' }); return; }
    const vendor = await Vendor.findOne({ $or: [{ _id: product.sellerId }, { userId: product.sellerId }] });
    if (!vendor) { res.status(404).json({ message: 'Store not found.' }); return; }
    const spaces = await approvedWorkspaces(vendor);
    const workspace = spaces.find(space => [product.subCategoryId, product.subcategoryId, product.categoryId].some(id => String(id) === space.id));
    if (!workspace || workspace.kind !== 'catalog') { res.status(403).json({ message: 'This product is not available in an approved catalog business.' }); return; }
    const tools = specialistTools(workspace), allowed = [...(tools.customOrders ? ['custom_order'] : []), ...(tools.bulkQuotes ? ['bulk_quote'] : []), ...(tools.bookings ? ['booking'] : [])];
    const type = req.body.type, quantity = Number(req.body.quantity), notes = String(req.body.notes || '').trim(), requiredDate = String(req.body.requiredDate || '');
    if (!allowed.includes(type) || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000 || notes.length < 5 || notes.length > 2000 || (requiredDate && (!validDate(requiredDate) || requiredDate < indiaDate()))) throw new Error('Choose an available request type, quantity, valid date and requirements.');
    const user = await User.findById(req.user!.id).select('name');
    const inquiry = await BusinessInquiry.create({ vendorId: vendor._id, workspaceId: workspace.id, productId: product._id, customerId: req.user!.id, customerName: user?.name || 'Customer', type, quantity, notes, requiredDate, createdBy: req.user!.id });
    try { await Notification.create({ recipientId: vendor.userId, recipientType: 'User', eventCode: 'business.request_received', title: 'New business request', message: `A customer requested ${type.replace(/_/g, ' ')} for ${product.name}. Open Business Operations to respond.`, entityType: 'product', entityId: product._id, status: 'unread', deepLink: `/#business-operations?workspaceId=${workspace.id}` }); } catch { console.error('Business request saved, but its notification could not be created.'); }
    res.status(201).json({ message: 'Request sent to the store. Track the response in My Requests. No payment was charged.', inquiry });
  } catch (error: any) { res.status(400).json({ message: error.message || 'Unable to send the request.' }); }
});
router.post('/:id/checkout', async (req: AuthRequest, res) => {
  try { const order = await QuoteCheckoutService.checkout(req.params.id, req.user!.id, req.body); res.json({ message: 'Quote order placed.', order: { id: order._id, orderNumber: order.orderNumber, totalAmount: order.totalAmount, paymentStatus: order.paymentStatus } }); }
  catch (error: any) { res.status(400).json({ message: error.message || 'Unable to place the quote order.' }); }
});
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !['accepted', 'declined'].includes(req.body.status)) throw new Error('Choose a valid quote response.');
    const inquiry = await BusinessInquiry.findOneAndUpdate({ _id: req.params.id, customerId: req.user!.id, status: 'quoted' }, { $set: { status: req.body.status } }, { new: true });
    if (!inquiry) { res.status(409).json({ message: 'This quote is unavailable or has already been answered.' }); return; }
    res.json({ message: inquiry.status === 'accepted' ? 'Quote accepted. You can now place the order from My Requests.' : 'Quote declined.', inquiry });
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});
export default router;
