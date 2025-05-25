const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const Product = require('../models/product.model');
const Order = require('../models/order.model');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const bcrypt = require('bcryptjs');

/**
 * @swagger
 * /admin/users:
 *   post:
 *     summary: Create a new user (admin only)
 *     tags: [Admin]
 *     
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *     responses:
 *       201:
 *         description: User created successfully
 */

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalUsers:
 *                   type: number
 *                 totalProducts:
 *                   type: number
 *                 totalOrders:
 *                   type: number
 *                 totalRevenue:
 *                   type: number
 *                 recentOrders:
 *                   type: array
 *                 lowStockProducts:
 *                   type: array
 */

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Get all users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 */

/**
 * @swagger
 * /admin/users/{id}/role:
 *   patch:
 *     summary: Update user role
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *     responses:
 *       200:
 *         description: User role updated successfully
 */

/**
 * @swagger
 * /admin/sales:
 *   get:
 *     summary: Get sales statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sales statistics retrieved successfully
 */

/**
 * @swagger
 * /admin/inventory:
 *   get:
 *     summary: Get inventory statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inventory statistics retrieved successfully
 */

// Create new user (admin only) - Public endpoint
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      password,
      role
    });

    // Remove password from output
    user.password = undefined;

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get all users
router.get('/users', protect, restrictTo('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json({
      success: true,
      results: users.length,
      data: users
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get user by ID
router.get('/users/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Update user
router.patch('/users/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const updates = { ...req.body };
    
    // If password is being updated, hash it
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 12);
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Delete user
router.delete('/users/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});


// Get dashboard statistics
router.get('/dashboard', protect, restrictTo('admin'), async (req, res) => {
  try {
    // Get date range for comparison (current month and previous month)
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    // Count total users
    const totalUsers = await User.countDocuments();
    const previousMonthUsers = await User.countDocuments({ createdAt: { $lt: currentMonthStart } });
    const userGrowth = totalUsers > 0 && previousMonthUsers > 0 ? 
      Math.round(((totalUsers - previousMonthUsers) / previousMonthUsers) * 100) : 0;

    // Count total products
    const totalProducts = await Product.countDocuments();
    
    // Count total orders
    const totalOrders = await Order.countDocuments();
    const previousMonthOrders = await Order.countDocuments({ createdAt: { $lt: currentMonthStart } });
    const orderGrowth = totalOrders > 0 && previousMonthOrders > 0 ? 
      Math.round(((totalOrders - previousMonthOrders) / previousMonthOrders) * 100) : 0;

    // Calculate total revenue
    const orders = await Order.find({ status: { $in: ['completed', 'delivered'] } });
    const totalRevenue = orders.reduce((acc, order) => acc + order.totalAmount, 0);
    
    const previousMonthRevenue = orders
      .filter(order => order.createdAt < currentMonthStart && order.createdAt >= previousMonthStart)
      .reduce((acc, order) => acc + order.totalAmount, 0);
      
    const revenueGrowth = totalRevenue > 0 && previousMonthRevenue > 0 ? 
      Math.round(((totalRevenue - previousMonthRevenue) / previousMonthRevenue) * 100) : 0;

    // Get recent orders
    // Order analytics
    const orderStatusCount = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Recent orders with more details
    const recentOrders = await Order.find()
      .populate('user', 'name email')
      .populate('items.product', 'name price')
      .sort('-createdAt')
      .limit(5);

    // Inventory analytics
    const lowStockProducts = await Product.find({ stock: { $lt: 10 } })
      .select('name stock price category')
      .limit(5);

    const stockSummary = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          totalProducts: { $sum: 1 },
          averageStock: { $avg: '$stock' },
          totalValue: { $sum: { $multiply: ['$price', '$stock'] } }
        }
      }
    ]);
    
    // Get new users (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let newUsers = [];
    try {
      newUsers = await User.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
            role: 'user'
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
    } catch (err) {
      console.error('Error getting new users:', err);
      newUsers = [];
    }

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalProducts,
          totalOrders,
          totalRevenue
        },
        userAnalytics: {
          newUsers,
          userGrowth: newUsers.length > 0 ? ((newUsers[newUsers.length - 1].count - newUsers[0].count) / newUsers[0].count) * 100 : 0
        },
        orderAnalytics: {
          recentOrders,
          orderStatusDistribution: orderStatusCount,
          averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0
        },
        inventoryAnalytics: {
          lowStockProducts,
          stockSummary,
          totalInventoryValue: stockSummary.reduce((acc, category) => acc + category.totalValue, 0)
        }
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get all users
router.get('/users', protect, restrictTo('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password');

    res.status(200).json({
      success: true,
      results: users.length,
      data: users
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Update user role
router.patch('/users/:id/role', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { role } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get sales statistics
router.get('/sales', protect, restrictTo('admin'), async (req, res) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Last 30 days

    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          sales: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
          averageOrderValue: { $avg: '$totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get top selling products
    const topProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $ne: 'cancelled' }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          name: '$product.name',
          totalQuantity: 1,
          totalRevenue: 1
        }
      }
    ]);

    // Calculate sales growth
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - 30);
    
    const previousPeriodSales = await Order.aggregate([
      {
        $match: {
          createdAt: { 
            $gte: previousStartDate,
            $lt: startDate
          },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalAmount' }
        }
      }
    ]);

    const currentPeriodSales = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalAmount' }
        }
      }
    ]);

    const previousTotal = previousPeriodSales[0]?.totalSales || 0;
    const currentTotal = currentPeriodSales[0]?.totalSales || 0;
    const salesGrowth = previousTotal === 0 ? 100 : ((currentTotal - previousTotal) / previousTotal) * 100;

    res.status(200).json({
      success: true,
      data: salesData
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get inventory statistics
router.get('/inventory', protect, restrictTo('admin'), async (req, res) => {
  try {
    const inventoryStats = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          totalProducts: { $sum: 1 },
          averagePrice: { $avg: '$price' },
          totalStock: { $sum: '$stock' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: inventoryStats
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;