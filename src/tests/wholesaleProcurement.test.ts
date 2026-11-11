import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { WholesaleProcurementService, wholesaleAddress, wholesaleLines } from '../services/wholesaleProcurementService';
import { Wholesaler } from '../models/Wholesaler';
import { BusinessApplication } from '../models/BusinessApplication';
import { User } from '../models/User';
import { Vendor } from '../models/Vendor';
import Product from '../models/Product';
import { Order } from '../models/Order';
import { PurchaseOrder, GoodsReceipt, ProcurementSupplyStock } from '../models/PurchaseOrder';
import { PricingService } from '../services/pricingService';
import { InventoryService } from '../services/inventoryService';
import { WalletEngine } from '../services/WalletEngine';
import { SettlementEngine } from '../services/SettlementEngine';
import * as workspace from '../services/vendorWorkspaceService';
import { updateWholesaleOrderLifecycle } from '../services/wholesaleOrderLifecycle';
import { ProcurementService } from '../services/procurementService';
import { Inventory } from '../models/Inventory';
import InventoryMovement from '../models/InventoryMovement';
import { BatchStockService } from '../services/batchStockService';
const id=(n:number)=>String(n).padStart(24,'0');
const address={fullName:'Sample business',phone:'9000000000',addressLine1:'Sample business street',city:'Sample city',state:'Sample state',pincode:'500001'};
function query(value:any){const q:any={session:()=>q,select:()=>q,sort:()=>q,limit:()=>q,lean:async()=>value,then:(resolve:any,reject:any)=>Promise.resolve(value).then(resolve,reject)};return q;}
function mocks(){const entries:Array<[any,string,any]>=[];return{set(object:any,key:string,value:any){entries.push([object,key,object[key]]);object[key]=value;},restore(){entries.reverse().forEach(([object,key,value])=>object[key]=value);}};}

test('wholesale inputs reject invalid identities, duplicate lines, fractions and invalid receiving mappings',()=>{
  assert.equal(wholesaleLines([{sourceProductId:id(1),quantity:2}])[0].stockTarget,'supplies');
  for(const lines of [[],[{sourceProductId:'invalid',quantity:2}],[{sourceProductId:id(1),quantity:1.5}],[{sourceProductId:id(1),quantity:2,stockTarget:'catalog'}],[{sourceProductId:id(1),quantity:2},{sourceProductId:id(1),quantity:2}]])assert.throws(()=>wholesaleLines(lines));
  assert.deepEqual(wholesaleAddress(address),address);assert.throws(()=>wholesaleAddress({...address,phone:'123'}));
});

