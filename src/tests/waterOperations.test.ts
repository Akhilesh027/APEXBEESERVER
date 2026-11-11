import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseWaterProduct,parseWaterMovement,WaterOperationsService} from '../services/waterOperationsService';
import {isWaterWorkspace} from '../services/vendorWorkspaceService';
import {ContainerAccount,WaterMovement} from '../models/BusinessOperations';
import {dairyLitres} from '../services/subscriptionPlan';
import {dairyProductPackLabel} from '../services/dairyProductDetails';
import {recordWaterOrderDelivery} from '../services/waterOrderLifecycle';
import {Vendor} from '../models/Vendor';

const id='507f1f77bcf86cd799439011', workspace='507f1f77bcf86cd799439012', productId='507f1f77bcf86cd799439013';
const details={volumeLitres:20,returnable:true,depositAmount:150,workspaceId:workspace};

test('production Water Cans and legacy Hydration names enable only the Daily Needs water workspace',()=>{
  assert.equal(isWaterWorkspace({categoryName:'Daily Needs',name:'Water Cans'}),true);
  assert.equal(isWaterWorkspace({categoryName:'Daily Needs',slug:'water-and-hydration'}),true);
  assert.equal(isWaterWorkspace({categoryName:'Services',name:'Water Cans'}),false);
  assert.equal(isWaterWorkspace({categoryName:'Daily Needs',name:'Milk and Dairy'}),false);
  assert.equal(dairyLitres({waterDetails:details},3),60);
  assert.equal(dairyProductPackLabel({waterDetails:details}),'20 L');
});

test('water product settings and deposit/return inputs validate units, precision, references and dates',()=>{
  assert.equal(parseWaterProduct(details,workspace).depositAmount,150);
  for(const body of [{...details,volumeLitres:0},{...details,returnable:false},{...details,depositAmount:1.001},{...details,returnable:'true'}])assert.throws(()=>parseWaterProduct(body,workspace));
  const movement={kind:'deposit_received',amount:'300.50',date:'2026-11-06',paymentMethod:'upi',paymentReference:'UPI-123',notes:'Payment received from customer',requestId:'movement-reference-1234'};
  assert.equal(parseWaterMovement(movement,'2026-11-06').amountPaise,30050);
  for(const body of [{...movement,amount:-1},{...movement,amount:1.001},{...movement,paymentReference:''},{...movement,date:'2026-02-31'},{...movement,date:'2026-11-07'},{...movement,kind:'return',quantity:1.5}])assert.throws(()=>parseWaterMovement(body,'2026-11-06'));
});

