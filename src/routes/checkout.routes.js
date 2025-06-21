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
      
      // Update product stock and collect product names
      const productNames = [];
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          product.stock -= item.quantity;
          await product.save();
          productNames.push(product.name);
        }
      }
      
      // Store product names in order for easy access
      order.productNames = productNames.join(', ');
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

    // Get product names from the order or generate them if needed
    const productNames = order.productNames || order.items.map(item => {
      // Try to get the product name from the populated product or from the item itself
      return (item.product && typeof item.product === 'object' && item.product.name) || item.name || 'Product';
    }).join(', ');
    
    res.status(200).json({
      success: true,
      message: 'Payment verification completed',
      data: {
        paymentStatus: order.paymentStatus,
        orderStatus: order.status,
        productNames: productNames,
        totalAmount: order.totalAmount || 0,
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

          // Update product stock for variants
          for (const item of order.items) {
            const product = await Product.findById(item.product);
            if (!product) continue;
            
            // Check if this is a variant
            if (item.variantKey && item.variantKey !== 'default:default' && 
                product.variantMatrix && product.variantMatrix.size > 0) {
              // Get the variant
              const variant = product.variantMatrix.get(item.variantKey);
              if (variant) {
                // Update variant stock
                variant.stock = Math.max(0, variant.stock - item.quantity);
                product.variantMatrix.set(item.variantKey, variant);
                await product.save();
              } else {
                // Fallback to updating main product stock if variant not found
                product.stock = Math.max(0, product.stock - item.quantity);
                await product.save();
              }
            } else {
              // Update main product stock for non-variant products
              product.stock = Math.max(0, product.stock - item.quantity);
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
 *               - shippingMethod
 *               - cartItems
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
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
 *               shippingZoneId:
 *                 type: string
 *               cartItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - quantity
 *                   properties:
 *                     productId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     color:
 *                       type: string
 *                       description: Color variant of the product
 *                     size:
 *                       type: string
 *                       description: Size variant of the product
 *               totalAmount:
 *                 type: number
 *                 description: Total amount including products and shipping, calculated by frontend
 *                 example: 25000
 *               alternativePhone:
 *                 type: string
 *                 description: Optional secondary phone number
 *     responses:
 *       200:
 *         description: Checkout successful, redirecting to payment
 */
router.post('/guest', async (req, res) => {
  console.log('Guest checkout request body:', req.body);
  console.log('Total amount from request:', req.body.totalAmount);
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      phone, 
      alternativePhone,
      shippingAddress, // This will be null if shippingMethod is 'pickup'
      country, 
      state, 
      city, 
      saveAddress,
      note,
      shippingMethod,
      shippingZoneId, // This might be 'pickup' or a zone ID
      cartItems,
      totalAmount: requestTotalAmount 
    } = req.body;

    // Validate required fields - shipping address not required for pickup
    if (!firstName || !email || !phone || (!shippingAddress && shippingMethod !== 'pickup') || !country || !state || !cartItems || !shippingMethod) {
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

      // Get variant details
      const color = item.color || 'default';
      const size = item.size || 'default';
      const variantKey = `${color}:${size}`;
      
      // Check if this variant exists and has stock
      let variantPrice = product.price;
      let variantStock = product.stock;
      let variantImage = product.images && product.images.length > 0 ? product.images[0].url : '';
      let variantSku = product.sku;
      
      // If product has variants, check the specific variant
      if (product.variantMatrix && product.variantMatrix.size > 0) {
        const variant = product.variantMatrix.get(variantKey);
        
        if (variant) {
          variantPrice = variant.price || product.price;
          variantStock = variant.stock;
          if (variant.image) variantImage = variant.image;
          if (variant.sku) variantSku = variant.sku;
        } else if (color !== 'default' || size !== 'default') {
          // If a specific variant was requested but doesn't exist
          return res.status(404).json({
            success: false,
            message: `The selected variant (${color}/${size}) for ${product.name} is not available`
          });
        }
      }

      // Check stock for the specific variant
      if (variantStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name} (${color}/${size})`
        });
      }

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: variantPrice,
        productName: product.name,
        color,
        size,
        variantKey,
        variantImage,
        variantSku
      });

      totalAmount += variantPrice * item.quantity;
    }

    // Check if user exists or create a new guest user
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name: `${firstName} ${lastName || ''}`.trim(),
        email,
        phone,
        role: 'user',
        password: Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8)
      });
    }

    // Format shipping address only if it's not a pickup
    const formattedShippingAddress = shippingMethod !== 'pickup' && shippingAddress ? {
      street: shippingAddress,
      city,
      state,
      country,
      zipCode: '', // Assuming zipCode might not always be provided or needed for all countries
      phone,
      alternativePhone: alternativePhone || ''
    } : null;

    // Save address to user if requested and it's not a pickup
    if (saveAddress && user && formattedShippingAddress) {
      user.shippingAddresses = user.shippingAddresses || [];
      user.shippingAddresses.push(formattedShippingAddress);
      await user.save();
    }

    let shippingZone = null;
    let shippingCost = 0;
    let estimatedDeliveryTime = '';
    let carrier = '';
    let isPickupOrder = (shippingMethod === 'pickup' || shippingZoneId === 'pickup');
    let pickupStoreAddress = null;
    let pickupOrderInstructions = null;

    const { ShippingZone, ShippingSettings, StorePickup } = require('../models/shipping.model');
    let settings = await ShippingSettings.findOne();
    if (!settings) {
      settings = await ShippingSettings.create({}); // Ensure settings exist
    }

    if (isPickupOrder) {
      let pickupConfig = await StorePickup.findOne();
      if (!pickupConfig) {
        // Create default pickup config if none exists
        pickupConfig = await StorePickup.create({
          storeAddress: 'Default Pickup Location, Abuja',
          workingHours: 'Mon-Sat: 10 AM - 6 PM',
          preparationTime: '1-3 hours',
          pickupInstructions: 'Please present your order confirmation and a valid ID.'
        });
      }
      shippingCost = 0;
      estimatedDeliveryTime = pickupConfig.preparationTime || '1-3 hours';
      carrier = 'Store Pickup';
      pickupStoreAddress = pickupConfig.storeAddress || 'Our Store (Details to be confirmed)';
      pickupOrderInstructions = pickupConfig.pickupInstructions || 'Please await confirmation or contact us for pickup details.';
    } else if (shippingZoneId) {
      shippingZone = await ShippingZone.findById(shippingZoneId);
      if (shippingZone) {
        if (shippingZone.type === 'interstate' && state && !shippingZone.areas.includes(state) && 
            !shippingZone.areas.includes('nationwide') && !shippingZone.areas.includes('all states')) {
          return res.status(400).json({
            success: false,
            message: `Selected shipping zone does not cover ${state}. Please select a valid shipping option.`
          });
        }
        shippingCost = shippingZone.price;
        estimatedDeliveryTime = shippingZone.estimatedDeliveryTime;
        carrier = shippingZone.courierPartner || settings.defaultCourierPartner || 'Local Courier';
        if (totalAmount >= settings.freeDeliveryThreshold && settings.freeDeliveryThreshold > 0) {
          shippingCost = 0;
        }
      }
    } else if (state) { // Fallback to state-based shipping if no zoneId and not pickup
      let zoneForState;
      if (state === 'FCT' || state.toLowerCase().includes('abuja')) {
        zoneForState = await ShippingZone.findOne({ type: 'abuja', isActive: true });
      } else {
        zoneForState = await ShippingZone.findOne({
          type: 'interstate',
          isActive: true,
          areas: { $in: [state] }
        });
        if (!zoneForState) {
          zoneForState = await ShippingZone.findOne({
            type: 'interstate',
            isActive: true,
            areas: { $in: ['nationwide', 'all states'] }
          });
        }
      }
      if (zoneForState) {
        shippingZone = zoneForState; // Keep track of the resolved zone
        shippingCost = zoneForState.price;
        estimatedDeliveryTime = zoneForState.estimatedDeliveryTime;
        carrier = zoneForState.courierPartner || settings.defaultCourierPartner || 'Local Courier';
        if (totalAmount >= settings.freeDeliveryThreshold && settings.freeDeliveryThreshold > 0) {
          shippingCost = 0;
        }
      }
    }
    
    // Final total amount including shipping, if not pickup
    const finalTotalAmount = isPickupOrder ? (requestTotalAmount || totalAmount) : (requestTotalAmount || totalAmount) + shippingCost;

    console.log('Using total amount for order:', finalTotalAmount);
    
    const order = await Order.create({
      user: user._id,
      items: orderItems,
      productAmount: totalAmount, // Store the sum of item prices before shipping
      shippingCost: isPickupOrder ? 0 : shippingCost,
      totalAmount: finalTotalAmount,
      shippingAddress: isPickupOrder ? null : formattedShippingAddress, // Use formatted address
      shipping: {
        zone: isPickupOrder ? null : (shippingZone ? shippingZone._id : shippingZoneId), // Store resolved zone ID or original if no resolution
        method: shippingMethod,
        cost: isPickupOrder ? 0 : shippingCost,
        estimatedDeliveryTime,
        isPickup: isPickupOrder,
        storeAddress: isPickupOrder ? pickupStoreAddress : null,
        pickupInstructions: isPickupOrder ? pickupOrderInstructions : null,
        carrier: carrier
      },
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'paystack'
    });

    const reference = `IDW${Math.floor(100000 + Math.random() * 900000)}`;

    console.log('Attempting to initialize Paystack transaction with:', {
      email: user.email,
      amount: Math.round(order.totalAmount * 100), // Use the final totalAmount from the order
      reference,
      callback_url: `${process.env.FRONTEND_URL}/paymentVerify/${order._id}`
    });
    
    const paystackResponse = await paystack.transaction.initialize({
      email: user.email,
      amount: Math.round(order.totalAmount * 100),
      reference,
      callback_url: `${process.env.FRONTEND_URL}/paymentVerify/${order._id}`,
      metadata: {
        order_id: order._id.toString(),
        total_amount: order.totalAmount,
        custom_fields: [
          {
            display_name: 'Order Number',
            variable_name: 'order_number',
            value: order.orderNumber
          }
        ]
      }
    });

    if (!paystackResponse || !paystackResponse.status || !paystackResponse.data) {
        order.paymentStatus = 'failed';
        await order.save();
        console.error('Paystack initialization failed:', paystackResponse && paystackResponse.message ? paystackResponse.message : 'Unknown Paystack error');
        return res.status(400).json({
            success: false,
            message: 'Payment initialization failed. Please try again or contact support.',
            error: paystackResponse && paystackResponse.message ? paystackResponse.message : 'Unknown error'
        });
    }

    order.paymentDetails = {
      reference: reference,
      authorization_url: paystackResponse.data.authorization_url,
      access_code: paystackResponse.data.access_code,
      payment_provider: 'paystack'
    };
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Checkout successful, redirecting to payment',
      data: {
        authorization_url: paystackResponse.data.authorization_url,
        access_code: paystackResponse.data.access_code,
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
 *                 properties:
 *                   street:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   country:
 *                     type: string
 *                   postalCode:
 *                     type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               country:
 *                 type: string
 *               shippingMethod:
 *                 type: string
 *                 enum: [standard, express, pickup]
 *               shippingZoneId:
 *                 type: string
 *                 description: ID of the shipping zone or 'pickup' for store pickup
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Checkout successful, redirecting to payment
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     authorization_url:
 *                       type: string
 *                     reference:
 *                       type: string
 *                     order_id:
 *                       type: string
 *                     order_number:
 *                       type: string
 */
router.post('/user', protect, async (req, res) => {
  try {
    const { 
      shippingAddress, // This will be null if shippingMethod is 'pickup'
      city, 
      state, 
      country, 
      shippingMethod, 
      shippingZoneId, // This might be 'pickup' or a zone ID
      note,
      // totalAmount from req.body is not used directly for logged-in users; cart total is authoritative
    } = req.body;

    // Validate required fields - shipping address not required for pickup
    if ((!shippingAddress && shippingMethod !== 'pickup') || !shippingMethod) {
      return res.status(400).json({
        success: false,
        message: 'Missing required shipping information.'
      });
    }

    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Your cart is empty.' });
    }

    // Check stock availability and calculate product total
    let productTotalAmount = 0;
    const orderItems = [];
    for (const item of cart.items) {
      const product = item.product; // Already populated
      if (!product) {
        return res.status(400).json({
          success: false,
          message: 'Product not found in cart'
        });
      }
      
      // Get variant details from cart item
      const color = item.color || 'default';
      const size = item.size || 'default';
      const variantKey = item.variantKey || `${color}:${size}`;
      
      // Check if this variant exists and has stock
      let variantPrice = item.price || product.price;
      let variantStock = product.stock;
      let variantImage = item.variantImage || (product.images && product.images.length > 0 ? product.images[0].url : '');
      let variantSku = item.variantSku || product.sku;
      
      // If product has variants, check the specific variant
      if (product.variantMatrix && product.variantMatrix.size > 0) {
        const variant = product.variantMatrix.get(variantKey);
        
        if (variant) {
          variantStock = variant.stock;
          // We use the price from the cart item as it was set when adding to cart
          if (!item.price) variantPrice = variant.price || product.price;
          if (!item.variantImage && variant.image) variantImage = variant.image;
          if (!item.variantSku && variant.sku) variantSku = variant.sku;
        } else if (color !== 'default' || size !== 'default') {
          // If a specific variant was requested but doesn't exist
          return res.status(404).json({
            success: false,
            message: `The selected variant (${color}/${size}) for ${product.name} is not available`
          });
        }
      }

      // Check stock for the specific variant
      if (variantStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name} (${color}/${size})`
        });
      }
      
      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: variantPrice,
        productName: item.productName || product.name,
        color,
        size,
        variantKey,
        variantImage,
        variantSku
      });
      
      productTotalAmount += variantPrice * item.quantity;
    }

    // Format shipping address only if it's not a pickup
    const formattedShippingAddress = shippingMethod !== 'pickup' && shippingAddress ? {
      street: shippingAddress, // Assuming shippingAddress from body is the street
      city,
      state,
      country,
      zipCode: '', // Add if available from body or user profile
      phone: user.phone, // Get phone from user profile
    } : null;

    let shippingZone = null;
    let shippingCost = 0;
    let estimatedDeliveryTime = '';
    let carrier = '';
    let isPickupOrder = (shippingMethod === 'pickup' || shippingZoneId === 'pickup');
    let pickupStoreAddress = null;
    let pickupOrderInstructions = null;

    const { ShippingZone, ShippingSettings, StorePickup } = require('../models/shipping.model');
    let settings = await ShippingSettings.findOne();
    if (!settings) {
      settings = await ShippingSettings.create({}); // Ensure settings exist
    }

    if (isPickupOrder) {
      let pickupConfig = await StorePickup.findOne();
      if (!pickupConfig) {
        pickupConfig = await StorePickup.create({
          storeAddress: 'Default Pickup Location, Abuja',
          workingHours: 'Mon-Sat: 10 AM - 6 PM',
          preparationTime: '1-3 hours',
          pickupInstructions: 'Please present your order confirmation and a valid ID.'
        });
      }
      shippingCost = 0;
      estimatedDeliveryTime = pickupConfig.preparationTime || '1-3 hours';
      carrier = 'Store Pickup';
      pickupStoreAddress = pickupConfig.storeAddress;
      pickupOrderInstructions = pickupConfig.pickupInstructions;
    } else if (shippingZoneId) {
      shippingZone = await ShippingZone.findById(shippingZoneId);
      if (shippingZone) {
        if (shippingZone.type === 'interstate' && state && !shippingZone.areas.includes(state) && 
            !shippingZone.areas.includes('nationwide') && !shippingZone.areas.includes('all states')) {
          return res.status(400).json({
            success: false,
            message: `Selected shipping zone does not cover ${state}. Please select a valid shipping option.`
          });
        }
        shippingCost = shippingZone.price;
        estimatedDeliveryTime = shippingZone.estimatedDeliveryTime;
        carrier = shippingZone.courierPartner || settings.defaultCourierPartner || 'Local Courier';
        if (productTotalAmount >= settings.freeDeliveryThreshold && settings.freeDeliveryThreshold > 0) {
          shippingCost = 0;
        }
      }
    } else if (state) { // Fallback to state-based shipping if no zoneId and not pickup
      let zoneForState;
      if (state === 'FCT' || state.toLowerCase().includes('abuja')) {
        zoneForState = await ShippingZone.findOne({ type: 'abuja', isActive: true });
      } else {
        zoneForState = await ShippingZone.findOne({
          type: 'interstate',
          isActive: true,
          areas: { $in: [state] }
        });
        if (!zoneForState) {
          zoneForState = await ShippingZone.findOne({
            type: 'interstate',
            isActive: true,
            areas: { $in: ['nationwide', 'all states'] }
          });
        }
      }
      if (zoneForState) {
        shippingZone = zoneForState;
        shippingCost = zoneForState.price;
        estimatedDeliveryTime = zoneForState.estimatedDeliveryTime;
        carrier = zoneForState.courierPartner || settings.defaultCourierPartner || 'Local Courier';
        if (productTotalAmount >= settings.freeDeliveryThreshold && settings.freeDeliveryThreshold > 0) {
          shippingCost = 0;
        }
      }
    }

    const finalTotalAmount = productTotalAmount + (isPickupOrder ? 0 : shippingCost);

    const order = await Order.create({
      user: userId,
      items: orderItems,
      productAmount: productTotalAmount,
      shippingCost: isPickupOrder ? 0 : shippingCost,
      totalAmount: finalTotalAmount,
      shippingAddress: isPickupOrder ? null : formattedShippingAddress,
      shipping: {
        zone: isPickupOrder ? null : (shippingZone ? shippingZone._id : shippingZoneId),
        method: shippingMethod,
        cost: isPickupOrder ? 0 : shippingCost,
        estimatedDeliveryTime,
        isPickup: isPickupOrder,
        storeAddress: isPickupOrder ? pickupStoreAddress : null,
        pickupInstructions: isPickupOrder ? pickupOrderInstructions : null,
        carrier: carrier
      },
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'paystack',
      note: note || ''
    });

    const reference = `IDW${Math.floor(100000 + Math.random() * 900000)}`;

    const paystackResponse = await paystack.transaction.initialize({
      email: user.email,
      amount: Math.round(order.totalAmount * 100),
      reference,
      callback_url: `${process.env.FRONTEND_URL}/paymentVerify/${order._id}`, // Ensure this matches guest checkout for consistency
      metadata: {
        order_id: order._id.toString(),
        total_amount: order.totalAmount,
        custom_fields: [
          {
            display_name: 'Order Number',
            variable_name: 'order_number',
            value: order.orderNumber
          }
        ]
      }
    });

    if (!paystackResponse || !paystackResponse.status || !paystackResponse.data) {
      order.paymentStatus = 'failed';
      await order.save();
      console.error('Paystack initialization failed for user checkout:', paystackResponse && paystackResponse.message ? paystackResponse.message : 'Unknown Paystack error');
      return res.status(400).json({
        success: false,
        message: 'Payment initialization failed. Please try again or contact support.',
        error: paystackResponse && paystackResponse.message ? paystackResponse.message : 'Unknown error'
      });
    }

    order.paymentDetails = {
      reference: reference,
      authorization_url: paystackResponse.data.authorization_url,
      access_code: paystackResponse.data.access_code,
      payment_provider: 'paystack'
    };
    await order.save();
    
    // Update product stock for variants
    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      if (!product) continue;
      
      // Check if this is a variant
      if (item.variantKey && item.variantKey !== 'default:default' && 
          product.variantMatrix && product.variantMatrix.size > 0) {
        // Get the variant
        const variant = product.variantMatrix.get(item.variantKey);
        if (variant) {
          // Update variant stock
          variant.stock = Math.max(0, variant.stock - item.quantity);
          product.variantMatrix.set(item.variantKey, variant);
          await product.save();
        } else {
          // Fallback to updating main product stock if variant not found
          product.stock = Math.max(0, product.stock - item.quantity);
          await product.save();
        }
      } else {
        // Update main product stock for non-variant products
        product.stock = Math.max(0, product.stock - item.quantity);
        await product.save();
      }
    }

    // Clear cart after successful order creation
    cart.items = [];
    cart.totalAmount = 0; // Reset cart total
    await cart.save();

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
    console.error('User checkout error:', error);
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
    
    // Add store pickup option if enabled (available for all locations)
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