test('approved wholesale purchase uses server totals, canonical supplier wallet, one linked order and one payment on retry',async()=>{
  const mock=mocks(),session={withTransaction:async(run:any)=>run(),endSession:async()=>{}},purchases:any[]=[],orders:any[]=[];
  const buyer={_id:id(1),userId:id(2),status:'active',marketplaceStatus:'Approved'},supplier={_id:id(3),userId:id(4),businessName:'Sample wholesaler',pincode:'500001'};
  const scope={vendor:buyer,workspace:{id:id(5),kind:'dairy'},products:[{_id:id(6)}]};
  const product:any={_id:id(7),sellerId:id(4),name:'Milk carton',status:'Live',isActive:true,moq:2,variants:[]};
  let verified=true,total=110,debits=0,reserves=0,commits=0,settlements=0;
  const input:any={supplierId:id(3),requestId:'wholesale-test-request-01',address,lines:[{sourceProductId:id(7),quantity:2,stockTarget:'catalog',productId:id(6),receivedUnitsPerUnit:24}],totalAmount:1};
  try{
    mock.set(mongoose,'startSession',async()=>session);mock.set(Wholesaler,'findOne',()=>query(supplier));mock.set(User,'exists',()=>query(true));mock.set(BusinessApplication,'exists',()=>query(verified));
    mock.set(Product,'find',(filter:any)=>{assert.equal(String(filter.sellerId),id(4));return query([product]);});
    mock.set(Vendor,'findOne',()=>query(buyer));mock.set(workspace,'approvedWorkspaces',async()=>[{id:id(5),kind:'dairy'}]);
    mock.set(PricingService,'calculateCheckoutPricing',async(items:any)=>{assert.equal(items[0].quantity,2);return{orderItems:[{productId:id(7),name:'Milk carton',sku:'MILK',quantity:2,price:50,variantId:null}],orderSummary:{subtotal:100,shippingFee:5,packingFee:0,platformFee:0,tax:5,grandTotal:total,total},sellerId:id(4)};});
    mock.set(PurchaseOrder,'findOne',(filter:any)=>query(purchases.find(p=>p.checkoutRequestId===filter.checkoutRequestId && String(p.vendorId)===String(filter.vendorId))));
    mock.set(PurchaseOrder.prototype,'save',async function(this:any,options:any){assert.equal(options.session,session);if(!purchases.includes(this))purchases.push(this);return this;});
    mock.set(Order.prototype,'save',async function(this:any,options:any){assert.equal(options.session,session);orders.push(this);return this;});
    mock.set(InventoryService,'reserveStock',async(_o:any,user:any,items:any,tx:any)=>{assert.equal(tx,session);assert.equal(String(user),id(2));assert.equal(items[0].quantity,2);reserves++;});
    mock.set(InventoryService,'commitStock',async(_o:any,tx:any)=>{assert.equal(tx,session);commits++;});
    mock.set(WalletEngine,'debit',async(user:any,amount:number,details:any,tx:any)=>{assert.equal(String(user),id(2));assert.equal(amount,110);assert.equal(tx,session);assert.match(details.operationKey,/wholesale-purchase-/);debits++;});
    mock.set(SettlementEngine,'createSettlements',async(order:any,tx:any)=>{assert.equal(tx,session);assert.equal(String(order.sellerId),id(4));settlements++;});
    const preview=await WholesaleProcurementService.preview(scope,input);input.quoteHash=preview.quoteHash;
    const first=await WholesaleProcurementService.checkout(scope,input),retry=await WholesaleProcurementService.checkout(scope,input);
    assert.equal(String(first._id),String(retry._id));assert.equal(debits,1);assert.equal(reserves,1);assert.equal(commits,1);assert.equal(settlements,1);assert.equal(orders.length,1);assert.equal(orders[0].totalAmount,110);assert.equal(String(orders[0].procurementPurchaseOrderId),String(first._id));assert.equal(first.lines[0].receivedUnitsPerUnit,24);
    await assert.rejects(WholesaleProcurementService.checkout(scope,{...input,lines:[{...input.lines[0],quantity:4}]}),/different request/);
    total=120;await assert.rejects(WholesaleProcurementService.checkout(scope,{...input,requestId:'wholesale-test-request-02'}),/price or details changed/);assert.equal(debits,1);
    verified=false;await assert.rejects(WholesaleProcurementService.preview(scope,input),/document-verified/);verified=true;
    await assert.rejects(WholesaleProcurementService.preview(scope,{...input,lines:[{...input.lines[0],productId:id(99)}]}),/approved business/);
    await assert.rejects(WholesaleProcurementService.preview(scope,{...input,lines:[{...input.lines[0],quantity:1}]}),/minimum order/);
    await assert.rejects(WholesaleProcurementService.preview(scope,{...input,address:{...address,pincode:'500002'}}),/local PIN/);
    product.variants=[{_id:id(8)},{_id:id(9)}];await assert.rejects(WholesaleProcurementService.preview(scope,input),/variant/);
    await assert.rejects(WholesaleProcurementService.supplier(id(3),id(4)),/another active/);
    product.variants=[];
    const fresh=await WholesaleProcurementService.preview(scope,input);
    const previousCommits=commits,previousSettlements=settlements;
    mock.set(WalletEngine,'debit',async()=>{throw new Error('Insufficient wallet balance');});
    await assert.rejects(WholesaleProcurementService.checkout(scope,{...input,requestId:'wholesale-test-request-03',quoteHash:fresh.quoteHash}),/Insufficient wallet/);
    assert.equal(commits,previousCommits);assert.equal(settlements,previousSettlements);
  }finally{mock.restore();}
});

