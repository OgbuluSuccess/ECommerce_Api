const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const Cart = require('../models/cart.model');
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const { protect } = require('../middleware/auth.middleware');
const paystack = require('../config/paystack.config');

/**
 * @swagger
 * /checkout/guest:
 *   post:
 *     summary: Process checkout for guest users
 *     tags: [Checkout]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - email
 *               - phone
 *               - shippingAddress
 *               - country
 *               - state
 *               - city
 *               - cartItems
 *               - shippingMethod
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               alternativePhone:
 *                 type: string
 *               shippingAddress:
 *                 type: string
 *               country:
 *                 type: string
 *               state:
 *                 type: string
 *               city:
 *                 type: string
 *               saveAddress:
 *                 type: boolean
 *               note:
 *                 type: string
 *               shippingMethod:
 *                 type: string
 *               cartItems:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Checkout successful, redirecting to payment
 */
router.post('/guest', async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      phone, 
      alternativePhone,
      shippingAddress, 
      country, 
      state, 
      city, 
      saveAddress,
      note,
      shippingMethod,
      cartItems 
    } = req.body;

    // Validate required fields
    if (!firstName || !email || !phone || !shippingAddress || !country || !state || !cartItems || !shippingMethod) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check if items exist and have sufficient stock
    let totalAmount = 0;
    const orderItems = [];

    for (const item of cartItems) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.productId}`
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product: ${product.name}`
        });
      }

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price,
        name: product.name
      });

      totalAmount += product.price * item.quantity;
    }

    // Check if user exists or create a new guest user
    let user = await User.findOne({ email });
    if (!user) {
      // Create a new guest user
      user = await User.create({
        name: `${firstName} ${lastName || ''}`.trim(),
        email,
        phone,
        role: 'user',
        // Generate a random password that will be reset later if the user wants to create an account
        password: Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8)
      });
    }

    // Format shipping address
    const formattedShippingAddress = {
      street: shippingAddress,
      city,
      state,
      country,
      zipCode: '',
      phone,
      alternativePhone: alternativePhone || ''
    };

    // Save address to user if requested
    if (saveAddress && user) {
      user.shippingAddresses = user.shippingAddresses || [];
      user.shippingAddresses.push(formattedShippingAddress);
      await user.save();
    }

    // Create order
    const order = await Order.create({
      user: user._id,
      items: orderItems,
      totalAmount,
      shippingAddress: formattedShippingAddress,
      paymentMethod: 'paystack',
      paymentStatus: 'pending',
      shippingMethod,
      note: note || '',
      // Add shipping cost if applicable based on shipping method
      // shippingCost: calculateShippingCost(shippingMethod, totalAmount),
    });

    // Generate a unique reference
    const reference = `PAY-${order.orderNumber}`;

    // Initialize Paystack transaction
    const paystackResponse = await paystack.transaction.initialize({
      email: user.email,
      amount: Math.round(totalAmount * 100), // Paystack amount in kobo (multiply by 100)
      reference,
      callback_url: `${process.env.FRONTEND_URL}/payment/verify/${order._id}`,
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

    // Return success with payment URL
    res.status(200).json({
      success: true,
      message: 'Checkout successful, redirecting to payment',
      data: {
        authorization_url: paystackResponse.data.authorization_url,
        reference: reference,
        order_id: order._id,
        order_number: order.orderNumber
      }
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during checkout',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /checkout/user:
 *   post:
 *     summary: Process checkout for logged-in users
 *     tags: [Checkout]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shippingAddress
 *               - shippingMethod
 *             properties:
 *               shippingAddress:
 *                 type: object
 *               shippingMethod:
 *                 type: string
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Checkout successful, redirecting to payment
 */
router.post('/user', protect, async (req, res) => {
  try {
    const { shippingAddress, shippingMethod, note } = req.body;

    // Validate required fields
    if (!shippingAddress || !shippingMethod) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

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

    // Create order
    const order = await Order.create({
      user: req.user._id,
      items: cart.items,
      totalAmount: cart.totalAmount,
      shippingAddress,
      paymentMethod: 'paystack',
      paymentStatus: 'pending',
      shippingMethod,
      note: note || ''
      // Add shipping cost if applicable
      // shippingCost: calculateShippingCost(shippingMethod, cart.totalAmount),
    });

    // Generate a unique reference
    const reference = `PAY-${order.orderNumber}`;

    // Initialize Paystack transaction
    const paystackResponse = await paystack.transaction.initialize({
      email: user.email,
      amount: Math.round(cart.totalAmount * 100), // Paystack amount in kobo (multiply by 100)
      reference,
      callback_url: `${process.env.FRONTEND_URL}/payment/verify/${order._id}`,
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

    // Clear cart after successful order creation
    cart.items = [];
    cart.totalAmount = 0;
    await cart.save();

    // Return success with payment URL
    res.status(200).json({
      success: true,
      message: 'Checkout successful, redirecting to payment',
      data: {
        authorization_url: paystackResponse.data.authorization_url,
        reference: reference,
        order_id: order._id,
        order_number: order.orderNumber
      }
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during checkout',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /checkout/shipping-methods:
 *   get:
 *     summary: Get available shipping methods
 *     tags: [Checkout]
 *     responses:
 *       200:
 *         description: List of available shipping methods
 */
router.get('/shipping-methods', async (req, res) => {
  try {
    // You can fetch these from a database if you have a shipping methods collection
    // For now, we'll return hardcoded shipping methods
    const shippingMethods = [
      {
        id: 'standard',
        name: 'Standard Shipping',
        description: 'Delivery within 5-7 business days',
        price: 1000, // ₦1,000
        estimatedDelivery: '5-7 business days'
      },
      {
        id: 'express',
        name: 'Express Shipping',
        description: 'Delivery within 2-3 business days',
        price: 2500, // ₦2,500
        estimatedDelivery: '2-3 business days'
      },
      {
        id: 'same_day',
        name: 'Same Day Delivery',
        description: 'Available only in Lagos',
        price: 3500, // ₦3,500
        estimatedDelivery: 'Same day (order before 12pm)',
        restrictions: ['Lagos only']
      }
    ];

    res.status(200).json({
      success: true,
      data: shippingMethods
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching shipping methods',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /checkout/validate-coupon:
 *   post:
 *     summary: Validate a coupon code
 *     tags: [Checkout]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - totalAmount
 *             properties:
 *               code:
 *                 type: string
 *               totalAmount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Coupon validation result
 */
router.post('/validate-coupon', async (req, res) => {
  try {
    const { code, totalAmount } = req.body;

    // In a real implementation, you would check against a coupons collection in your database
    // For now, we'll simulate a coupon validation
    const validCoupons = [
      { code: 'WELCOME10', discount: 0.1, minAmount: 5000 }, // 10% off for orders above ₦5,000
      { code: 'NEWUSER20', discount: 0.2, minAmount: 10000 }, // 20% off for orders above ₦10,000
      { code: 'FREESHIP', discount: 1000, type: 'fixed', minAmount: 15000 } // ₦1,000 off shipping for orders above ₦15,000
    ];

    const coupon = validCoupons.find(c => c.code === code.toUpperCase());

    if (!coupon) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }

    if (totalAmount < coupon.minAmount) {
      return res.status(400).json({
        success: false,
        message: `This coupon requires a minimum order of ₦${coupon.minAmount.toLocaleString()}`
      });
    }

    let discountAmount;
    if (coupon.type === 'fixed') {
      discountAmount = coupon.discount;
    } else {
      discountAmount = totalAmount * coupon.discount;
    }

    res.status(200).json({
      success: true,
      message: 'Coupon applied successfully',
      data: {
        code: coupon.code,
        discountAmount,
        type: coupon.type || 'percentage',
        discountPercentage: coupon.type === 'fixed' ? null : coupon.discount * 100
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'An error occurred while validating the coupon',
      error: error.message
    });
  }
});

module.exports = router;
