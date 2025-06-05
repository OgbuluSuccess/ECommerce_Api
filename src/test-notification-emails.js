require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

// Import email utilities
const { sendOrderConfirmationEmail } = require('./utils/email.utils');
const { sendShippingConfirmationEmail, sendDeliveryConfirmationEmail } = require('./utils/shipping-emails');
const { sendLowStockAlert, sendDailyOrderSummary, sendWeeklyOrderSummary, sendFailedPaymentAlert } = require('./utils/admin-emails');
const { sendAbandonedCartEmail } = require('./utils/cart-recovery');

// Import models
const Order = require('./models/order.model');
const Product = require('./models/product.model');
const Cart = require('./models/cart.model');
const User = require('./models/user.model');

// Create interactive interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connect to MongoDB
async function connectToDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      maxPoolSize: 10
    });
    console.log('✅ Connected to MongoDB successfully');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    return false;
  }
}

// Display menu
function displayMenu() {
  console.log('\n=== EMAIL NOTIFICATION TEST MENU ===');
  console.log('1. Test Order Confirmation Email');
  console.log('2. Test Shipping Confirmation Email');
  console.log('3. Test Delivery Confirmation Email');
  console.log('4. Test Low Stock Alert Email');
  console.log('5. Test Daily Order Summary Email');
  console.log('6. Test Weekly Order Summary Email');
  console.log('7. Test Failed Payment Alert Email');
  console.log('8. Test Abandoned Cart Email');
  console.log('9. Test All Notification Types');
  console.log('0. Exit');
  console.log('====================================\n');
}

// Test order confirmation email
async function testOrderConfirmationEmail() {
  try {
    const order = await Order.findOne().populate('user items.product').sort({ createdAt: -1 }).exec();
    
    if (!order) {
      console.log('❌ No orders found in the database');
      return;
    }
    
    console.log(`Testing order confirmation email for Order #${order.orderNumber}...`);
    await sendOrderConfirmationEmail(order, order.user);
    console.log('✅ Order confirmation email test completed');
  } catch (error) {
    console.error('❌ Error testing order confirmation email:', error.message);
  }
}

// Test shipping confirmation email
async function testShippingConfirmationEmail() {
  try {
    const order = await Order.findOne().populate('user items.product').sort({ createdAt: -1 }).exec();
    
    if (!order) {
      console.log('❌ No orders found in the database');
      return;
    }
    
    // Add mock tracking info if not present
    const trackingInfo = {
      courier: 'DHL Express',
      trackingNumber: 'DHL' + Date.now(),
      trackingUrl: 'https://track.dhl.com/track?id=' + Date.now(),
      estimatedDelivery: '3-5 business days',
      shippedAt: new Date()
    };
    
    console.log(`Testing shipping confirmation email for Order #${order.orderNumber}...`);
    await sendShippingConfirmationEmail(order, order.user, trackingInfo);
    console.log('✅ Shipping confirmation email test completed');
  } catch (error) {
    console.error('❌ Error testing shipping confirmation email:', error.message);
  }
}

// Test delivery confirmation email
async function testDeliveryConfirmationEmail() {
  try {
    const order = await Order.findOne().populate('user items.product').sort({ createdAt: -1 }).exec();
    
    if (!order) {
      console.log('❌ No orders found in the database');
      return;
    }
    
    console.log(`Testing delivery confirmation email for Order #${order.orderNumber}...`);
    await sendDeliveryConfirmationEmail(order, order.user);
    console.log('✅ Delivery confirmation email test completed');
  } catch (error) {
    console.error('❌ Error testing delivery confirmation email:', error.message);
  }
}

// Test low stock alert email
async function testLowStockAlert() {
  try {
    const product = await Product.findOne().sort({ quantity: 1 }).exec();
    
    if (!product) {
      console.log('❌ No products found in the database');
      return;
    }
    
    console.log(`Testing low stock alert email for product ${product.name}...`);
    await sendLowStockAlert(product);
    console.log('✅ Low stock alert email test completed');
  } catch (error) {
    console.error('❌ Error testing low stock alert email:', error.message);
  }
}