test('wholesale cancellation refunds only the purchasing wallet once and blocks refunds after a goods receipt',async()=>{
  const mock=mocks(),session:any={},purchase:any={_id:id(1),number:'PO-SAMPLE',supplierUserId:id(2),lines:[{accepted:0,rejected:0}]},order:any={_id:id(3),procurementPurchaseOrderId:id(1),sellerId:id(2),customerId:id(4),totalAmount:110,paymentStatus:'Paid',paymentDetails:{method:'wallet'}};let credits=0;
  try{
    mock.set(PurchaseOrder,'findOne',()=>query(purchase));mock.set(PurchaseOrder,'updateOne',async(_f:any,update:any,options:any)=>{assert.equal(options.session,session);assert.equal(update.$set.status,'cancelled');return{modifiedCount:1};});
    mock.set(WalletEngine,'credit',async(user:any,amount:number,details:any,tx:any)=>{assert.equal(user,id(4));assert.equal(amount,110);assert.equal(tx,session);assert.equal(details.operationKey,`wholesale-refund-${id(3)}`);credits++;});
    await updateWholesaleOrderLifecycle(order,'Cancelled',session);await updateWholesaleOrderLifecycle(order,'Cancelled',session);assert.equal(credits,1);assert.equal(order.paymentStatus,'Refunded');
    await assert.rejects(updateWholesaleOrderLifecycle(order,'Payment Rejected',session),/paid through wallet/);
    purchase.lines[0].accepted=1;await assert.rejects(updateWholesaleOrderLifecycle(order,'Returned',session),/Goods receipts already exist/);assert.equal(credits,1);
  }finally{mock.restore();}
});

test('marketplace receipt requires paid delivery, converts accepted catalog packs and keeps business supplies separate',async()=>{
  const mock=mocks(),session={withTransaction:async(run:any)=>run(),endSession:async()=>{}},receipts:any[]=[],today=workspace.indiaDate();
  const scope={vendor:{_id:id(1),userId:id(2)},workspace:{id:id(3),kind:'dairy',name:'Milk and Dairy'},products:[{_id:id(4)}]};
  const po:any={_id:id(5),marketplaceOrderId:id(6),number:'PO-SAMPLE',supplier:'Sample wholesaler',status:'ordered',orderDate:today,lines:[{_id:id(7),productId:id(4),stockTarget:'catalog',receivedUnitsPerUnit:24,quantity:2,accepted:0,rejected:0},{_id:id(8),sourceProductId:id(9),stockTarget:'supplies',name:'Feed bag',unit:'bag',quantity:5,accepted:0,rejected:0}],save:async()=>{}};
  const purchased:any={paymentStatus:'Paid',orderStatus:'Shipped'},product:any={_id:id(4),stock:5,attributes:{}},inventory:any={_id:id(10),availableStock:5};let supplies=0,batchPacks=0;
  const input={purchaseOrderId:id(5),requestId:'wholesale-receipt-0001',date:today,notes:'Inspection complete',lines:[{lineId:id(7),accepted:1,rejected:1,batch:'MILK-01',expiry:'2099-01-01'},{lineId:id(8),accepted:4,rejected:1}]};
  try{
    mock.set(mongoose,'startSession',async()=>session);mock.set(GoodsReceipt,'findOne',(filter:any)=>query(receipts.find(r=>r.requestId===filter.requestId)));mock.set(GoodsReceipt,'create',async(items:any[])=>{receipts.push(...items);return items;});
    mock.set(PurchaseOrder,'findOne',()=>query(po));mock.set(PurchaseOrder,'updateOne',async()=>({modifiedCount:1}));mock.set(Order,'findOne',()=>query(purchased));
    mock.set(Product,'findById',()=>query({...product}));mock.set(Product,'updateOne',async(_f:any,update:any)=>{product.stock+=update.$inc.stock;return{matchedCount:1};});
    mock.set(Inventory,'find',()=>query([inventory]));mock.set(Inventory,'updateOne',async(_f:any,update:any)=>{Object.assign(inventory,update.$set);return{modifiedCount:1};});mock.set(InventoryMovement,'create',async()=>[]);
    mock.set(BatchStockService,'receive',async(_p:any,_v:any,_w:any,data:any)=>{batchPacks+=data.quantity;});mock.set(ProcurementSupplyStock,'findOneAndUpdate',async(_f:any,update:any)=>{supplies+=update.$inc.quantity;});
    await assert.rejects(ProcurementService.receive(scope,input,id(2)),/only after.*delivered/);
    purchased.orderStatus='Delivered';purchased.paymentStatus='Refunded';await assert.rejects(ProcurementService.receive(scope,input,id(2)),/paid wholesale order/);
    purchased.paymentStatus='Paid';await ProcurementService.receive(scope,input,id(2));await ProcurementService.receive(scope,input,id(2));
    assert.equal(product.stock,29);assert.equal(inventory.availableStock,29);assert.equal(batchPacks,24);assert.equal(supplies,4);assert.equal(po.status,'received');assert.equal(receipts.length,1);
  }finally{mock.restore();}
});
