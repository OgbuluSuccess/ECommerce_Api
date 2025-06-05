const cron = require('node-cron');
const mongoose = require('mongoose');
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const { sendAbandonedCartEmails } = require('../utils/cart-recovery');
const { sendOrderSummary } = require('../utils/admin-emails');
const { sendLowStockAlert } = require('../utils/admin-emails');

/**
 * Initialize all email scheduler jobs
 */
const initializeEmailScheduler = () => {
  // Check if MongoDB is connected
  if (mongoose.connection.readyState !== 1) {
    console.warn('Warning: MongoDB is not connected. Email scheduler will be initialized but may not work properly.');
  }
  console.log('Initializing email scheduler jobs...');

  // Run abandoned cart recovery emails daily at 10:00 AM
  cron.schedule('0 10 * * *', async () => {
    console.log('Running scheduled task: Abandoned cart recovery emails');
    try {
      await sendAbandonedCartEmails();
      console.log('Abandoned cart recovery emails task completed successfully');
    } catch (error) {
      console.error('Error in abandoned cart recovery emails task:', error);
    }
  });

  // Run daily order summary at 11:59 PM every day
  cron.schedule('59 23 * * *', async () => {
    console.log('Running scheduled task: Daily order summary');
    try {
      // Get orders from today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      
      const orders = await Order.find({
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }).populate('user').populate('items.product');
      
      if (orders.length > 0) {
        await sendOrderSummary(orders, 'daily');
        console.log(`Daily order summary sent with ${orders.length} orders`);
      } else {
        console.log('No orders today, skipping daily summary email');
      }
    } catch (error) {
      console.error('Error in daily order summary task:', error);
    }
  });

  // Run weekly order summary at 11:59 PM on Sunday
  cron.schedule('59 23 * * 0', async () => {
    console.log('Running scheduled task: Weekly order summary');
    try {
      // Get orders from the past week
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - 7);
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date();
      endOfWeek.setHours(23, 59, 59, 999);
      
      const orders = await Order.find({
        createdAt: { $gte: startOfWeek, $lte: endOfWeek }
      }).populate('user').populate('items.product');
      
      if (orders.length > 0) {
        await sendOrderSummary(orders, 'weekly');
        console.log(`Weekly order summary sent with ${orders.length} orders`);
      } else {
        console.log('No orders this week, skipping weekly summary email');
      }
    } catch (error) {
      console.error('Error in weekly order summary task:', error);
    }
  });

  // Check for low stock products every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('Running scheduled task: Low stock check');
    try {
      // Get products with stock below threshold (e.g., 5 units)
      const lowStockThreshold = parseInt(process.env.LOW_STOCK_THRESHOLD || '5');
      
      const lowStockProducts = await Product.find({
        stock: { $lte: lowStockThreshold, $gt: 0 }
      }).populate('category');
      
      console.log(`Found ${lowStockProducts.length} products with low stock`);
      
      // Send alert for each low stock product
      for (const product of lowStockProducts) {
        // Check if we've already sent an alert for this product recently (in the last 24 hours)
        // This prevents sending multiple alerts for the same product in a short time
        if (!product.lastLowStockAlert || 
            (Date.now() - new Date(product.lastLowStockAlert).getTime() > 24 * 60 * 60 * 1000)) {
          
          await sendLowStockAlert(product);
          console.log(`Low stock alert sent for product: ${product.name}`);
          
          // Update the product with the timestamp of the last alert
          product.lastLowStockAlert = new Date();
          await product.save();
        }
      }
    } catch (error) {
      console.error('Error in low stock check task:', error);
    }
  });

  console.log('Email scheduler jobs initialized successfully');
};

module.exports = {
  initializeEmailScheduler
};
