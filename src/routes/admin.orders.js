const express = require('express');
const router = express.Router();
const Order = require('../models/order.model');
const User = require('../models/user.model');
const Product = require('../models/product.model');
const { protect, restrictTo } = require('../middleware/auth.middleware');

/**
 * @swagger
 * /admin/orders/enums:
 *   get:
 *     summary: Get order status and payment status enums
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Order status and payment status enums
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderStatuses:
 *                       type: array
 *                       items:
 *                         type: string
 *                     paymentStatuses:
 *                       type: array
 *                       items:
 *                         type: string
 *                     paymentMethods:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.get('/enums', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    // Get the enum values directly from the Mongoose schema
    const orderStatuses = Order.schema.path('status').enumValues;
    const paymentStatuses = Order.schema.path('paymentStatus').enumValues;
    const paymentMethods = Order.schema.path('paymentMethod').enumValues;
    
    res.status(200).json({
      success: true,
      data: {
        orderStatuses,
        paymentStatuses,
        paymentMethods
      }
    });
  } catch (error) {
    console.error('Error fetching enums:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /admin/orders:
 *   get:
 *     summary: Get all orders with filtering and pagination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by order status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort field and direction (e.g., -createdAt)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by order number or customer name/email
 *     responses:
 *       200:
 *         description: List of orders
 */
router.get('/', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const { 
      status, 
      page = 1, 
      limit, 
      sort = '-createdAt',
      search,
      dateRange
    } = req.query;
    
    // If no limit is specified, we'll set it to a very high number to get all orders
    const parsedLimit = limit ? parseInt(limit) : null;

    // Build query - empty query will return all orders
    const query = {};
    
    // Status filter - only apply if status is provided and not 'all'
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Date range filter
    if (dateRange) {
      const [start, end] = dateRange.split(',');
      if (start && end) {
        query.createdAt = {
          $gte: new Date(start),
          $lte: new Date(end)
        };
      }
    }
    
    // Search functionality
    if (search) {
      // First, find users matching the search term
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      const userIds = users.map(user => user._id);
      
      // Then, build the search query
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { user: { $in: userIds } }
      ];
    }

    // Count total documents for pagination
    const total = await Order.countDocuments(query);
    
    // Execute query with pagination and sorting
    let ordersQuery = Order.find(query)
      .populate('user', 'name email phone')
      .sort(sort);
      
    // Only apply pagination if a limit is specified
    if (parsedLimit) {
      ordersQuery = ordersQuery
        .skip((page - 1) * parsedLimit)
        .limit(parsedLimit);
    }
    
    const orders = await ordersQuery;

    // Get order statistics
    const pendingCount = await Order.countDocuments({ status: 'pending' });
    const processingCount = await Order.countDocuments({ status: 'processing' });
    const shippedCount = await Order.countDocuments({ status: 'shipped' });
    const deliveredCount = await Order.countDocuments({ status: 'delivered' });
    const cancelledCount = await Order.countDocuments({ status: 'cancelled' });
    const completedCount = deliveredCount + await Order.countDocuments({ status: 'completed' });
    
    // Calculate total revenue from completed and delivered orders
    const completedOrders = await Order.find({ 
      status: { $in: ['completed', 'delivered'] } 
    });
    
    const totalRevenue = completedOrders.reduce(
      (sum, order) => sum + order.totalAmount, 
      0
    );
    
    // Calculate average order value
    const avgOrderValue = completedOrders.length > 0 ? 
      (totalRevenue / completedOrders.length).toFixed(2) : 
      0;

    res.status(200).json({
      success: true,
      count: orders.length,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      totalOrders: total,
      data: orders,
      stats: {
        totalOrders: total,
        pending: pendingCount,
        processing: processingCount,
        shipped: shippedCount,
        completed: completedCount,
        cancelled: cancelledCount,
        totalRevenue,
        avgOrderValue
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /admin/orders/{id}:
 *   get:
 *     summary: Get order details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order details
 */
router.get('/:id', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('items.product', 'name price images');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /admin/orders/{id}/status:
 *   patch:
 *     summary: Update order status (Admin and Superadmin)
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
 *               status:
 *                 type: string
 *                 enum: [pending, processing, shipped, delivered, completed, cancelled]
 *     responses:
 *       200:
 *         description: Order status updated successfully
 *       403:
 *         description: Access denied. Not authorized.
 */
router.patch('/:id/status', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update order status
    order.status = status;
    await order.save();

    // Get user details for email notification
    const user = await User.findById(order.user);

    // Send order status update email
    try {
      const { sendOrderStatusUpdateEmail } = require('../utils/email.utils');
      await sendOrderStatusUpdateEmail(order, user);
      console.log(`Order status update email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Error sending status update email:', emailError);
      // Continue with order update even if email fails
    }

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: order
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /admin/orders/{id}/payment-status:
 *   patch:
 *     summary: Update order payment status (Admin and Superadmin)
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
 *               paymentStatus:
 *                 type: string
 *                 enum: [pending, completed, failed]
 *     responses:
 *       200:
 *         description: Order payment status updated successfully
 *       403:
 *         description: Access denied. Not authorized.
 */
router.patch('/:id/payment-status', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    
    // Validate payment status
    const validPaymentStatuses = ['pending', 'completed', 'failed'];
    if (!validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status value'
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update order payment status
    order.paymentStatus = paymentStatus;
    await order.save();

    // Get user details for email notification
    const user = await User.findById(order.user);

    // Send payment status update email if payment is completed or failed
    if (paymentStatus === 'completed' || paymentStatus === 'failed') {
      try {
        const { sendOrderStatusUpdateEmail } = require('../utils/email.utils');
        await sendOrderStatusUpdateEmail(order, user, { paymentStatusUpdated: true });
        console.log(`Payment status update email sent to ${user.email}`);
      } catch (emailError) {
        console.error('Error sending payment status update email:', emailError);
        // Continue with order update even if email fails
      }
    }

    res.status(200).json({
      success: true,
      message: `Order payment status updated to ${paymentStatus}`,
      data: order
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
