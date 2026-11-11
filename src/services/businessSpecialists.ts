import { dailyNeedsProfile } from './dailyNeedsProfile';
import { validDate } from './vendorWorkspaceService';

export function specialistTools(workspace: { name: string; categoryName: string; kind?: string }) {
  const name = `${workspace.categoryName} ${workspace.name}`.toLowerCase();
  const profile = dailyNeedsProfile(workspace);
  return {
    freshness: /fruit|vegetable|flower|garland|meat|seafood|egg|prasadam|offering/.test(name),
    weight: workspace.kind === 'flowers' || /fruit|vegetable|meat|seafood|egg/.test(name),
    containers: /water|hydration/.test(name),
    certification: /organic|healthy/.test(name),
    coldStorage: profile === 'produce' || /meat|seafood|egg/.test(name),
    batchDisposal: workspace.kind === 'flowers' || !!profile,
    expiry: /grocery|staple|organic|healthy|prasadam|offering/.test(name),
    customOrders: workspace.kind === 'flowers' || /shopping|fashion|home & living|home and living|agriculture/.test(name),
    bulkQuotes: /wholesale|business hub|raw material/.test(name),
    bundles: /kit|combo|festival/.test(name),
    bookings: /temple|priest|devotional services/.test(name),
  };
}

export function parseSpecialistRecord(body: any, tools: ReturnType<typeof specialistTools>, today: string) {
  const allowed = ['stock_in', 'wastage', 'expiry_check', ...(tools.batchDisposal ? ['expired_disposal'] : []), ...(tools.freshness ? ['freshness_check'] : []), ...(tools.coldStorage ? ['cold_storage_check'] : []), ...(tools.certification ? ['certification'] : []), ...(tools.bundles ? ['bundle_manifest'] : [])];
  if (!allowed.includes(body.kind)) throw new Error('This tool is not enabled for the selected business.');
  if (!validDate(body.date) || body.date > today) throw new Error('Choose a valid record date ending today or earlier.');
  const notes = String(body.notes || '').trim();
  if (notes.length < 5 || notes.length > 1000) throw new Error('Enter notes between 5 and 1,000 characters.');
  const quantity = Number(body.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000 || (!tools.weight && !Number.isInteger(quantity))) throw new Error(tools.weight ? 'Enter a positive stock quantity.' : 'Enter a whole number of sellable units.');
  if (!/^[\w-]{16,80}$/.test(body.requestId || '')) throw new Error('A request reference is required.');
  const grade = String(body.grade || '').trim().slice(0, 40);
  const temperature = body.temperature === '' || body.temperature == null ? undefined : Number(body.temperature);
  const reference = String(body.reference || '').trim().slice(0, 160);
  const supplier = body.kind === 'stock_in' ? String(body.supplier || '').trim().slice(0, 120) : '';
  const expiry = String(body.expiry || '');
  if (body.kind === 'freshness_check' && !['A', 'B', 'C', 'Rejected'].includes(grade)) throw new Error('Choose a freshness grade.');
  if (body.kind === 'cold_storage_check' && (!Number.isFinite(temperature) || temperature! < -80 || temperature! > 60 || !['chilled', 'frozen'].includes(body.storage))) throw new Error('Record chilled/frozen storage and a valid measured temperature.');
  if (body.kind === 'certification' && (!reference || !/^\d{4}-\d{2}-\d{2}$/.test(expiry))) throw new Error('Record the certification reference and expiry date.');
  if (expiry && (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || !Number.isFinite(Date.parse(expiry)) || new Date(expiry).toISOString().slice(0, 10) !== expiry)) throw new Error('Choose a valid expiry date.');
  if (body.kind === 'bundle_manifest' && !reference) throw new Error('Name the kit or festival combo. List its components and quantities in the notes.');
  return { kind: body.kind, date: body.date, notes, quantity, grade, temperature, storage: ['chilled', 'frozen'].includes(body.storage) ? body.storage : undefined, reference, supplier, expiry, requestId: body.requestId };
}
