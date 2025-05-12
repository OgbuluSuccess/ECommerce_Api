const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: [true, 'Please provide product SKU'],
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Please provide product name'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please provide product description']
  },
  price: {
    type: Number,
    required: [true, 'Please provide product price'],
    min: [0, 'Price cannot be negative']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Please provide product category']
  },
  stock: {
    type: Number,
    required: [true, 'Please provide product stock'],
    min: [0, 'Stock cannot be negative']
  },
  images: [{
    url: {
      type: String,
      required: [true, 'Product image URL is required']
    },
    key: {
      type: String,
      required: [true, 'S3 object key is required']
    }
  }],
  brand: {
    type: String,
    required: [true, 'Please provide product brand']
  },
  variants: [{
    name: String,
    sku: String,
    price: Number,
    stock: Number,
    attributes: {
      type: Map,
      of: String
    }
  }],
  specifications: {
    type: Map,
    of: String
  },
  tags: [String],
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'discontinued'],
    default: 'draft'
  },
  salePrice: {
    type: Number,
    validate: {
      validator: function(value) {
        return !value || value < this.price;
      },
      message: 'Sale price must be less than regular price'
    }
  },
  saleStartDate: Date,
  saleEndDate: Date,
  ratings: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    review: String
  }],
  averageRating: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Calculate average rating before saving
productSchema.pre('save', function(next) {
  if (this.ratings.length > 0) {
    this.averageRating = this.ratings.reduce((acc, item) => item.rating + acc, 0) / this.ratings.length;
  }
  next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;