import { indiaDate, isDeliveryDue, nextDate, validDate } from './vendorWorkspaceService';
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function parseSubscriptionPlan(body: any, today = indiaDate()) {
  const modern = body.scheduleVersion === 2;
  if (!['daily', 'alternate', 'custom', 'weekly', 'monthly'].includes(body.frequency)) throw new Error('Choose a valid delivery frequency.');
  if (modern && !['weekly', 'monthly'].includes(body.billingCycle)) throw new Error('Choose a weekly or monthly billing cycle.');
  if (body.customDays !== undefined && !Array.isArray(body.customDays)) throw new Error('Choose valid delivery weekdays.');
  const customDays = body.frequency === 'custom' ? [...new Set<string>((body.customDays || []).map((value: unknown) => {
    if (typeof value !== 'string') throw new Error('Choose valid delivery weekdays.');
    const normalized = value.trim().toLowerCase();
    const day = weekdays.find(item => item.toLowerCase() === normalized || item.slice(0, 3).toLowerCase() === normalized);
    if (!day) throw new Error('Choose valid delivery weekdays.');
    return day;
  }))] : [];
  if (body.frequency === 'custom' && !customDays.length) throw new Error('Choose at least one delivery weekday.');
  const startDate = modern ? body.startDate : today;
  if (!validDate(startDate) || startDate < today) throw new Error('Choose a start date of today or later.');
  return { frequency: body.frequency, customDays, startDate, scheduleVersion: modern ? 2 : 1,
    ...(modern ? { billingCycle: body.billingCycle as 'weekly' | 'monthly' } : {}) };
}

export function currentSubscriptionCycleEnd(sub: { startDate: string; scheduleVersion?: number; billingCycle?: string }, day: string) {
  const effectiveDay = day < sub.startDate ? sub.startDate : day;
  if (sub.scheduleVersion === 2 && sub.billingCycle === 'weekly') {
    const start = Date.parse(`${sub.startDate}T00:00:00Z`);
    const weeks = Math.floor((Date.parse(`${effectiveDay}T00:00:00Z`) - start) / (7 * 86400000));
    return new Date(start + (weeks * 7 + 6) * 86400000).toISOString().slice(0, 10);
  }
  return subscriptionBillingWindow(sub, effectiveDay.slice(0, 7)).endDate;
}

export function subscriptionBillingWindow(sub: any, period: string) {
  if (sub.scheduleVersion === 2 && sub.billingCycle === 'weekly') {
    if (!validDate(period) || !validDate(sub.startDate) || period < sub.startDate || (Date.parse(period) - Date.parse(sub.startDate)) / 86400000 % 7 !== 0) throw new Error('For weekly billing, choose a cycle start date aligned with the subscription start date.');
    let endDate = period; for (let index = 0; index < 6; index++) endDate = nextDate(endDate);
    return { startDate: period, endDate, billingCycle: 'weekly' as const };
  }
  if (typeof period !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || !validDate(`${period}-01`)) throw new Error('Choose a billing month in YYYY-MM format.');
  const [year, month] = period.split('-').map(Number);
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { startDate: `${period}-01`, endDate, billingCycle: 'monthly' as const };
}

export function statementDeliveryWindow(statement: { periodStart?: string; periodEnd?: string; billingPeriod: string }) {
  if (statement.periodStart || statement.periodEnd) {
    if (!validDate(statement.periodStart) || !validDate(statement.periodEnd) || statement.periodStart! > statement.periodEnd!) throw new Error('Statement delivery dates are invalid.');
    return { startDate: statement.periodStart!, endDate: statement.periodEnd! };
  }
  const { startDate, endDate } = subscriptionBillingWindow({}, statement.billingPeriod);
  return { startDate, endDate };
}

export function plannedDeliveryCount(sub: any, startDate: string, endDate: string) {
  const plan = typeof sub.toObject === 'function' ? sub.toObject() : sub;
  let count = 0;
  for (let date = startDate; date <= endDate; date = nextDate(date)) if (isDeliveryDue({ ...plan, status: 'active' }, date)) count++;
  return count;
}

export function dairyLitres(product: any, packs: number): number | null {
  if (product?.waterDetails?.volumeLitres > 0) return Number.isFinite(packs) && packs >= 0 ? Math.round(product.waterDetails.volumeLitres * packs * 1000) / 1000 : null;
  const details = product?.dairyDetails;
  if (details?.packUnit === 'g') return null;
  let ml = details?.packUnit === 'ml' ? Number(details.packSize) : NaN;
  if (!Number.isFinite(ml)) {
    const raw = product?.attributes?.volume;
    const label = String(Array.isArray(raw) ? raw[0] || '' : raw || '').trim();
    const match = label.match(/^(\d+(?:\.\d+)?)\s*(ml|millilitres?|l|litres?|liters?)$/i);
    if (!match) return null;
    ml = Number(match[1]) * (/^m/i.test(match[2]) ? 1 : 1000);
  }
  return ml > 0 && Number.isFinite(packs) && packs >= 0 ? Math.round(ml * packs) / 1000 : null;
}
