import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DairyBillingJob, lastClosedBillingPeriod, billingPeriodsWithDeliveries } from '../services/dairyBillingJob';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { SubscriptionStatement } from '../models/SubscriptionStatement';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import { SubscriptionBillingService } from '../services/SubscriptionBillingService';

test('automatic billing waits for closed aligned weekly or calendar monthly periods', () => {
  const weekly = { startDate: '2026-11-06', scheduleVersion: 2, billingCycle: 'weekly' };
  assert.equal(lastClosedBillingPeriod(weekly, '2026-11-12'), null);
  assert.equal(lastClosedBillingPeriod(weekly, '2026-11-13'), '2026-11-06');
  assert.equal(lastClosedBillingPeriod(weekly, '2026-11-21'), '2026-11-13');
  assert.equal(lastClosedBillingPeriod({ ...weekly, billingCycle: 'monthly' }, '2026-11-30'), null);
  assert.equal(lastClosedBillingPeriod({ ...weekly, billingCycle: 'monthly' }, '2026-12-01'), '2026-11');
  assert.equal(lastClosedBillingPeriod({ ...weekly, startDate: 'bad' }, '2026-12-01'), null);
});

test('a concurrent unique statement collision skips that period and continues later missed cycles',async()=>{
  const originals:Array<[any,string,any]>=[], mock=(object:any,key:string,value:any)=>{originals.push([object,key,object[key]]);object[key]=value;};
  const query=(value:any)=>{const q:any={select:()=>q,lean:async()=>value};return q;};
  const calls:string[]=[];
  try {
    mock(LocalShopSubscription,'find',async()=>[{_id:'sub',startDate:'2026-09-01',scheduleVersion:2,billingCycle:'weekly'}]);
    mock(SubscriptionDeliveryTask,'find',()=>query([{date:'2026-09-02'},{date:'2026-09-09'}]));
    mock(SubscriptionStatement,'find',()=>query([]));
    mock(SubscriptionBillingService,'generateStatement',async(_id:any,period:string)=>{calls.push(period);if(period==='2026-09-01')throw Object.assign(new Error('duplicate'),{code:11000});});
    const result=await DairyBillingJob.run(new Date('2026-11-06T00:00:00+05:30'));
    assert.deepEqual(calls,['2026-09-01','2026-09-08']);assert.equal(result.generated,1);assert.equal(result.failed,0);
  } finally {originals.reverse().forEach(([object,key,value])=>object[key]=value);}
});

test('missed billing finds all closed periods with deliveries, including leap months and aligned weeks', () => {
  const sub = {startDate:'2024-01-29',scheduleVersion:2,billingCycle:'weekly'};
  assert.deepEqual(billingPeriodsWithDeliveries(sub,['2024-01-28','2024-01-29','2024-02-04','2024-02-06','2024-02-29','2024-03-04','bad'],'2024-03-05'),['2024-01-29','2024-02-05','2024-02-26']);
  assert.deepEqual(billingPeriodsWithDeliveries({...sub,billingCycle:'monthly'},['2024-01-29','2024-02-29','2024-03-01'],'2024-03-05'),['2024-01','2024-02']);
  assert.deepEqual(billingPeriodsWithDeliveries({...sub,scheduleVersion:1},['2024-02-29'],'2024-03-01'),['2024-02']);
});

test('automatic draft billing recovers missed months, retries failures, preserves statements and avoids overlapping bills', async () => {
  const originals: Array<[any, string, any]> = [], mock = (object: any, key: string, value: any) => { originals.push([object, key, object[key]]); object[key] = value; };
  const saved: any[] = [{billingPeriod:'2026-08',periodStart:'2026-08-01',periodEnd:'2026-08-31'}];
  const calls: string[] = []; let fail = true;
  const query = (value:any) => { const q:any = {select:()=>q,lean:async()=>value}; return q; };
  try {
    mock(LocalShopSubscription, 'find', async () => [{ _id: 'sub', status:'cancelled', startDate: '2026-07-01', scheduleVersion: 2, billingCycle: 'monthly' }, { _id: 'empty', startDate: '2026-07-01', scheduleVersion: 2, billingCycle: 'monthly' }, {_id:'changed', startDate:'2026-11-01',scheduleVersion:2,billingCycle:'weekly'}]);
    mock(SubscriptionStatement, 'find', (filter:any) => query(filter.subscriptionId === 'changed' ? [{billingPeriod:'2026-11',periodStart:'2026-11-01',periodEnd:'2026-11-30'}] : saved.slice()));
    mock(SubscriptionDeliveryTask, 'find', (filter:any) => { assert.equal(filter.status,'delivered'); assert.equal(filter.date.$lt,'2026-12-01'); return query((filter.subscriptionId === 'empty' ? [] : filter.subscriptionId === 'changed' ? ['2026-11-02'] : ['2026-07-10','2026-08-10','2026-09-10','2026-10-10','2026-11-10']).map(date=>({date}))); });
    mock(SubscriptionBillingService, 'generateStatement', async (id: any, period: string) => { assert.equal(id,'sub'); calls.push(period); if(fail && period==='2026-09') throw new Error('temporary database failure'); saved.push({billingPeriod:period}); });
    const first = await DairyBillingJob.run(new Date('2026-12-01T00:00:00+05:30'));
    assert.equal(first.generated,3); assert.equal(first.failed,1); assert.equal(first.overlaps,1);
    assert.deepEqual(calls,['2026-07','2026-09','2026-10','2026-11']);
    fail = false;
    assert.equal((await DairyBillingJob.run(new Date('2026-12-01T01:00:00+05:30'))).generated,1);
    assert.equal((await DairyBillingJob.run(new Date('2026-12-01T02:00:00+05:30'))).generated,0);
    assert.deepEqual(calls,['2026-07','2026-09','2026-10','2026-11','2026-09']);
  } finally { originals.reverse().forEach(([object, key, value]) => object[key] = value); }
});
