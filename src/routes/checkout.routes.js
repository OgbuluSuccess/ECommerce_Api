const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const Cart = require('../models/cart.model');
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const { protect } = require('../middleware/auth.middleware');
const paystack = require('../config/paystack.config');
const crypto = require('crypto');
const { sendOrderConfirmationEmail, sendNewOrderAdminNotification } = require('../utils/email.utils');
const { sendFailedPaymentAlert } = require('../utils/admin-emails');

/**
 * @swagger
 * /checkout/verify-payment/{reference}:
 *   get:
 *     summary: Verify Paystack payment status
 *     tags: [Checkout]
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment reference from Paystack
 *     responses:
 *       200:
 *         description: Payment verification successful
 */
router.get('/verify-payment/:reference', async (req, res) => {
  try {
    const { reference } = req.params;

    // Verify payment status with Paystack
    const response = await paystack.transaction.verify(reference);
console.log('Paystack response:', response.body);
    if (!response.status) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        error: response.message
      });
    }

    // Find order by reference
    const order = await Order.findOne({ 'paymentDetails.reference': reference });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update order status based on Paystack response
    if (response.data.status === 'success') {
      order.paymentStatus = 'completed';
      order.status = 'processing';
      
      // Update product stock
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          product.stock -= item.quantity;
          await product.save();
        }
      }
    } else {
      order.paymentStatus = 'failed';
    }

    order.paymentDetails.verificationResponse = response.data;
    await order.save();

    // Get user details for email
    const user = await User.findById(order.user);
    
    if (response.data.status === 'success') {
      // Send order confirmation email to customer
      try {
        await sendOrderConfirmationEmail(order, user);
        console.log(`Order confirmation email sent to ${user.email}`);
      } catch (emailError) {
        console.error('Error sending order confirmation email:', emailError);
        // Continue with order processing even if email fails
      }
      
      // Send notification to admin
      try {
        await sendNewOrderAdminNotification(order, user);
        console.log('New order notification sent to admin');
      } catch (emailError) {
        console.error('Error sending admin notification email:', emailError);
      }
    } else if (response.data.status === 'failed') {
      // Send failed payment alert to admin
      try {
        const paymentDetails = {
          method: 'paystack',
          reference: reference,
          errorMessage: response.data.gateway_response || 'Payment failed',
          timestamp: new Date()
        };
        
        await sendFailedPaymentAlert(order, user, paymentDetails);
        console.log('Failed payment alert sent to admin');
      } catch (emailError) {
        console.error('Error sending failed payment alert:', emailError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Payment verification completed',
      data: {
        paymentStatus: order.paymentStatus,
        orderStatus: order.status,
        order: order
      }
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /webhook/paystack:
 *   post:
 *     summary: Handle Paystack webhook notifications
 *     tags: [Checkout]
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 */
router.post('/webhook/paystack', async (req, res) => {
  try {
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(400).json({ status: false });
    }

    const event = req.body;

    // Handle different event types
    switch(event.event) {
      case 'charge.success':
        const order = await Order.findOne({
          'paymentDetails.reference': event.data.reference
        });

        if (order) {
          order.paymentStatus = 'paid';
          order.status = 'processing';
          order.paymentDetails.verificationResponse = event.data;
          await order.save();

          // Update product stock
          for (const item of order.items) {
            const product = await Product.findById(item.product);
            if (product) {
              product.stock -= item.quantity;
              await product.save();
            }
          }
        }
        break;
    }

    // Get user details for email
    const user = await User.findById(order.user);
    
    if (user) {
      // Send order confirmation email to customer
      try {
        await sendOrderConfirmationEmail(order, user);
        console.log(`Order confirmation email sent to ${user.email} via webhook`);
      } catch (emailError) {
        console.error('Error sending order confirmation email via webhook:', emailError);
      }
      
      // Send notification to admin
      try {
        await sendNewOrderAdminNotification(order, user);
        console.log('New order notification sent to admin via webhook');
      } catch (emailError) {
        console.error('Error sending admin notification email via webhook:', emailError);
      }
    }

    res.status(200).json({ status: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ status: false });
  }
});

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
 *                   properties:
 *                     productId:
 *                       type: string
 *                       description: MongoDB ObjectId of the product
 *                       example: 60d21b4667d0d8992e610c85
 *                     quantity:
 *                       type: integer
 *                       description: Number of items to purchase
 *                       example: 2
 *               shippingZoneId:
 *                 type: string
 *                 description: ID of the shipping zone or 'pickup' for store pickup
 *                 example: 60d21b4667d0d8992e610c85
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
      shippingZoneId,
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

    // Get shipping zone details if provided
    let shippingZone = null;
    let shippingCost = 0;
    let estimatedDeliveryTime = '';
    let carrier = '';
    
    // Extract state from shipping address
    const shippingState = shippingAddress?.state || '';
    
    if (shippingZoneId) {
      const { ShippingZone, ShippingSettings, StorePickup } = require('../models/shipping.model');
      
      // Get shipping settings for free delivery threshold
      let settings = await ShippingSettings.findOne();
      if (!settings) {
        settings = await ShippingSettings.create({});
      }
      
      // Handle store pickup
      if (shippingZoneId === 'pickup') {
        let pickupConfig = await StorePickup.findOne();
        if (!pickupConfig) {
          pickupConfig = await StorePickup.create({
            storeAddress: 'Shop 15, Banex Plaza, Wuse 2, Abuja',
            workingHours: 'Mon-Sat: 9:00 AM - 6:00 PM'
          });
        }
        
        shippingCost = 0;
        estimatedDeliveryTime = pickupConfig.preparationTime || '2-4 hours';
        carrier = 'Store Pickup';
      } else {
        // Handle regular shipping zones
        shippingZone = await ShippingZone.findById(shippingZoneId);
        
        if (shippingZone) {
          // Validate that the shipping zone matches the state
          if (shippingZone.type === 'interstate' && state && !shippingZone.areas.includes(state) && 
              !shippingZone.areas.includes('nationwide') && !shippingZone.areas.includes('all states')) {
            return res.status(400).json({
              success: false,
              message: `Selected shipping zone does not cover ${state}. Please select a valid shipping option.`
            });
          }
          
          shippingCost = shippingZone.price;
          estimatedDeliveryTime = shippingZone.estimatedDeliveryTime;
          carrier = shippingZone.courierPartner || settings.defaultCourierPartner;
          
          // Apply free shipping for orders above the threshold
          if (totalAmount >= settings.freeDeliveryThreshold) {
            shippingCost = 0;
          }
        }
      }
    } else if (shippingState) {
      // If no shipping zone ID but we have a state, try to find an appropriate zone
      const { ShippingZone, ShippingSettings } = require('../models/shipping.model');
      
      // Get shipping settings
      let settings = await ShippingSettings.findOne();
      if (!settings) {
        settings = await ShippingSettings.create({});
      }
      
      // Find a shipping zone for this state
      let zone;
      
      if (state === 'FCT' || state.toLowerCase().includes('abuja')) {
        zone = await ShippingZone.findOne({ type: 'abuja', isActive: true });
      } else {
        zone = await ShippingZone.findOne({
          type: 'interstate',
          isActive: true,
          areas: { $in: [state] }
        });
        
        // If no specific zone, try to find a nationwide zone
        if (!zone) {
          zone = await ShippingZone.findOne({
            type: 'interstate',
            isActive: true,
            areas: { $in: ['nationwide', 'all states'] }
          });
        }
      }
      
      if (zone) {
        shippingZone = zone;
        shippingCost = zone.price;
        estimatedDeliveryTime = zone.estimatedDeliveryTime;
        carrier = zone.courierPartner || settings.defaultCourierPartner;
        
        // Apply free shipping for orders above the threshold
        if (totalAmount >= settings.freeDeliveryThreshold) {
          shippingCost = 0;
        }
      }
    }
    
    // Create order
    const order = await Order.create({
      user: user._id,
      items: orderItems,
      totalAmount: totalAmount + shippingCost,
      shippingAddress: {
        street: shippingAddress,
        city,
        state,
        country
      },
      shipping: {
        zone: shippingZoneId,
        method: shippingMethod,
        cost: shippingCost,
        estimatedDeliveryTime
      },
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'paystack'
    });

    // Generate a unique reference with IDW format
    const reference = `IDW${Math.floor(100000 + Math.random() * 900000)}`;

    // Inside your guest checkout route, before initializing Paystack
    console.log('Paystack config:', typeof paystack, Object.keys(paystack));
    console.log('Attempting to initialize Paystack transaction with:', {
      email: user.email,
      amount: Math.round(order.totalAmount * 100), // Includes shipping cost
      reference,
      callback_url: `${process.env.FRONTEND_URL}/paymentVerify/${order._id}`
    });
    
    // Initialize Paystack transaction
    const paystackResponse = await paystack.transaction.initialize({
      email: user.email,
      amount: Math.round(order.totalAmount * 100), // Amount in Kobo (multiply by 100 to convert from Naira) - includes shipping
      reference,
      callback_url: `${process.env.FRONTEND_URL}/paymentVerify/${order._id}`,
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

    // Update order with payment details
    order.paymentDetails = {
      reference: reference,
      authorization_url: paystackResponse.data.authorization_url,
      access_code: paystackResponse.data.access_code
    };
    await order.save();

    // Return success response with payment URL
    return res.status(200).json({
      success: true,
      message: 'Payment initialized successfully',
      data: {
        authorization_url: paystackResponse.data.authorization_url,
        access_code: paystackResponse.data.access_code,
        reference: reference,
        order_id: order._id
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
    const { shippingAddress, shippingMethod, shippingZoneId, note } = req.body;

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
    
    // Get shipping zone details if provided
    let shippingZone = null;
    let shippingCost = 0;
    let estimatedDeliveryTime = '';
    let carrier = '';
    
    // Extract state from shipping address
    const shippingState = shippingAddress?.state || '';
    
    if (shippingZoneId) {
      const { ShippingZone, ShippingSettings, StorePickup } = require('../models/shipping.model');
      
      // Get shipping settings for free delivery threshold
      let settings = await ShippingSettings.findOne();
      if (!settings) {
        settings = await ShippingSettings.create({});
      }
      
      // Handle store pickup
      if (shippingZoneId === 'pickup') {
        let pickupConfig = await StorePickup.findOne();
        if (!pickupConfig) {
          pickupConfig = await StorePickup.create({
            storeAddress: 'Shop 15, Banex Plaza, Wuse 2, Abuja',
            workingHours: 'Mon-Sat: 9:00 AM - 6:00 PM'
          });
        }
        
        shippingCost = 0;
        estimatedDeliveryTime = pickupConfig.preparationTime || '2-4 hours';
        carrier = 'Store Pickup';
      } else {
        // Handle regular shipping zones
        shippingZone = await ShippingZone.findById(shippingZoneId);
        
        if (shippingZone) {
          // Validate that the shipping zone matches the state
          if (shippingZone.type === 'interstate' && state && !shippingZone.areas.includes(state) && 
              !shippingZone.areas.includes('nationwide') && !shippingZone.areas.includes('all states')) {
            return res.status(400).json({
              success: false,
              message: `Selected shipping zone does not cover ${state}. Please select a valid shipping option.`
            });
          }
          
          shippingCost = shippingZone.price;
          estimatedDeliveryTime = shippingZone.estimatedDeliveryTime;
          carrier = shippingZone.courierPartner || settings.defaultCourierPartner;
          
          // Apply free shipping for orders above the threshold
          if (cart.totalAmount >= settings.freeDeliveryThreshold) {
            shippingCost = 0;
          }
        }
      }
    } else if (shippingState) {
      // If no shipping zone ID but we have a state, try to find an appropriate zone
      const { ShippingZone, ShippingSettings } = require('../models/shipping.model');
      
      // Get shipping settings
      let settings = await ShippingSettings.findOne();
      if (!settings) {
        settings = await ShippingSettings.create({});
      }
      
      // Find a shipping zone for this state
      let zone;
      
      if (state === 'FCT' || state.toLowerCase().includes('abuja')) {
        zone = await ShippingZone.findOne({ type: 'abuja', isActive: true });
      } else {
        zone = await ShippingZone.findOne({
          type: 'interstate',
          isActive: true,
          areas: { $in: [state] }
        });
        
        // If no specific zone, try to find a nationwide zone
        if (!zone) {
          zone = await ShippingZone.findOne({
            type: 'interstate',
            isActive: true,
            areas: { $in: ['nationwide', 'all states'] }
          });
        }
      }
      
      if (zone) {
        shippingZone = zone;
        shippingCost = zone.price;
        estimatedDeliveryTime = zone.estimatedDeliveryTime;
        carrier = zone.courierPartner || settings.defaultCourierPartner;
        
        // Apply free shipping for orders above the threshold
        if (cart.totalAmount >= settings.freeDeliveryThreshold) {
          shippingCost = 0;
        }
      }
    }
    
    // Create order
    const order = await Order.create({
      user: req.user._id,
      items: cart.items,
      totalAmount: cart.totalAmount + shippingCost,
      shippingAddress,
      shipping: {
        zone: shippingZoneId,
        method: shippingMethod,
        cost: shippingCost,
        estimatedDeliveryTime
      },
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'paystack',
      note: note || ''
    });

    // Generate a unique reference with IDW format
    const reference = `IDW${Math.floor(100000 + Math.random() * 900000)}`;

    // Initialize Paystack transaction
    const paystackResponse = await paystack.transaction.initialize({
      email: user.email,
      amount: Math.round(order.totalAmount * 100), // Paystack amount in kobo (multiply by 100) - includes shipping
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
    // Get state from query parameter
    const { state } = req.query;
    
    // Get shipping zones from the database
    const { ShippingZone, StorePickup, ShippingSettings } = require('../models/shipping.model');
    
    // Get shipping settings for free delivery threshold
    let settings = await ShippingSettings.findOne();
    if (!settings) {
      settings = await ShippingSettings.create({});
    }
    
    // Build shipping methods array
    const shippingMethods = [];
    
    // Check if store pickup is enabled
    let pickupConfig = await StorePickup.findOne();
    if (!pickupConfig) {
      pickupConfig = await StorePickup.create({
        storeAddress: 'Shop 15, Banex Plaza, Wuse 2, Abuja',
        workingHours: 'Mon-Sat: 9:00 AM - 6:00 PM'
      });
    }
    
    // If state is FCT/Abuja, get Abuja zones
    if (!state || state === 'FCT' || state.toLowerCase().includes('abuja')) {
      const abujaZones = await ShippingZone.find({ type: 'abuja', isActive: true });
      
      abujaZones.forEach(zone => {
        shippingMethods.push({
          id: zone._id,
          name: zone.name,
          description: `Delivery within Abuja/FCT`,
          price: zone.price,
          estimatedDelivery: zone.estimatedDeliveryTime,
          type: 'abuja',
          areas: zone.areas,
          courierPartner: zone.courierPartner || settings.defaultCourierPartner
        });
      });
      
      // Add store pickup if enabled and we're in Abuja
      if (pickupConfig.isEnabled) {
        shippingMethods.push({
          id: 'pickup',
          name: 'Store Pickup',
          description: `Pickup at ${pickupConfig.storeAddress}`,
          price: 0, // Free pickup
          estimatedDelivery: pickupConfig.preparationTime || '2-4 hours',
          type: 'pickup',
          workingHours: pickupConfig.workingHours,
          pickupInstructions: pickupConfig.pickupInstructions
        });
      }
    } else {
      // For other states, find matching interstate zones
      const interstateZones = await ShippingZone.find({
        type: 'interstate', 
        isActive: true,
        areas: { $in: [state] } // Find zones that include this state
      });
      
      interstateZones.forEach(zone => {
        shippingMethods.push({
          id: zone._id,
          name: zone.name,
          description: `Delivery to ${shippingState}`,
          price: zone.price,
          estimatedDelivery: zone.estimatedDeliveryTime,
          type: 'interstate',
          state: state,
          courierPartner: zone.courierPartner || settings.defaultCourierPartner
        });
      });
      
      // If no specific zone for this state, get generic interstate zones
      if (interstateZones.length === 0) {
        const genericZones = await ShippingZone.find({
          type: 'interstate',
          isActive: true,
          areas: { $in: ['nationwide', 'all states'] }
        });
        
        genericZones.forEach(zone => {
          shippingMethods.push({
            id: zone._id,
            name: zone.name,
            description: `Delivery to ${state}`,
            price: zone.price,
            estimatedDelivery: zone.estimatedDeliveryTime,
            type: 'interstate',
            state: state,
            courierPartner: zone.courierPartner || settings.defaultCourierPartner
          });
        });
      }
    }
    
    // If no shipping methods are found, provide fallback methods
    if (shippingMethods.length === 0) {
      // Default method based on state
      if (!state || state === 'FCT' || state.toLowerCase().includes('abuja')) {
        shippingMethods.push({
          id: 'abuja-standard',
          name: 'Abuja Standard Delivery',
          description: 'Delivery within Abuja',
          price: 1000, // ₦1,000
          estimatedDelivery: '1-2 business days',
          type: 'abuja'
        });
      } else {
        shippingMethods.push({
          id: 'interstate-standard',
          name: 'Interstate Delivery',
          description: `Delivery to ${shippingState}`,
          price: 2500, // ₦2,500
          estimatedDelivery: '3-5 business days',
          type: 'interstate',
          state: state
        });
      }
    }

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
