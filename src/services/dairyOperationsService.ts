import { validDate, nextDate } from './vendorWorkspaceService';

export function parseDairyMovement(body: any, today: string) {
  if (!['collection', 'return', 'wastage', 'expired'].includes(body.type)) throw new Error('Choose collection, return, wastage or expired stock.');
  const quantity = Number(body.quantity);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) throw new Error('Enter a whole number of packs between 1 and 1,000,000.');
  if (!validDate(body.date) || body.date > today) throw new Error('Choose today or an earlier stock date.');
  const notes = String(body.notes || '').trim();
  if (notes.length < 5 || notes.length > 500) throw new Error('Add a stock note of 5–500 characters.');
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(body.requestId || '')) throw new Error('A stock request reference is required.');
  if (body.type === 'return' && !['restock', 'discard'].includes(body.disposition)) throw new Error('Choose whether returned packs can be restocked or must be discarded.');
  if (body.type === 'collection' && (!validDate(body.expiry) || body.expiry < today || !String(body.batch || '').trim())) throw new Error('Record a batch and a non-expired date for collected stock.');
  if (body.type === 'return' && body.disposition === 'restock' && (!validDate(body.expiry) || body.expiry < today)) throw new Error('Only non-expired returns can be restocked.');
  if (body.type === 'return' && body.disposition === 'restock' && !String(body.batch || '').trim()) throw new Error('Record a batch code for restocked returns.');
  // Discarded customer returns never re-enter available stock, and must not be
  // subtracted again: they already left stock when the original sale was made.
  const delta = body.type === 'collection' || (body.type === 'return' && body.disposition === 'restock') ? quantity : body.type === 'return' ? 0 : -quantity;
  return { type: body.type, quantity, date: body.date, notes, delta, requestId: body.requestId,
    disposition: body.type === 'return' ? body.disposition : undefined,
    batch: String(body.batch || '').trim().slice(0, 80), supplier: String(body.supplier || '').trim().slice(0, 120),
    expiry: validDate(body.expiry) ? body.expiry : undefined };
}

export function dairyReportDates(from: unknown, through: unknown, today: string) {
  if (!validDate(from) || !validDate(through) || from > through || through > today || (Date.parse(through) - Date.parse(from)) / 86400000 > 92) throw new Error('Choose a report range of up to 93 days ending today or earlier.');
  return { from, through };
}

export function isDairySummaryTime(now: Date) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(now));
  return hour >= 18;
}

export function expiryStatus(expiry: string | null, today: string, expiryAt?: Date | null, now = Date.now()) {
  if (expiryAt) {
    const remaining = expiryAt.getTime() - now;
    return remaining <= 0 ? 'expired' : remaining <= 6 * 60 * 60 * 1000 ? 'expiring_soon' : 'fresh';
  }
  if (!expiry || !validDate(expiry.slice(0, 10))) return 'not_recorded';
  const day = expiry.slice(0, 10); let threshold = today;
  for (let index = 0; index < 3; index++) threshold = nextDate(threshold);
  return day < today ? 'expired' : day <= threshold ? 'expiring_soon' : 'fresh';
}
