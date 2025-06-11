const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Order = require('../models/order.model');
const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const paystack = require('../config/paystack.config');
const { sendOrderConfirmationEmail, sendNewOrderAdminNotification, sendOrderStatusUpdateEmail } = require('../utils/email.utils');
const { sendShippingConfirmationEmail, sendDeliveryConfirmationEmail } = require('../utils/shipping-emails');
const { sendFailedPaymentAlert } = require('../utils/admin-emails');

/**
 * @swagger
 * components:
 *   schemas:
 *     Checkout:
 *       type: object
 *       required:
 *         - shippingAddress
 *       properties:
 *         shippingAddress:
 *           type: object
 *           properties:
 *             street:
 *               type: string
 *             city:
 *               type: string
 *             state:
 *               type: string
 *             zipCode:
 *               type: string
 *             country:
 *               type: string
 *         callbackUrl:
 *           type: string
 *           description: URL to redirect after payment
 */

// Create new order
router.post('/', protect, async (req, res) => {
  try {
    const { shippingAddress, paymentMethod } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items in cart'
      });
    }

    // Check stock availability
    for (const item of cart.items) {
      const product = await Product.findById(item.product);
      if (!product || product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product: ${product ? product.name : 'Unknown'}`
        });
      }
    }

    // Create order
    const order = await Order.create({
      user: req.user._id,
      items: cart.items,
      totalAmount: cart.totalAmount,
      shippingAddress,
      paymentMethod
    });

    // Update product stock
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity }
      });
    }

    // Clear cart
    cart.items = [];
    await cart.save();

    await order.populate('items.product', 'name price images');
    
    // Get user details for email
    const user = await User.findById(req.user._id);
    
    // Send order confirmation email to customer
    try {
      await sendOrderConfirmationEmail(order, user);
      console.log(`Order confirmation email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Error sending order confirmation email:', emailError);
      // Continue with order creation even if email fails
    }
    
    // Send notification to admin
    try {
      await sendNewOrderAdminNotification(order, user);
      console.log('New order notification sent to admin');
    } catch (emailError) {
      console.error('Error sending admin notification email:', emailError);
    }

    res.status(201).json({
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

// Get user orders
router.get('/my-orders', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product', 'name price images')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      results: orders.length,
      data: orders
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get single order
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name price images');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user is authorized to view this order
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order'
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

// Update order status (Admin only)
router.patch('/:id', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const { status, trackingInfo } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Save previous status to check for status change
    const previousStatus = order.status;
    
    // Update order status
    order.status = status;
    
    // If tracking info is provided, save it to the order
    if (trackingInfo) {
      order.trackingInfo = trackingInfo;
    }
    
    await order.save();
    await order.populate('items.product');

    // Get user details for email
    const user = await User.findById(order.user);
    if (!user) {
      console.error('User not found for order:', order._id);
      return res.status(200).json({
        success: true,
        data: order
      });
    }

    // Send appropriate email based on order status
    try {
      switch (status) {
        case 'shipped':
          // Only send if status changed to shipped and tracking info exists
          if (previousStatus !== 'shipped' && order.trackingInfo) {
            await sendShippingConfirmationEmail(order, user, order.trackingInfo);
            console.log(`Shipping confirmation email sent to ${user.email}`);
          } else {
            await sendOrderStatusUpdateEmail(order, user);
            console.log(`Order status update email sent to ${user.email}`);
          }
          break;
          
        case 'delivered':
          // Only send if status changed to delivered
          if (previousStatus !== 'delivered') {
            await sendDeliveryConfirmationEmail(order, user);
            console.log(`Delivery confirmation email sent to ${user.email}`);
          } else {
            await sendOrderStatusUpdateEmail(order, user);
            console.log(`Order status update email sent to ${user.email}`);
          }
          break;
          
        default:
          // For all other status changes, send the regular status update email
          await sendOrderStatusUpdateEmail(order, user);
          console.log(`Order status update email sent to ${user.email}`);
      }
    } catch (emailError) {
      console.error('Error sending order status email:', emailError);
      // Continue with order update even if email fails
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

// Get all orders (Admin only)
router.get('/', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .populate('items.product', 'name price')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      results: orders.length,
      data: orders
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
 * /checkout/paystack:
 *   post:
 *     summary: Create a Paystack checkout session
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Checkout'
 *     responses:
 *       200:
 *         description: Checkout session created
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
 *                     authorization_url:
 *                       type: string
 *                     access_code:
 *                       type: string
 *                     reference:
 *                       type: string
 *                     order_id:
 *                       type: string
 */
router.post('/checkout/paystack', protect, async (req, res) => {
  try {
    const { shippingAddress, callbackUrl } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items in cart'
      });
    }

    // Check stock availability
    for (const item of cart.items) {
      const product = await Product.findById(item.product);
      if (!product || product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product: ${product ? product.name : 'Unknown'}`
        });
      }
    }

    // Get user details
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create order first (with pending payment status)
    const order = await Order.create({
      user: req.user._id,
      items: cart.items,
      totalAmount: cart.totalAmount,
      shippingAddress,
      paymentMethod: 'paystack',
      paymentStatus: 'pending'
    });

    // Generate a unique reference
    const reference = `PAY-${order.orderNumber}`;

    // Initialize Paystack transaction
    const paystackResponse = await paystack.transaction.initialize({
      email: user.email,
      amount: Math.round(cart.totalAmount * 100), // Paystack amount in kobo (multiply by 100)
      reference,
      callback_url: callbackUrl || `${process.env.FRONTEND_URL}/payment/verify/${order._id}`,
      metadata: {
        order_id: order._id.toString(),
        custom_fields: [
          {
            display_name: 'Order Number',
            variable_name: 'order_number',
            value: order.orderNumber
          }
        ]
      }
    });

    if (!paystackResponse.status) {
      // If Paystack initialization fails, update order status
      order.paymentStatus = 'failed';
      await order.save();

      return res.status(400).json({
        success: false,
        message: 'Payment initialization failed',
        error: paystackResponse.message
      });
    }

    // Update order with payment details
    order.paymentDetails = {
      reference: reference,
      authorization_url: paystackResponse.data.authorization_url,
      access_code: paystackResponse.data.access_code,
      payment_provider: 'paystack'
    };
    await order.save();

    res.status(200).json({
      success: true,
      data: {
        authorization_url: paystackResponse.data.authorization_url,
        access_code: paystackResponse.data.access_code,
        reference: reference,
        order_id: order._id
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
 * /verify-payment/paystack/{reference}:
 *   get:
 *     summary: Verify Paystack payment
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment reference
 *     responses:
 *       200:
 *         description: Payment verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 */
router.get('/verify-payment/paystack/:reference', async (req, res) => {
  try {
    const { reference } = req.params;

    // Verify payment with Paystack
    const paystackResponse = await paystack.transaction.verify(reference);

    if (!paystackResponse.status) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        error: paystackResponse.message
      });
    }

    // Find the order by reference
    const order = await Order.findOne({ 'paymentDetails.reference': reference });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update order payment status based on Paystack verification
    if (paystackResponse.data.status === 'success') {
      // Payment successful
      order.paymentStatus = 'completed';
      order.paymentDetails.transaction_id = paystackResponse.data.id;

      // Update product stock
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.quantity }
        });
      }

      // Clear cart
      const cart = await Cart.findOne({ user: order.user });
      if (cart) {
        cart.items = [];
        await cart.save();
      }
      
      // Get user details for email
      const user = await User.findById(order.user);
      if (user) {
        // Send order confirmation email to customer
        try {
          await sendOrderConfirmationEmail(order, user);
          console.log(`Order confirmation email sent to ${user.email}`);
        } catch (emailError) {
          console.error('Error sending order confirmation email:', emailError);
        }
        
        // Send notification to admin
        try {
          await sendNewOrderAdminNotification(order, user);
          console.log('New order notification sent to admin');
        } catch (emailError) {
          console.error('Error sending admin notification email:', emailError);
        }
      }
    } else {
      // Payment failed
      order.paymentStatus = 'failed';
    }

    await order.save();

    res.status(200).json({
      success: true,
      data: {
        order: order,
        payment: paystackResponse.data
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
 * /webhook/paystack:
 *   post:
 *     summary: Webhook for Paystack payment events
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed
 */
router.post('/webhook/paystack', async (req, res) => {
  try {
    // Verify that the request is from Paystack
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const event = req.body;

    // Handle different event types
    switch(event.event) {
      case 'charge.success':
        const reference = event.data.reference;
        const order = await Order.findOne({ 'paymentDetails.reference': reference });
        
        if (order) {
          order.paymentStatus = 'completed';
          order.paymentDetails.transaction_id = event.data.id;
          await order.save();

          // Update product stock
          for (const item of order.items) {
            await Product.findByIdAndUpdate(item.product, {
              $inc: { stock: -item.quantity }
            });
          }

          // Clear cart
          const cart = await Cart.findOne({ user: order.user });
          if (cart) {
            cart.items = [];
            await cart.save();
          }
          
          // Get user details for email
          const user = await User.findById(order.user);
          if (user) {
            // Send order confirmation email to customer
            try {
              await sendOrderConfirmationEmail(order, user);
              console.log(`Order confirmation email sent to ${user.email} via webhook`);
            } catch (emailError) {
              console.error('Error sending order confirmation email:', emailError);
            }
            
            // Send notification to admin
            try {
              await sendNewOrderAdminNotification(order, user);
              console.log('New order notification sent to admin via webhook');
            } catch (emailError) {
              console.error('Error sending admin notification email:', emailError);
            }
          }
        }
        break;
      
      case 'charge.failed':
        const failedReference = event.data.reference;
        const failedOrder = await Order.findOne({ 'paymentDetails.reference': failedReference });
        
        if (failedOrder) {
          failedOrder.paymentStatus = 'failed';
          await failedOrder.save();
          
          // Get user details for failed payment alert
          const userWithFailedPayment = await User.findById(failedOrder.user);
          if (userWithFailedPayment) {
            try {
              // Send failed payment alert to admin
              const paymentDetails = {
                method: 'paystack',
                reference: failedReference,
                errorMessage: event.data.gateway_response || 'Payment failed',
                timestamp: new Date()
              };
              
              await sendFailedPaymentAlert(failedOrder, userWithFailedPayment, paymentDetails);
              console.log('Failed payment alert sent to admin');
            } catch (emailError) {
              console.error('Error sending failed payment alert:', emailError);
            }
          }
        }
        break;
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Paystack webhook error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;