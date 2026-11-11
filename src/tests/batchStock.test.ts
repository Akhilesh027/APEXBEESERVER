import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allocateBatchStock, BatchStockService, flowerBatchDeadline } from '../services/batchStockService';
import { Inventory } from '../models/Inventory';
import Product from '../models/Product';

test('batch sales reserve earliest-expiring fresh packs and leave expired and already reserved stock untouched', () => {
  const batches = [
    { _id: 'later', expiry: '2026-11-10', remaining: 10, reserved: 2 },
    { _id: 'old', expiry: '2026-11-04', remaining: 30, reserved: 0 },
    { _id: 'soon', expiry: '2026-11-06', remaining: 5, reserved: 1 },
  ];
  assert.deepEqual(allocateBatchStock(batches, 6, 'sale', '2026-11-05'), [{ batchId: 'soon', quantity: 4 }, { batchId: 'later', quantity: 2 }]);
  assert.throws(() => allocateBatchStock(batches, 13, 'sale', '2026-11-05'), /non-expired/);
  assert.deepEqual(allocateBatchStock(batches, 20, 'expired', '2026-11-05'), [{ batchId: 'old', quantity: 20 }]);
  assert.throws(() => allocateBatchStock(batches, 1, 'expired', '2026-11-05', 'soon'), /disposal/);
  assert.deepEqual(allocateBatchStock(batches, 2, 'wastage', '2026-11-05', 'later'), [{ batchId: 'later', quantity: 2 }]);
  assert.equal(batches[0].remaining, 10);
});

test('flower batches expire at their recorded time and sell earliest use-by stock first', () => {
  const today = '2026-11-07';
  const now = Date.parse(`${today}T12:00:00+05:30`);
  assert.equal(flowerBatchDeadline(today, '12:00').getTime(), now);
  assert.throws(() => flowerBatchDeadline(today, '24:00'), /use-by/);
  const batches = [
    { _id: 'legacy', expiry: today, remaining: 2, reserved: 0 },
    { _id: 'expired', expiry: today, expiryAt: new Date(now), remaining: 3, reserved: 0 },
    { _id: 'afternoon', expiry: today, expiryAt: new Date(now + 3600000), remaining: 2, reserved: 0 },
  ];
  assert.deepEqual(allocateBatchStock(batches, 3, 'sale', today, undefined, now), [{ batchId: 'afternoon', quantity: 2 }, { batchId: 'legacy', quantity: 1 }]);
  assert.deepEqual(allocateBatchStock(batches, 3, 'expired', today, undefined, now), [{ batchId: 'expired', quantity: 3 }]);
});

test('delivery stock confirmation captures actual kit contents alongside the same transaction',async()=>{
  const originals:Array<[any,string,any]>=[], mock=(target:any,key:string,value:any)=>{originals.push([target,key,target[key]]);target[key]=value;};
  const session:any={}; let snapshot:any; const updated:string[]=[];
  const products:any[]=[{_id:'kit',sellerId:'seller',status:'Live',isActive:true,bundleComponents:[{productId:'milk',quantity:2}],dairyDetails:{packSize:9000,packUnit:'ml'}},{_id:'milk',name:'Milk',sellerId:'seller',status:'Live',isActive:true,dairyDetails:{packSize:500,packUnit:'ml'}}];
  const query=(value:any)=>{const q:any={select:()=>q,session:(s:any)=>{assert.equal(s,session);return q;},lean:async()=>value,then:(resolve:any,reject:any)=>Promise.resolve(value).then(resolve,reject)};return q;};
  try {
    mock(Product,'find',(filter:any)=>query(products.filter(p=>filter._id.$in.includes(p._id))));
    mock(Product,'findById',(id:string)=>query(products.find(p=>p._id===id)));
    mock(Product,'updateOne',async(filter:any,_update:any,options:any)=>{assert.equal(options.session,session);updated.push(filter._id);return {matchedCount:1};});
    mock(Inventory,'find',()=>query([]));
    mock(BatchStockService,'allocate',async()=>[]);
    await BatchStockService.deliver('kit',3,session,items=>{snapshot=items;});
    assert.deepEqual(updated,['kit','milk']);
    assert.equal(snapshot.length,1);assert.equal(snapshot[0].productId,'milk');assert.equal(snapshot[0].packs,6);assert.equal(snapshot[0].litres,3);
  } finally {originals.reverse().forEach(([target,key,value])=>target[key]=value);}
});

test('inventory validation preserves actual stock instead of creating stock when reservations exceed it', async () => {
  const inventory = new Inventory({ productId: '507f1f77bcf86cd799439011', storeId: '507f1f77bcf86cd799439012', availableStock: 7, reservedStock: 2 });
  await inventory.validate(); assert.equal(inventory.availableStock, 7); assert.equal(inventory.onHand, 7); assert.equal(inventory.reserved, 2);
  const invalid = new Inventory({ productId: '507f1f77bcf86cd799439011', storeId: '507f1f77bcf86cd799439012', availableStock: 2, reservedStock: 3 });
  await assert.rejects(invalid.validate(), /Reserved stock cannot exceed/); assert.equal(invalid.availableStock, 2);
});
