require('dotenv').config();
const mongoose = require('mongoose');
const { ShippingZone } = require('./models/shipping.model');

async function createTestZones() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Check existing zones
    const existingZones = await ShippingZone.find({});
    console.log(`Found ${existingZones.length} existing shipping zones`);
    
    // Create sample zones if none exist
    if (existingZones.length === 0) {
      console.log('Creating sample shipping zones...');
      
      const sampleZones = [
        {
          name: 'Abuja City Center',
          type: 'abuja',
          price: 1000,
          areas: ['Abuja', 'FCT', 'Central Area'],
          estimatedDeliveryTime: '1-2 days',
          isActive: true
        },
        {
          name: 'Abuja Suburbs',
          type: 'abuja',
          price: 1500,
          areas: ['Abuja', 'FCT', 'Gwagwalada', 'Kuje'],
          estimatedDeliveryTime: '2-3 days',
          isActive: true
        },
        {
          name: 'Lagos Metro',
          type: 'interstate',
          price: 2000,
          areas: ['Lagos'],
          estimatedDeliveryTime: '2-3 days',
          isActive: true
        },
        {
          name: 'Southwest Zone',
          type: 'interstate',
          price: 2500,
          areas: ['Lagos', 'Ogun', 'Oyo', 'Osun'],
          estimatedDeliveryTime: '3-4 days',
          isActive: true
        },
        {
          name: 'Nationwide Delivery',
          type: 'interstate',
          price: 3000,
          areas: ['nationwide', 'all states'],
          estimatedDeliveryTime: '3-5 days',
          isActive: true
        }
      ];
      
      await ShippingZone.create(sampleZones);
      console.log('Sample shipping zones created successfully');
    } else {
      console.log('Shipping zones already exist, skipping creation');
    }
    
    // Display all zones for verification
    const allZones = await ShippingZone.find({});
    console.log('\nAll shipping zones:');
    allZones.forEach(zone => {
      console.log(`- ${zone.name} (${zone.type}): ${zone.areas.join(', ')} - ₦${zone.price}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the function
createTestZones();
