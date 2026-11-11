import mongoose from 'mongoose';
import Product from '../models/Product';
export function expandBundleItems(items: Array<{ productId: string; quantity: number; variantId?: string | null }>, products: any[]) {
  const expanded: Array<{ productId: string; quantity: number; variantId?: string | null }> = [];
  for (const item of items) {
    const product = products.find(p => String(p._id) === item.productId);
    expanded.push(item);
    if (!product?.bundleComponents?.length) continue;
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new Error('Buy a whole number of kits or combos.');
    for (const component of product.bundleComponents) {
      if (String(component.productId) === item.productId || !Number.isFinite(component.quantity) || component.quantity <= 0) throw new Error('This bundle has an invalid component.');
      const child = products.find(p => String(p._id) === String(component.productId));
      if (!child || child.bundleComponents?.length || child.status !== 'Live' || !child.isActive || child.variants?.length > 1 || String(child.sellerId) !== String(product.sellerId)) throw new Error('A bundle component is unavailable, belongs to another seller, has variants, or is itself a bundle.');
      expanded.push({ productId: String(component.productId), quantity: component.quantity * item.quantity, variantId: null });
    }
  }
  const grouped = new Map<string, typeof expanded[number]>();
  for (const item of expanded) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 1000000) throw new Error('Invalid checkout component quantity.');
    const key = `${item.productId}:${item.variantId || ''}`, previous = grouped.get(key);
    grouped.set(key, { ...item, quantity: (previous?.quantity || 0) + item.quantity });
  }
  if (grouped.size > 200 || [...grouped.values()].some(item => item.quantity > 1000000)) throw new Error('The checkout contains too many component units.');
  return [...grouped.values()];
}
export async function checkoutBundleItems(items: any[], session: mongoose.ClientSession) {
  const parents = await Product.find({ _id: { $in: items.map(item => item.productId) } }).select('sellerId status isActive bundleComponents variants').session(session).lean();
  const childIds = parents.flatMap(product => (product.bundleComponents || []).map(component => component.productId));
  const children = childIds.length ? await Product.find({ _id: { $in: childIds } }).select('sellerId status isActive bundleComponents variants').session(session).lean() : [];
  return expandBundleItems(items, [...parents, ...children]);
}