test('water ledger preserves opening balances, clamps refunds/returns and deduplicates exact requests',async()=>{
  const originals:Array<[any,string,any]>=[],mock=(target:any,key:string,value:any)=>{originals.push([target,key,target[key]]);target[key]=value;};
  let account:any={_id:id,account:'Customer One',accountKey:'customer one',outstanding:2,depositPaise:0};
  const saved:any[]=[];const session:any={};let writes=0;
  const query=(value:any)=>({session:async(s:any)=>{assert.equal(s,session);return value;}});
  const scope={vendor:{_id:id},workspace:{id:workspace},products:[{_id:productId,waterDetails:details}]};
  const base={productId,account:'Customer One',date:'2026-11-06',notes:'Recorded actual customer movement',quantity:1};
  let serial=0;const run=(body:any)=>WaterOperationsService.record(scope,{...base,requestId:`water-test-reference-${++serial}`,...body},id,session);
  try {
    mock(WaterMovement,'findOne',(filter:any)=>query(saved.find(row=>row.requestId===filter.requestId)));
    mock(ContainerAccount,'findOneAndUpdate',async(filter:any,update:any,options:any)=>{
      assert.equal(options.session,session);assert.equal(String(filter.workspaceId),workspace);
      if(filter.outstanding && account.outstanding<filter.outstanding.$gte)return null;
      if(filter.depositPaise && account.depositPaise<filter.depositPaise.$gte)return null;
      for(const [key,value] of Object.entries(update.$inc))account[key]=(account[key] || 0)+Number(value);
      return account;
    });
    mock(WaterMovement,'create',async(rows:any[],options:any)=>{assert.equal(options.session,session);saved.push(rows[0]);writes++;});
    await run({kind:'dispatch',quantity:3});assert.equal(account.outstanding,5);
    await run({kind:'return',quantity:2});assert.equal(account.outstanding,3);
    await assert.rejects(run({kind:'return',quantity:4}),/exceeds/);assert.equal(account.outstanding,3);
    const payment={kind:'deposit_received',amount:300,paymentMethod:'cash',paymentReference:'RECEIPT-100',requestId:'water-received-reference-100'};
    await run(payment);assert.equal(account.depositPaise,30000);
    assert.equal((await run(payment)).duplicate,true);assert.equal(account.depositPaise,30000);
    await assert.rejects(run({...payment,amount:400}),/different movement/);
    await run({...payment,kind:'deposit_refunded',amount:125,requestId:'water-refunded-reference-100'});assert.equal(account.depositPaise,17500);
    await assert.rejects(run({...payment,kind:'deposit_refunded',amount:176,requestId:'water-over-refund-reference'}),/exceeds/);
    await assert.rejects(WaterOperationsService.record({...scope,products:[]},{...base,kind:'return',requestId:'foreign-product-reference'},id,session),/configured/);
    await assert.rejects(WaterOperationsService.record({...scope,products:[{_id:productId,waterDetails:{...details,workspaceId:id}}]},{...base,kind:'return',requestId:'foreign-workspace-reference'},id,session),/configured/);
    mock(ContainerAccount,'findOne',(filter:any)=>{assert.equal(filter.vendorId,id);assert.equal(filter.workspaceId,workspace);return query(null);});
    await assert.rejects(run({kind:'return',accountId:productId}),/not found in this business/);
    assert.equal(writes,4);assert.equal(account.outstanding,3);
  } finally {originals.reverse().forEach(([target,key,value])=>target[key]=value);}
});

test('container account schema retains deposit balances in paise without adding filled-stock fields',async()=>{
  const account=new ContainerAccount({vendorId:id,workspaceId:workspace,account:'Sample',accountKey:'sample',outstanding:2,depositPaise:15000});
  await account.validate();assert.equal(account.toObject().depositPaise,15000);
  account.set('depositPaise',-1);await assert.rejects(account.validate(),/minimum/);
});

test('one-time delivered water orders issue each product once using server snapshots and stable customer identity',async()=>{
  const originalVendor=Vendor.findOne,originalRecord=WaterOperationsService.record;const calls:any[]=[];
  const session:any={};
  try {
    (Vendor as any).findOne=()=>({session:async()=>({_id:id,userId:id})});
    WaterOperationsService.record=async(scope:any,body:any,_actor:any,s:any,customer:any)=>{assert.equal(s,session);calls.push({scope,body,customer});return {duplicate:false};};
    const order={_id:id,orderNumber:'AB-WATER-1',sellerId:id,customerId:id,customerName:'Customer One',items:[{productId,quantity:2,waterDetails:details},{productId,quantity:1,waterDetails:details}]};
    await recordWaterOrderDelivery(order,'Packed',id,session);assert.equal(calls.length,0);
    await recordWaterOrderDelivery(order,'Delivered',id,session);assert.equal(calls.length,1);assert.equal(calls[0].body.quantity,3);assert.equal(calls[0].customer.id,id);
    assert.equal(calls[0].scope.products[0].waterDetails.volumeLitres,20);
    await recordWaterOrderDelivery(order,'Returned',id,session);assert.equal(calls.length,1);
  } finally {Vendor.findOne=originalVendor;WaterOperationsService.record=originalRecord;}
});
