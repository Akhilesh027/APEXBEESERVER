import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { Order } from "./src/models/Order";
import { updateOrder } from "./src/controllers/orderController";
import express from "express";

dotenv.config();

const testUpdate = async () => {
  try {
    await connectDB();
    console.log("Connected to DB!");

    // Find a pending/shipped order or any order to test
    const order = await Order.findOne({ orderStatus: { $ne: "Delivered" } });
    if (!order) {
      console.log("No non-delivered order found to test.");
      process.exit(0);
    }

    console.log(`Testing with Order ID: ${order._id}, current status: ${order.orderStatus}`);

    // Create a mock Request and Response
    const req = {
      params: { id: order._id.toString() },
      body: { orderStatus: "Delivered" }
    } as any;

    let responseData: any = null;
    let responseStatus: number = 0;
    const res = {
      status: (code: number) => {
        responseStatus = code;
        return {
          json: (data: any) => {
            responseData = data;
          }
        };
      },
      json: (data: any) => {
        responseStatus = 200;
        responseData = data;
      }
    } as any;

    await updateOrder(req, res);

    console.log(`Response Status: ${responseStatus}`);
    console.log(`Response Data:`, JSON.stringify(responseData, null, 2));

    // Refetch the order from DB to verify if it updated
    const updatedOrder = await Order.findById(order._id);
    console.log(`Refetched status from DB: ${updatedOrder?.orderStatus}`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

testUpdate();
