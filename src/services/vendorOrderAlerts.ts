export const newOrderStatuses = ['Placed', 'placed', 'New'];
export const preparingOrderStatuses = ['accepted', 'Accepted', 'preparing', 'Preparing', 'Confirmed', 'confirmed', 'Processing', 'processing', 'Reached Vendor', 'Payment Verified'];
export const orderDeadlineWarningMs = 5 * 60 * 1000;

export function vendorOrderAlert(order: { orderStatus: string; estimatedDeliveryTime?: Date | null }, now: number) {
  if (newOrderStatuses.includes(order.orderStatus)) return 'new';
  if (!preparingOrderStatuses.includes(order.orderStatus) || !order.estimatedDeliveryTime) return null;
  const timeLeft = order.estimatedDeliveryTime.getTime() - now;
  if (!Number.isFinite(timeLeft)) return null;
  if (timeLeft <= 0) return 'overdue';
  return timeLeft <= orderDeadlineWarningMs ? 'due_soon' : null;
}
