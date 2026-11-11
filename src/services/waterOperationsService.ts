import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { ContainerAccount, WaterMovement } from '../models/BusinessOperations';
import { indiaDate, validDate } from './vendorWorkspaceService';

export function parseWaterProduct(body: any, workspaceId: any) {
  const volume = Number(body.volumeLitres), deposit = Number(body.depositAmount);
  if (body.volumeLitres === '' || !Number.isFinite(volume) || volume < 0.1 || volume > 1000) throw new Error('Enter the water volume from 0.1 to 1,000 litres.');
  if (typeof body.returnable !== 'boolean') throw new Error('Choose whether the container is returnable.');
  if (body.depositAmount === '' || !Number.isFinite(deposit) || deposit < 0 || deposit > 100000 || Math.abs(deposit * 100 - Math.round(deposit * 100)) > 0.000001) throw new Error('Enter a valid deposit with up to two decimal places.');
  if (!body.returnable && deposit !== 0) throw new Error('Non-returnable bottles cannot have a returnable-container deposit.');
  return { volumeLitres: volume, returnable: body.returnable, depositAmount: deposit, workspaceId };
}

export function parseWaterMovement(body: any, today = indiaDate()) {
  if (!['dispatch','return','deposit_received','deposit_refunded'].includes(body.kind)) throw new Error('Choose a container or deposit movement.');
  if (!/^[\w-]{16,120}$/.test(body.requestId || '')) throw new Error('A unique movement reference is required.');
  const date = body.date || today;
  if (!validDate(date) || date > today) throw new Error('Choose today or an earlier valid movement date.');
  const monetary = body.kind.startsWith('deposit_'), quantity = monetary ? 0 : Number(body.quantity);
  const amount = monetary ? Number(body.amount) : 0;
  if (!monetary && (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000)) throw new Error('Enter 1 to 10,000 whole containers.');
  if (monetary && (!Number.isFinite(amount) || amount <= 0 || amount > 1000000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001)) throw new Error('Enter a positive deposit amount with up to two decimal places.');
  const notes = String(body.notes || '').trim(), paymentMethod = monetary ? String(body.paymentMethod || '') : '', paymentReference = monetary ? String(body.paymentReference || '').trim() : '';
  if (notes.length < 5 || notes.length > 500) throw new Error('Enter movement notes between 5 and 500 characters.');
  if (monetary && (!['cash','upi','bank'].includes(paymentMethod) || paymentReference.length < 3 || paymentReference.length > 120)) throw new Error('Record the payment method and receipt or transaction reference.');
  return { kind: body.kind as string, quantity, amountPaise: Math.round(amount * 100), date, notes, paymentMethod, paymentReference, requestId: body.requestId as string };
}

// Records cash/UPI/bank payments already completed outside this ledger. It never
// transfers funds, debits a wallet, or treats an empty return as filled stock.
export class WaterOperationsService {
  static async record(scope: any, body: any, actorId: any, session: mongoose.ClientSession, customer?: { id: any; name: string }) {
    const parsed = parseWaterMovement(body);
    const product = scope.products.find((p: any) => String(p._id) === String(body.productId));
    if (!product || !product.waterDetails?.returnable || String(product.waterDetails.workspaceId) !== String(scope.workspace.id)) throw new Error('Choose a configured returnable water product in this business.');
    let accountName = String(body.account || '').trim(), accountKey = accountName.toLowerCase();
    let existing: any;
    if (body.accountId) {
      if (!mongoose.isValidObjectId(body.accountId)) throw new Error('Choose a valid customer account.');
      existing = await ContainerAccount.findOne({ _id: body.accountId, vendorId: scope.vendor._id, workspaceId: scope.workspace.id }).session(session);
      if (!existing) throw new Error('Customer account not found in this business.');
      accountName = existing.account; accountKey = existing.accountKey;
    } else if (customer) { accountName = customer.name; accountKey = `customer:${customer.id}`; }
    if (accountName.length < 2 || accountName.length > 120) throw new Error('Enter a customer/account name between 2 and 120 characters.');
    const filter = { vendorId: scope.vendor._id, workspaceId: scope.workspace.id, accountKey };
    const requestHash = createHash('sha256').update(JSON.stringify({ workspaceId: String(scope.workspace.id), productId: String(product._id), accountKey, ...parsed })).digest('hex');
    const previous = await WaterMovement.findOne({ vendorId: scope.vendor._id, requestId: parsed.requestId }).session(session);
    if (previous) {
      if (previous.requestHash !== requestHash) throw new Error('This request reference belongs to a different movement.');
      return { duplicate: true };
    }
    let account: any;
    if (['dispatch','deposit_received'].includes(parsed.kind)) {
      account = await ContainerAccount.findOneAndUpdate(filter, {
        $setOnInsert: { ...filter, account: accountName, ...(customer ? { customerId: customer.id } : {}) },
        $inc: parsed.kind === 'dispatch' ? { outstanding: parsed.quantity } : { depositPaise: parsed.amountPaise },
      }, { upsert: true, new: true, session, runValidators: true });
    } else {
      account = await ContainerAccount.findOneAndUpdate({ ...filter, ...(parsed.kind === 'return' ? { outstanding: { $gte: parsed.quantity } } : { depositPaise: { $gte: parsed.amountPaise } }) },
        { $inc: parsed.kind === 'return' ? { outstanding: -parsed.quantity } : { depositPaise: -parsed.amountPaise } }, { new: true, session, runValidators: true });
      if (!account) throw new Error(parsed.kind === 'return' ? 'The return exceeds this account’s outstanding containers.' : 'The refund exceeds this account’s recorded deposit balance.');
    }
    await WaterMovement.create([{ ...parsed, vendorId: scope.vendor._id, workspaceId: scope.workspace.id, productId: product._id, productName: product.name, accountId: account._id, accountName: account.account, requestHash, createdBy: actorId }], { session });
    return { duplicate: false };
  }
}
