const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const Order = require('../models/order.model');
const { protect, restrictTo } = require('../middleware/auth.middleware');

/**
 * @swagger
 * /admin/customers:
 *   get:
 *     summary: Get all customers with filtering and pagination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, pending]
 *         description: Filter by customer status
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
 *         description: Search by name, email or phone
 *     responses:
 *       200:
 *         description: List of customers
 */
router.get('/', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { 
      status, 
      page = 1, 
      limit = 10, 
      sort = '-createdAt',
      search
    } = req.query;

    // Build query
    const query = { role: 'user' }; // Only get customers, not admins
    
    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Count total documents for pagination
    const total = await User.countDocuments(query);
    
    // Execute query with pagination and sorting
    const customers = await User.find(query)
      .select('-password')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Enhance customer data with order information
    const enhancedCustomers = await Promise.all(customers.map(async (customer) => {
      // Get order count for each customer
      const orderCount = await Order.countDocuments({ user: customer._id });
      
      // Calculate total spent
      const orders = await Order.find({ 
        user: customer._id,
        status: { $in: ['completed', 'delivered'] }
      });
      
      const totalSpent = orders.reduce(
        (sum, order) => sum + order.totalAmount, 
        0
      );
      
      // Determine customer status based on activity
      let customerStatus = 'inactive';
      if (orderCount > 0) {
        const lastOrder = await Order.findOne({ user: customer._id })
          .sort('-createdAt');
        
        const lastOrderDate = new Date(lastOrder.createdAt);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        if (lastOrderDate >= thirtyDaysAgo) {
          customerStatus = 'active';
        }
      } else if (customer.createdAt) {
        const accountCreationDate = new Date(customer.createdAt);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        if (accountCreationDate >= sevenDaysAgo) {
          customerStatus = 'pending';
        }
      }
      
      return {
        ...customer.toObject(),
        orderCount,
        totalSpent,
        status: customerStatus
      };
    }));

    res.status(200).json({
      success: true,
      count: enhancedCustomers.length,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      totalCustomers: total,
      data: enhancedCustomers
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /admin/customers/{id}:
 *   get:
 *     summary: Get customer details with order history
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
 *         description: Customer details
 */
router.get('/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const customer = await User.findById(req.params.id).select('-password');

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get customer's orders
    const orders = await Order.find({ user: customer._id })
      .sort('-createdAt')
      .populate('items.product', 'name price images');

    // Calculate total spent
    const totalSpent = orders
      .filter(order => ['completed', 'delivered'].includes(order.status))
      .reduce((sum, order) => sum + order.totalAmount, 0);

    // Get customer's last activity
    const lastActivity = orders.length > 0 ? orders[0].createdAt : customer.createdAt;

    res.status(200).json({
      success: true,
      data: {
        customer,
        orders,
        stats: {
          totalOrders: orders.length,
          totalSpent,
          lastActivity
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

/**
 * @swagger
 * /admin/customers/{id}/status:
 *   patch:
 *     summary: Update customer status
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
 *                 enum: [active, inactive, blocked]
 *     responses:
 *       200:
 *         description: Customer status updated successfully
 */
router.patch('/:id/status', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['active', 'inactive', 'blocked'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const customer = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).select('-password');

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Customer status updated to ${status}`,
      data: customer
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
