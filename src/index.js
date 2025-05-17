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
const adminRoutes = require('./routes/admin.routes');
const categoryRoutes = require('./routes/category.routes');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

// Handle routes for production domain (api.icedeluxewears.com)
// For local development, we'll explicitly set to non-production mode
const isProduction = process.env.NODE_ENV === 'production';

// Log the current environment mode
console.log(`Running in ${isProduction ? 'production' : 'development'} mode`);

// In production, the domain already has 'api' in it, so we don't need the /api prefix
const routePrefix = isProduction ? '' : '/api';

// Middleware to normalize paths
app.use((req, res, next) => {
  // Handle legacy requests with duplicated /api prefix
  if (req.path.startsWith('/api/api/')) {
    req.url = req.url.replace('/api/api/', '/api/');
  }
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use(`${routePrefix}/auth`, authRoutes);
app.use(`${routePrefix}/products`, productRoutes);
app.use(`${routePrefix}/cart`, cartRoutes);
app.use(`${routePrefix}/orders`, orderRoutes);
app.use(`${routePrefix}/admin`, adminRoutes);
app.use(`${routePrefix}/categories`, categoryRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Server is running on port 5000');
});