const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const Product = require('../models/product.model');
const Order = require('../models/order.model');
const { protect, restrictTo } = require('../middleware/auth.middleware');

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
 */
router.get('/', protect, restrictTo('admin'), async (req, res) => {
  try {
    // Prepare date ranges for calculations
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    // Basic statistics
    const dashboardData = {
      totalUsers: 0,
      userGrowth: 0,
      totalProducts: 0,
      totalOrders: 0,
      orderGrowth: 0,
      totalRevenue: 0,
      revenueGrowth: 0,
      avgOrderValue: 0,
      orderStatus: {
        pending: 0,
        processing: 0,
        shipped: 0,
        completed: 0,
        cancelled: 0
      },
      recentOrders: [],
      userGrowthData: [],
      inventoryDistribution: [],
      newUsersByDay: []
    };
    
    // Get user statistics
    dashboardData.totalUsers = await User.countDocuments();
    const previousMonthUsers = await User.countDocuments({ createdAt: { $lt: currentMonthStart } });
    
    if (dashboardData.totalUsers > 0 && previousMonthUsers > 0) {
      dashboardData.userGrowth = Math.round(
        ((dashboardData.totalUsers - previousMonthUsers) / previousMonthUsers) * 100
      );
    }
    
    // Get product statistics
    dashboardData.totalProducts = await Product.countDocuments();
    
    // Get order statistics
    dashboardData.totalOrders = await Order.countDocuments();
    const previousMonthOrders = await Order.countDocuments({ createdAt: { $lt: currentMonthStart } });
    
    if (dashboardData.totalOrders > 0 && previousMonthOrders > 0) {
      dashboardData.orderGrowth = Math.round(
        ((dashboardData.totalOrders - previousMonthOrders) / previousMonthOrders) * 100
      );
    }
    
    // Get order status counts
    dashboardData.orderStatus.pending = await Order.countDocuments({ status: 'pending' });
    dashboardData.orderStatus.processing = await Order.countDocuments({ status: 'processing' });
    dashboardData.orderStatus.shipped = await Order.countDocuments({ status: 'shipped' });
    const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
    const completedOrdersCount = await Order.countDocuments({ status: 'completed' });
    dashboardData.orderStatus.completed = deliveredOrders + completedOrdersCount;
    dashboardData.orderStatus.cancelled = await Order.countDocuments({ status: 'cancelled' });
    
    // Calculate revenue
    const completedOrders = await Order.find({ status: { $in: ['completed', 'delivered'] } });
    dashboardData.totalRevenue = completedOrders.reduce((acc, order) => acc + order.totalAmount, 0);
    
    const previousMonthRevenue = completedOrders
      .filter(order => order.createdAt < currentMonthStart && order.createdAt >= previousMonthStart)
      .reduce((acc, order) => acc + order.totalAmount, 0);
    
    if (dashboardData.totalRevenue > 0 && previousMonthRevenue > 0) {
      dashboardData.revenueGrowth = Math.round(
        ((dashboardData.totalRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
      );
    }
    
    // Calculate average order value
    if (dashboardData.totalOrders > 0) {
      dashboardData.avgOrderValue = (dashboardData.totalRevenue / dashboardData.totalOrders).toFixed(2);
    }
    
    // Get user growth data for chart (last 6 months)
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = monthDate.toLocaleString('default', { month: 'short' });
      const nextMonth = new Date(monthDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      const count = await User.countDocuments({
        createdAt: { $gte: monthDate, $lt: nextMonth }
      });
      
      dashboardData.userGrowthData.push({
        month: monthName,
        users: count
      });
    }
    
    // Get inventory distribution by category
    try {
      dashboardData.inventoryDistribution = await Product.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalValue: { $sum: { $multiply: ['$price', '$stock'] } }
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        {
          $project: {
            category: { $arrayElemAt: ['$categoryInfo.name', 0] },
            count: 1,
            totalValue: 1
          }
        }
      ]);
    } catch (err) {
      console.error('Error getting inventory distribution:', err);
    }
    
    // Get recent orders
    dashboardData.recentOrders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Get new users by day (last 30 days)
    try {
      const newUsersByDay = await User.aggregate([
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
      
      dashboardData.newUsersByDay = newUsersByDay;
    } catch (err) {
      console.error('Error getting new users by day:', err);
    }
    
    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /admin/dashboard/sales:
 *   get:
 *     summary: Get sales statistics for dashboard
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly]
 *         description: Time period for sales data
 *     responses:
 *       200:
 *         description: Sales statistics retrieved successfully
 */
router.get('/sales', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;
    const now = new Date();
    let dateFormat, startDate;

    // Set date format and start date based on period
    switch (period) {
      case 'daily':
        dateFormat = '%Y-%m-%d';
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30); // Last 30 days
        break;
      case 'weekly':
        dateFormat = '%Y-%U'; // Year-Week
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 90); // Last ~12 weeks
        break;
      case 'yearly':
        dateFormat = '%Y';
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 5); // Last 5 years
        break;
      case 'monthly':
      default:
        dateFormat = '%Y-%m';
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 12); // Last 12 months
        break;
    }

    // Aggregate sales data
    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ['completed', 'delivered'] }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          sales: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get top selling products
    const topProducts = await Order.aggregate([
      {
        $match: {
          status: { $in: ['completed', 'delivered'] }
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

    res.status(200).json({
      success: true,
      data: {
        salesData,
        topProducts
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
