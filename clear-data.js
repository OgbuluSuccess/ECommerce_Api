/**
 * Simple script to clear orders, products, categories, and carts from MongoDB
 * Works directly from project root without environment variable concerns
 */

const mongoose = require('mongoose');
const readline = require('readline');
const path = require('path');

// Try to load environment variables but don't fail if it doesn't work
try {
  require('dotenv').config();
} catch (e) {
  console.log('Note: .env file could not be loaded, will prompt for MongoDB URI.');
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Start the process by getting the MongoDB URI
function start() {
  // Try common MongoDB URI environment variable names
  const envMongoUri = process.env.MONGO_URI || 
                      process.env.MONGODB_URI || 
                      process.env.DB_URI || 
                      process.env.DATABASE_URL;

  if (envMongoUri) {
    console.log(`Found MongoDB URI in environment variables.`);
    connect(envMongoUri);
  } else {
    rl.question('Please enter your MongoDB connection string: ', (uri) => {
      if (!uri) {
        console.log('No MongoDB URI provided. Using default localhost connection.');
        connect('mongodb://localhost:27017/ecommerce');
      } else {
        connect(uri);
      }
    });
  }
}

// Connect to MongoDB
function connect(uri) {
  console.log(`Attempting to connect to MongoDB...`);
  
  mongoose.connect(uri)
    .then(() => {
      console.log('✅ Connected to MongoDB');
      loadModels();
    })
    .catch((err) => {
      console.error('❌ MongoDB connection error:', err.message);
      rl.close();
      process.exit(1);
    });
}

// Load models after successful connection
async function loadModels() {
  try {
    // Dynamic import to avoid issues with model definitions
    const Order = mongoose.model('Order') || 
                  mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
    
    const Product = mongoose.model('Product') || 
                    mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
    
    const Cart = mongoose.model('Cart') || 
                 mongoose.model('Cart', new mongoose.Schema({}, { strict: false }));
                 
    const Category = mongoose.model('Category') || 
                  mongoose.model('Category', new mongoose.Schema({}, { strict: false }));
    
    confirmDeletion(Order, Product, Cart, Category);
  } catch (error) {
    console.error('Error loading models:', error.message);
    console.log('\nTrying alternative approach with minimal schemas...');
    
    // Define minimal schemas if models aren't already registered
    const Order = mongoose.models.Order || 
                  mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
    
    const Product = mongoose.models.Product || 
                    mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
    
    const Cart = mongoose.models.Cart || 
                 mongoose.model('Cart', new mongoose.Schema({}, { strict: false }));
                 
    const Category = mongoose.models.Category || 
                  mongoose.model('Category', new mongoose.Schema({}, { strict: false }));
    
    confirmDeletion(Order, Product, Cart, Category);
  }
}

// Confirm before deleting
function confirmDeletion(Order, Product, Cart, Category) {
  console.log('\n⚠️  WARNING: THIS WILL DELETE ALL ORDERS, PRODUCTS, CATEGORIES AND CARTS! ⚠️');
  console.log('This action cannot be undone.');
  
  rl.question('\nType "DELETE" to confirm or anything else to cancel: ', (answer) => {
    if (answer.trim() === 'DELETE') {
      clearData(Order, Product, Cart, Category);
    } else {
      console.log('Operation cancelled. No data was deleted.');
      closeConnection();
    }
  });
}

// Clear data
async function clearData(Order, Product, Cart, Category) {
  try {
    // Clear Orders
    const orderResult = await Order.deleteMany({});
    console.log(`✅ Orders deleted: ${orderResult.deletedCount}`);
    
    // Clear Products
    const productResult = await Product.deleteMany({});
    console.log(`✅ Products deleted: ${productResult.deletedCount}`);
    
    // Clear Carts
    const cartResult = await Cart.deleteMany({});
    console.log(`✅ Carts deleted: ${cartResult.deletedCount}`);
    
    // Clear Categories
    const categoryResult = await Category.deleteMany({});
    console.log(`✅ Categories deleted: ${categoryResult.deletedCount}`);
    
    console.log('\n🎉 Data clearing complete!');
  } catch (error) {
    console.error('❌ Error clearing data:', error.message);
  } finally {
    closeConnection();
  }
}

// Close connection
function closeConnection() {
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed.');
    rl.close();
    process.exit(0);
  });
}

// Start the script
start();
