/**
 * Script to clear orders, products, categories, and carts from MongoDB
 * USE WITH CAUTION - This will delete ALL orders, products, categories and carts!
 */

const mongoose = require('mongoose');
const readline = require('readline');
const path = require('path');

// Correctly load .env from project root regardless of where script is run from
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Models - importing directly to avoid circular dependencies
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const Cart = require('../models/cart.model'); // Optional: clearing carts as well
const Category = require('../models/category.model'); // Added categories

// Create readline interface for confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// MongoDB connection string - with fallbacks
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';

console.log(`Attempting to connect to MongoDB using: ${MONGO_URI.substring(0, MONGO_URI.indexOf('://') + 6)}...`);

// Connect to MongoDB
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    confirmAndClear();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    console.log('\nTo fix this error:');
    console.log('1. Verify your .env file exists in the project root and contains a MONGO_URI variable');
    console.log('2. Or run with explicit connection string: NODE_MONGO_URI=your_connection_string node src/scripts/clear-test-data.js');
    process.exit(1);
  });

/**
 * Ask for confirmation before clearing data
 */
function confirmAndClear() {
  console.log('\n⚠️  WARNING: THIS WILL DELETE ALL ORDERS, PRODUCTS, CATEGORIES AND CARTS! ⚠️');
  console.log('This action cannot be undone.');
  
  rl.question('\nType "DELETE" to confirm or anything else to cancel: ', (answer) => {
    if (answer.trim() === 'DELETE') {
      clearData();
    } else {
      console.log('Operation cancelled. No data was deleted.');
      closeConnection();
    }
  });
}

/**
 * Clear orders and products from the database
 */
async function clearData() {
  try {
    // Clear Orders
    const orderResult = await Order.deleteMany({});
    console.log(`✅ Orders deleted: ${orderResult.deletedCount}`);
    
    // Clear Products
    const productResult = await Product.deleteMany({});
    console.log(`✅ Products deleted: ${productResult.deletedCount}`);
    
    // Optional: Clear Carts
    const cartResult = await Cart.deleteMany({});
    console.log(`✅ Carts deleted: ${cartResult.deletedCount}`);
    
    // Clear Categories
    const categoryResult = await Category.deleteMany({});
    console.log(`✅ Categories deleted: ${categoryResult.deletedCount}`);
    
    console.log('\nData clearing complete!');
  } catch (error) {
    console.error('Error clearing data:', error);
  } finally {
    closeConnection();
  }
}

/**
 * Close MongoDB connection and readline interface
 */
function closeConnection() {
  rl.close();
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
}
