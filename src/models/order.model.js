const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity cannot be less than 1']
    },
    price: {
      type: Number,
      required: true
    }
  }],
  productAmount: {
    type: Number,
    required: true,
    default: 0
  },
  shippingCost: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0
  },
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  shipping: {
    zone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShippingZone'
    },
    method: String,
    cost: {
      type: Number,
      default: 0
    },
    estimatedDeliveryTime: String,
    isPickup: {
      type: Boolean,
      default: false
    }
  },
  trackingInfo: {
    courier: String,
    trackingNumber: String,
    trackingUrl: String,
    estimatedDelivery: String,
    shippedAt: Date,
    deliveredAt: Date
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['credit_card', 'debit_card', 'paypal', 'paystack']
  },
  paymentDetails: {
    reference: String,
    authorization_url: String,
    access_code: String,
    transaction_id: String,
    payment_provider: {
      type: String,
      default: 'paystack'
    }
  },
  productNames: {
    type: String,
    default: ''
  },
  orderNumber: {
    type: String,
    unique: true
  }
}, {
  timestamps: true
});

// Generate unique order number before saving
orderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    this.orderNumber = 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  }
  next();
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;