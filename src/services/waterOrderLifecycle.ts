import mongoose from 'mongoose';
import {Vendor} from '../models/Vendor';
import {WaterOperationsService} from './waterOperationsService';

// Only orders priced with a server-side returnable-water snapshot participate.
// Returning/cancelling an order never assumes that physical empty cans came back.
export async function recordWaterOrderDelivery(order:any, status:string, actorId:any, session:mongoose.ClientSession) {
  if(status.toLowerCase()!=='delivered') return;
  const items=(order.items || []).filter((item:any)=>item.waterDetails?.returnable);
  if(!items.length)return;
  const vendor=await Vendor.findOne({$or:[{_id:order.sellerId},{userId:order.sellerId}]}).session(session);
  if(!vendor)throw new Error('Water seller account could not be found.');
  const grouped=new Map<string,any>();
  for(const item of items){const key=String(item.productId),previous=grouped.get(key);grouped.set(key,{...(typeof item.toObject === 'function' ? item.toObject() : item),quantity:(previous?.quantity || 0)+item.quantity});}
  for(const item of grouped.values()) {
    const product={_id:item.productId,name:item.productName,waterDetails:item.waterDetails};
    const customer=order.customerId ? {id:order.customerId,name:order.customerName || `Customer ${String(order.customerId).slice(-8)}`} : undefined;
    await WaterOperationsService.record({vendor,workspace:{id:String(item.waterDetails.workspaceId)},products:[product]},
      {productId:String(item.productId),kind:'dispatch',quantity:item.quantity,account:`Order ${order.orderNumber}`,notes:`Containers issued with delivered order ${order.orderNumber}.`,requestId:`water-auto-order-${order._id}-${item.productId}`},actorId || vendor.userId,session,customer);
  }
}
