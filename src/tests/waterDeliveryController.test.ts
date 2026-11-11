import assert from 'node:assert/strict';
import {test} from 'node:test';
import {deliverOrder} from '../controllers/deliveryController';
import {Order} from '../models/Order';
import {DeliveryAssignment} from '../models/DeliveryAssignment';
import {OrderStateMachine} from '../services/OrderStateMachine';

test('one-time water delivery requires the actual OTP and uses the transactional order lifecycle',async()=>{
  const originals:Array<[any,string,any]>=[],mock=(target:any,key:string,value:any)=>{originals.push([target,key,target[key]]);target[key]=value;};
  const id='507f1f77bcf86cd799439011';let transitions=0,writes=0;
  const order:any={_id:id,items:[{waterDetails:{returnable:true}}],deliveryVerification:{otp:'876543'},paymentDetails:{}};
  const response=()=>{const res:any={statusCode:200,status:(code:number)=>{res.statusCode=code;return res;},json:(body:any)=>{res.body=body;return res;}};return res;};
  try {
    mock(Order,'findById',async()=>order);mock(DeliveryAssignment,'findOne',async()=>null);
    mock(OrderStateMachine,'transition',async(orderId:any,status:string,meta:any)=>{assert.equal(orderId,id);assert.equal(status,'Delivered');assert.equal(meta.userId,id);transitions++;return order;});
    mock(Order,'findByIdAndUpdate',async(_id:any,update:any)=>{writes++;assert.equal(update.orderStatus,'Delivered');assert.equal(update.timeline,undefined);});
    for(const otp of [undefined,'3221','1357','000000']) {const res=response();await deliverOrder({params:{id},body:{otp},user:{id}} as any,res);assert.equal(res.statusCode,400);assert.equal(res.body.message.includes('876543'),false);}
    assert.equal(transitions,0);assert.equal(writes,0);
    const res=response();await deliverOrder({params:{id},body:{otp:'876543'},user:{id}} as any,res);
    assert.equal(res.statusCode,200);assert.equal(transitions,1);assert.equal(writes,1);
  } finally {originals.reverse().forEach(([target,key,value])=>target[key]=value);}
});
