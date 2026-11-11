import assert from 'node:assert/strict';
import {test} from 'node:test';
import {dairyProductComponents, dairyRequirements, loadDairyReportingProducts} from '../services/dairyComponents';
import {dairyConsumption} from '../services/dairyConsumption';
import Product from '../models/Product';

const products:any[] = [
  {_id:'kit',sellerId:'vendor',name:'Family kit',dairyDetails:{packSize:9000,packUnit:'ml'},bundleComponents:['milk','curd','butter','buttermilk'].map(productId=>({productId,quantity:1}))},
  ...[['milk',1000,'ml'],['curd',500,'g'],['butter',100,'g'],['buttermilk',500,'ml']].map(([_id,packSize,packUnit])=>({_id,name:_id,sellerId:'vendor',dairyDetails:{packSize,packUnit}}))
];

test('requirements expand kit contents, exclude wrapper volume, and aggregate direct and kit milk',()=>{
  const items=dairyProductComponents('kit',2,products);
  assert.equal(items.length,4); assert.equal(items.reduce((sum,item)=>sum+item.packs,0),8);
  assert.deepEqual(items.map(item=>item.litres),[2,null,null,1]);
  const demand=dairyRequirements([{productId:'kit',quantity:2},{productId:'milk',quantity:1}],products);
  assert.equal(demand.find(item=>item.productId==='milk')?.quantity,3);
  assert.equal(demand.find(item=>item.productId==='milk')?.deliveries,2);
  assert.equal(demand.some(item=>item.productId==='kit'),false);
});

test('missing, foreign and nested components show warnings without invented litres',()=>{
  const broken=[products[0],{...products[1],sellerId:'other'},{...products[2],bundleComponents:[{productId:'kit',quantity:1}]}];
  const rows=dairyProductComponents('kit',2,broken);
  assert.ok(rows.every(item=>item.warning && item.litres===null));
});

test('consumption snapshots retain delivered contents after catalog and subscription quantities change',()=>{
  const snapshot=dairyProductComponents('kit',2,products);
  const subs=[{_id:'sub',productId:'kit',quantity:99}];
  const tasks=[{subscriptionId:'sub',date:'2026-11-01',status:'delivered',reportingVersion:1,reportedComponents:snapshot},{subscriptionId:'sub',date:'2026-11-01',status:'delivered'},{subscriptionId:'sub',date:'2026-11-02',status:'failed'}];
  const result=dairyConsumption(subs,tasks,[], '2026-11-01','2026-11-30')[0];
  assert.equal(result.deliveries,1); assert.equal(result.packs,8); assert.equal(result.litres,3); assert.equal(result.legacyDeliveries,0);
  tasks.push({subscriptionId:'sub',date:'2026-11-03',status:'delivered'});
  assert.equal(dairyConsumption(subs,tasks,products,'2026-11-01','2026-11-30')[0].legacyDeliveries,1);
});

test('component metadata lookup is constrained to the approved vendor and requests only missing components',async()=>{
  const original=Product.find;
  try {
    (Product as any).find=(filter:any)=>{assert.deepEqual(filter._id.$in,['curd','butter','buttermilk']);assert.deepEqual(filter.sellerId.$in,['vendor','user']);return {select:()=>({lean:async()=>products.slice(2)})};};
    assert.equal((await loadDairyReportingProducts(products.slice(0,2),{_id:'vendor',userId:'user'})).length,5);
  } finally {Product.find=original;}
});
