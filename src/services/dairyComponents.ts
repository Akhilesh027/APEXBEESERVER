import Product from '../models/Product';
import { dairyLitres } from './subscriptionPlan';
import { dairyProductPackLabel } from './dairyProductDetails';

export type DairyComponent = { productId: string; productName: string; packs: number; packSize: string; litres: number | null; warning?: string };
const rounded = (value: number) => Math.round(value * 1000000) / 1000000;

// Reporting expands a kit into its contents, excluding the kit wrapper itself.
// Missing/invalid components remain visible, without an invented liquid volume.
export function dairyProductComponents(productId: string, quantity: number, products: any[]): DairyComponent[] {
  const parent = products.find(product => String(product._id) === String(productId));
  const leaf = (id: string, packs: number, warning?: string): DairyComponent => {
    const product = products.find(item => String(item._id) === String(id));
    return { productId: String(id), productName: product?.name || 'Unavailable component', packs: rounded(packs), packSize: dairyProductPackLabel(product), litres: warning ? null : dairyLitres(product, packs), ...(warning ? { warning } : {}) };
  };
  if (!Number.isFinite(quantity) || quantity < 0) return [leaf(productId, 0, 'Invalid subscription quantity.')];
  if (!parent) return [leaf(productId, quantity, 'Product details are unavailable; volume is unknown.')];
  if (!parent.bundleComponents?.length) return [leaf(productId, quantity)];
  return parent.bundleComponents.map((component: any) => {
    const id = String(component.productId), child = products.find(item => String(item._id) === id);
    if (!Number.isFinite(component.quantity) || component.quantity <= 0) return leaf(id, 0, 'Invalid combo component quantity.');
    const packs = quantity * component.quantity;
    const warning = !child ? 'Combo component details are unavailable.' : id === String(productId) || child.bundleComponents?.length ? 'Nested or circular combo requires correction.' : parent.sellerId && child.sellerId && String(parent.sellerId) !== String(child.sellerId) ? 'Combo component belongs to a different seller.' : undefined;
    return leaf(id, packs, warning);
  });
}

export async function loadDairyReportingProducts(products: any[], vendor: any) {
  const present = new Set(products.map(product => String(product._id)));
  const ids = [...new Set<string>(products.flatMap(product => (product.bundleComponents || []).map((item: any) => String(item.productId))))].filter(id => !present.has(id));
  if (!ids.length) return products;
  const children = await Product.find({ _id: { $in: ids }, sellerId: { $in: [vendor._id, vendor.userId] } }).select('_id sellerId name dairyDetails waterDetails attributes bundleComponents stock expiryDate').lean();
  return [...products, ...children];
}

export function dairyRequirements(subscriptions: any[], products: any[]) {
  const grouped = new Map<string, DairyComponent & { quantity: number; deliveries: number }>();
  for (const sub of subscriptions) {
    const seen = new Set<string>();
    for (const item of dairyProductComponents(String(sub.productId), sub.quantity, products)) {
      const current = grouped.get(item.productId);
      if (current) {
        current.packs = current.quantity = rounded(current.quantity + item.packs);
        current.litres = current.litres == null || item.litres == null ? null : rounded(current.litres + item.litres);
        if (!seen.has(item.productId)) current.deliveries++;
        if (item.warning) current.warning = item.warning;
      } else grouped.set(item.productId, { ...item, quantity: item.packs, deliveries: 1 });
      seen.add(item.productId);
    }
  }
  return [...grouped.values()];
}
