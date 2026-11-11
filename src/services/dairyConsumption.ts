import { dairyProductComponents, DairyComponent } from './dairyComponents';

export function dairyConsumption(subscriptions: any[], tasks: any[], products: any[], from: string, through: string) {
  return subscriptions.map(sub => {
    const deliveries = new Map<string, any>();
    for (const task of tasks.filter(task => String(task.subscriptionId) === String(sub._id) && task.status === 'delivered' && task.date >= from && task.date <= through)) {
      if (!deliveries.has(task.date) || task.reportingVersion === 1) deliveries.set(task.date, task);
    }
    const product = products.find(item => String(item._id) === String(sub.productId));
    const groups = new Map<string, DairyComponent>(); let legacyDeliveries = 0;
    for (const task of deliveries.values()) {
      const snapshot = task.reportingVersion === 1 && task.reportedComponents?.length;
      const items: DairyComponent[] = snapshot ? task.reportedComponents : dairyProductComponents(String(sub.productId), sub.quantity, products);
      if (!snapshot) legacyDeliveries++;
      for (const item of items) {
        // Different recorded pack sizes are distinct historical reporting rows.
        const key = `${item.productId}:${item.packSize || ''}`, current = groups.get(key);
        if (!current) groups.set(key, { productId: String(item.productId), productName: item.productName, packs: item.packs, packSize: item.packSize, litres: item.litres, warning: item.warning });
        else { current.packs += item.packs; current.litres = current.litres == null || item.litres == null ? null : current.litres + item.litres; if (item.warning) current.warning = item.warning; }
      }
    }
    const components = [...groups.values()].map(item => ({ ...item, packs: Math.round(item.packs * 1000000) / 1000000, litres: item.litres == null ? null : Math.round(item.litres * 1000) / 1000 }));
    const knownVolumes = components.filter(item => item.litres != null);
    return { subscriptionId: String(sub._id), customerName: sub.customerName || 'Customer', productName: sub.productName || product?.name || 'Dairy product', deliveries: deliveries.size,
      packs: components.reduce((sum,item) => sum + item.packs,0), litres: knownVolumes.length ? Math.round(knownVolumes.reduce((sum,item) => sum + item.litres!,0) * 1000) / 1000 : null, components, legacyDeliveries,
      suggestion: deliveries.size ? 'Review the confirmed delivery volume with the customer before changing the next plan.' : 'No confirmed deliveries in this period.' };
  });
}
