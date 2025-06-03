const mongoose = require('mongoose');

const shippingZoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'A shipping zone must have a name'],
    trim: true
  },
  areas: {
    type: [String],
    required: [true, 'A shipping zone must have at least one area']
  },
  price: {
    type: Number,
    required: [true, 'A shipping zone must have a price']
  },
  estimatedDeliveryTime: {
    type: String,
    required: [true, 'A shipping zone must have an estimated delivery time']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  type: {
    type: String,
    enum: ['abuja', 'interstate', 'pickup'],
    default: 'abuja'
  },
  courierPartner: {
    type: String,
    default: ''
  },
  preparationTime: {
    type: String,
    default: '2-4 hours'
  }
}, {
  timestamps: true
});

// Store pickup schema
const storePickupSchema = new mongoose.Schema({
  isEnabled: {
    type: Boolean,
    default: true
  },
  storeAddress: {
    type: String,
    required: [true, 'Store address is required']
  },
  workingHours: {
    type: String,
    required: [true, 'Working hours are required']
  },
  preparationTime: {
    type: String,
    default: '2-4 hours'
  },
  pickupInstructions: {
    type: String,
    default: 'Present order confirmation and valid ID for pickup'
  }
}, {
  timestamps: true
});

// Shipping settings schema
const shippingSettingsSchema = new mongoose.Schema({
  freeDeliveryThreshold: {
    type: Number,
    default: 10000
  },
  defaultCourierPartner: {
    type: String,
    default: 'GIG Logistics'
  },
  maxDeliveryDays: {
    type: Number,
    default: 7
  },
  enableCashOnDelivery: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const ShippingZone = mongoose.model('ShippingZone', shippingZoneSchema);
const StorePickup = mongoose.model('StorePickup', storePickupSchema);
const ShippingSettings = mongoose.model('ShippingSettings', shippingSettingsSchema);

module.exports = { ShippingZone, StorePickup, ShippingSettings };
