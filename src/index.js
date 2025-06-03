require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// Import routes
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const cartRoutes = require('./routes/cart.routes');
const orderRoutes = require('./routes/order.routes');
const checkoutRoutes = require('./routes/checkout.routes');
const adminRoutes = require('./routes/admin.routes');
const adminOrdersRoutes = require('./routes/admin.orders');
const adminDashboardRoutes = require('./routes/admin.dashboard');
const adminCustomersRoutes = require('./routes/admin.customers');
const categoryRoutes = require('./routes/category.routes');
const shippingRoutes = require('./routes/shipping.routes');

const app = express();

// Trust proxy (important for AWS/Nginx setup)
app.set('trust proxy', 1);

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allow specific origins in production and development
    const allowedOrigins = [
      'https://ice-deluxe-wears-git-master-yagazierems-projects.vercel.app',
      'https://icedeluxewears.com',
      'https://www.icedeluxewears.com',
      // Keep your existing localhost entries
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
      'http://localhost:23813'
    ];
    
    // In development, allow all origins with localhost or 127.0.0.1
    if (process.env.NODE_ENV !== 'production') {
      if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        return callback(null, true);
      }
    }
    
    // In production, only allow specific origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // For subdomains in production (e.g., api.icedeluxewears.com)
    if (process.env.NODE_ENV === 'production' && origin.endsWith('icedeluxewears.com')) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Security and compatibility headers
app.use((req, res, next) => {
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  next();
});

// Request logging
app.use(morgan('combined'));

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';
console.log(`Running in ${isProduction ? 'production' : 'development'} mode`);

// More lenient rate limiting for debugging
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Very high limit for debugging
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and options requests
    return req.path === '/health' || req.method === 'OPTIONS';
  },
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  console.log(`Health check from: ${req.ip} - User-Agent: ${req.get('User-Agent')}`);
  res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Ice Deluxe Wears API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/auth',
      products: '/products',
      cart: '/cart',
      orders: '/orders',
      admin: '/admin',
      categories: '/categories',
      shipping: '/shipping'
    }
  });
});

// API Routes (without routePrefix)
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/cart', cartRoutes);
app.use('/orders', orderRoutes);
app.use('/verify-payment/paystack', checkoutRoutes);
app.use('/checkout', checkoutRoutes);
app.use('/admin', adminRoutes);
app.use('/admin/orders', adminOrdersRoutes);
app.use('/admin/dashboard', adminDashboardRoutes);
app.use('/admin/customers', adminCustomersRoutes);
app.use('/categories', categoryRoutes);
app.use('/shipping', shippingRoutes);

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 404 handler with detailed logging
app.use((req, res, next) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl} from ${req.ip}`);
  console.log(`User-Agent: ${req.get('User-Agent')}`);
  
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requestedUrl: req.originalUrl,
    method: req.method
  });
});

// Enhanced error handling
app.use((err, req, res, next) => {
  console.error('Error occurred:');
  console.error('URL:', req.originalUrl);
  console.error('Method:', req.method);
  console.error('IP:', req.ip);
  console.error('User-Agent:', req.get('User-Agent'));
  console.error('Error:', err.stack);
  
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Enhanced MongoDB connection with better error handling
mongoose.set('strictQuery', false);

async function connectAndStartServer() {
  const mongoOptions = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4, // Use IPv4, skip trying IPv6
    maxPoolSize: 10,
    minPoolSize: 5,
    bufferCommands: false
    // Removed bufferMaxEntries: 0 as it's not supported in newer MongoDB driver versions
  };

  console.log('Attempting to connect to MongoDB...');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI, mongoOptions);
    console.log('✅ Connected to MongoDB successfully');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('🔄 Retrying connection in 5 seconds...');
    setTimeout(connectAndStartServer, 5000);
    return; // Exit this attempt to retry
  }

  // Start the server only after successful connection
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📱 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  });

  // Handle server errors
  server.on('error', (err) => {
    console.error('Server error:', err);
  });

  // Keep-alive configuration
  server.keepAliveTimeout = 120000;
  server.headersTimeout = 120000;
}

// MongoDB event listeners
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

// Start the server with MongoDB connection
connectAndStartServer();