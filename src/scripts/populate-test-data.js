/**
 * Script to populate MongoDB with test products
 * Use after clearing data with clear-test-data.js
 */

const mongoose = require('mongoose');
const readline = require('readline');
const path = require('path');

// Correctly load .env from project root regardless of where script is run from
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Models
const Product = require('../models/product.model');
const Category = require('../models/category.model');

// Create readline interface
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
    startPopulation();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    console.log('\nTo fix this error:');
    console.log('1. Verify your .env file exists in the project root and contains a MONGO_URI variable');
    console.log('2. Or run with explicit connection string: NODE_MONGO_URI=your_connection_string node src/scripts/populate-test-data.js');
    process.exit(1);
  });

/**
 * Start the population process
 */
function startPopulation() {
  console.log('\n🚀 Ready to populate database with test data');
  
  rl.question('Do you want to create sample products? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      populateData();
    } else {
      console.log('Operation cancelled.');
      closeConnection();
    }
  });
}

/**
 * Populate database with test data
 */
async function populateData() {
  try {
    // First, create or find categories
    console.log('Creating categories...');
    const categories = await createCategories();
    
    // Create sample products
    console.log('Creating sample products...');
    await createProducts(categories);
    
    console.log('\n✅ Test data population complete!');
  } catch (error) {
    console.error('Error populating data:', error);
  } finally {
    closeConnection();
  }
}

/**
 * Create or find categories
 */
async function createCategories() {
  const categoryNames = ['Clothing', 'Accessories', 'Footwear', 'New Arrivals', 'Sale'];
  const categories = [];
  
  for (const name of categoryNames) {
    let category = await Category.findOne({ name });
    if (!category) {
      category = await Category.create({
        name,
        description: `${name} category for fashion items`,
        slug: name.toLowerCase().replace(/\s+/g, '-')
      });
      console.log(`  - Created category: ${name}`);
    } else {
      console.log(`  - Found existing category: ${name}`);
    }
    categories.push(category);
  }
  
  return categories;
}

/**
 * Create sample products
 */
async function createProducts(categories) {
  const sampleProducts = [
    {
      name: 'Classic T-Shirt',
      description: 'A comfortable classic fit t-shirt made from premium cotton',
      price: 1999,
      compareAtPrice: 2499,
      stockQuantity: 100,
      images: ['https://via.placeholder.com/800x1000?text=T-Shirt'],
      category: categories[0]._id, // Clothing
      tags: ['t-shirt', 'cotton', 'basic']
    },
    {
      name: 'Designer Jeans',
      description: 'Premium denim jeans with modern styling',
      price: 3999,
      compareAtPrice: 4999,
      stockQuantity: 80,
      images: ['https://via.placeholder.com/800x1000?text=Jeans'],
      category: categories[0]._id, // Clothing
      tags: ['jeans', 'denim', 'pants']
    },
    {
      name: 'Leather Belt',
      description: 'Genuine leather belt with metal buckle',
      price: 2499,
      stockQuantity: 50,
      images: ['https://via.placeholder.com/800x600?text=Belt'],
      category: categories[1]._id, // Accessories
      tags: ['belt', 'leather', 'accessory']
    },
    {
      name: 'Casual Sneakers',
      description: 'Comfortable sneakers for everyday wear',
      price: 5999,
      stockQuantity: 60,
      images: ['https://via.placeholder.com/800x600?text=Sneakers'],
      category: categories[2]._id, // Footwear
      tags: ['shoes', 'sneakers', 'casual']
    },
    {
      name: 'Summer Dress',
      description: 'Light and flowery summer dress',
      price: 4500,
      stockQuantity: 40,
      images: ['https://via.placeholder.com/800x1000?text=Dress'],
      category: categories[0]._id, // Clothing
      isNew: true,
      tags: ['dress', 'summer', 'women']
    },
    {
      name: 'Hooded Jacket',
      description: 'Warm hooded jacket for colder weather',
      price: 7999,
      compareAtPrice: 9999,
      stockQuantity: 30,
      images: ['https://via.placeholder.com/800x1000?text=Jacket'],
      category: categories[3]._id, // New Arrivals
      isNew: true,
      tags: ['jacket', 'winter', 'hoodie']
    },
    {
      name: 'Sunglasses',
      description: 'UV protected stylish sunglasses',
      price: 1899,
      compareAtPrice: 2499,
      stockQuantity: 70,
      images: ['https://via.placeholder.com/800x400?text=Sunglasses'],
      category: categories[1]._id, // Accessories
      isOnSale: true,
      tags: ['sunglasses', 'summer', 'accessory']
    },
    {
      name: 'Formal Shoes',
      description: 'Classic formal shoes for special occasions',
      price: 6999,
      stockQuantity: 45,
      images: ['https://via.placeholder.com/800x600?text=Formal+Shoes'],
      category: categories[2]._id, // Footwear
      tags: ['shoes', 'formal', 'leather']
    }
  ];
  
  for (const productData of sampleProducts) {
    const product = new Product({
      ...productData,
      slug: productData.name.toLowerCase().replace(/\s+/g, '-'),
      sku: `SKU-${Math.random().toString(36).substr(2, 8).toUpperCase()}`
    });
    
    await product.save();
    console.log(`  - Created product: ${productData.name}`);
  }
  
  console.log(`Created ${sampleProducts.length} sample products`);
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