// Test daily order summary email
async function testDailyOrderSummary() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const orders = await Order.find({
      createdAt: { $gte: today }
    }).populate('user items.product').exec();
    
    console.log(`Testing daily order summary email with ${orders.length} orders...`);
    await sendDailyOrderSummary(orders);
    console.log('✅ Daily order summary email test completed');
  } catch (error) {
    console.error('❌ Error testing daily order summary email:', error.message);
  }
}

// Test weekly order summary email
async function testWeeklyOrderSummary() {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const orders = await Order.find({
      createdAt: { $gte: oneWeekAgo }
    }).populate('user items.product').exec();
    
    console.log(`Testing weekly order summary email with ${orders.length} orders...`);
    await sendWeeklyOrderSummary(orders);
    console.log('✅ Weekly order summary email test completed');
  } catch (error) {
    console.error('❌ Error testing weekly order summary email:', error.message);
  }
}

// Test failed payment alert email
async function testFailedPaymentAlert() {
  try {
    const order = await Order.findOne().populate('user items.product').sort({ createdAt: -1 }).exec();
    
    if (!order) {
      console.log('❌ No orders found in the database');
      return;
    }
    
    const paymentError = {
      code: 'PAYMENT_FAILED',
      message: 'Card declined by issuer',
      reference: order.paymentDetails?.reference || 'TEST-REF-' + Date.now()
    };
    
    console.log(`Testing failed payment alert email for Order #${order.orderNumber}...`);
    await sendFailedPaymentAlert(order, order.user, paymentError);
    console.log('✅ Failed payment alert email test completed');
  } catch (error) {
    console.error('❌ Error testing failed payment alert email:', error.message);
  }
}

// Test abandoned cart email
async function testAbandonedCartEmail() {
  try {
    const cart = await Cart.findOne()
      .populate('user items.product')
      .sort({ updatedAt: 1 })
      .exec();
    
    if (!cart) {
      console.log('❌ No carts found in the database');
      return;
    }
    
    console.log(`Testing abandoned cart email for user ${cart.user.email}...`);
    await sendAbandonedCartEmail(cart);
    console.log('✅ Abandoned cart email test completed');
  } catch (error) {
    console.error('❌ Error testing abandoned cart email:', error.message);
  }
}

// Test all notification types
async function testAllNotifications() {
  console.log('Testing all notification types...');
  
  await testOrderConfirmationEmail();
  await testShippingConfirmationEmail();
  await testDeliveryConfirmationEmail();
  await testLowStockAlert();
  await testDailyOrderSummary();
  await testWeeklyOrderSummary();
  await testFailedPaymentAlert();
  await testAbandonedCartEmail();
  
  console.log('✅ All notification tests completed');
}

// Process menu selection
async function processSelection(selection) {
  switch (selection) {
    case '1':
      await testOrderConfirmationEmail();
      break;
    case '2':
      await testShippingConfirmationEmail();
      break;
    case '3':
      await testDeliveryConfirmationEmail();
      break;
    case '4':
      await testLowStockAlert();
      break;
    case '5':
      await testDailyOrderSummary();
      break;
    case '6':
      await testWeeklyOrderSummary();
      break;
    case '7':
      await testFailedPaymentAlert();
      break;
    case '8':
      await testAbandonedCartEmail();
      break;
    case '9':
      await testAllNotifications();
      break;
    case '0':
      console.log('Exiting...');
      await mongoose.connection.close();
      rl.close();
      return false;
    default:
      console.log('Invalid selection. Please try again.');
  }
  return true;
}

// Main function
async function main() {
  const connected = await connectToDatabase();
  if (!connected) {
    console.log('Exiting due to database connection failure');
    rl.close();
    return;
  }
  
  let continueRunning = true;
  
  while (continueRunning) {
    displayMenu();
    
    const selection = await new Promise(resolve => {
      rl.question('Enter your selection: ', resolve);
    });
    
    continueRunning = await processSelection(selection);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  mongoose.connection.close();
  rl.close();
  process.exit(1);
});
