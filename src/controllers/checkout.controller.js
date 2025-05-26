const Order = require('../models/order.model');
const Cart = require('../models/cart.model');
const User = require('../models/user.model');
const axios = require('axios');

exports.initializePayment = async (req, res) => {
  try {
    const { userId } = req.user;
    const { shippingAddress, paymentMethod } = req.body;
    
    // Get user's cart
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty'
      });
    }
    
    // Calculate total amount
    let totalAmount = 0;
    const orderItems = cart.items.map(item => {
      const itemTotal = item.quantity * item.product.price;
      totalAmount += itemTotal;
      
      return {
        product: item.product._id,
        quantity: item.quantity,
        price: item.product.price,
        name: item.product.name
      };
    });
    
    // Add shipping cost if applicable
    const shippingCost = 1000; // ₦1000 for shipping
    totalAmount += shippingCost;
    
    // Create order in pending state
    const order = await Order.create({
      user: userId,
      items: orderItems,
      totalAmount,
      shippingAddress,
      paymentMethod,
      shippingCost,
      status: 'pending'
    });
    
    // Initialize Paystack transaction using our wrapper
    const paystack = require('../config/paystack.config');
    
    try {
      const paystackResponse = await paystack.transaction.initialize({
        email: req.user.email,
        amount: Math.round(totalAmount * 100), // Amount in Kobo (multiply by 100 to convert from Naira)
        reference: `ORDER-${order._id}`,
        callback_url: `${process.env.FRONTEND_URL}/payment/verify`,
        metadata: {
          order_id: order._id.toString(),
          custom_fields: [
            {
              display_name: "Order ID",
              variable_name: "order_id",
              value: order._id.toString()
            }
          ]
        }
      });
      
      // Return payment URL to frontend
      return res.status(200).json({
        success: true,
        message: 'Payment initialized',
        data: {
          authorizationUrl: paystackResponse.data.authorization_url,
          reference: paystackResponse.data.reference,
          orderId: order._id
        }
      });
    } catch (paystackError) {
      console.error('Paystack initialization failed:', paystackError);
      
      // Update order status to failed
      await Order.findByIdAndUpdate(order._id, { status: 'cancelled', paymentStatus: 'failed' });
      
      return res.status(400).json({
        success: false,
        message: paystackError.message || 'Payment initialization failed',
        error: paystackError.response?.data || {}
      });
    }
    
  } catch (error) {
    console.error('Payment initialization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error initializing payment',
      error: error.message
    });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.query;
    
    // Verify payment with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );
    
    const { status, data } = response.data;
    
    if (status && data.status === 'success') {
      // Extract order ID from reference (ORDER-{orderId})
      const orderId = reference.split('-')[1];
      
      // Update order status
      const order = await Order.findByIdAndUpdate(
        orderId,
        { 
          status: 'paid',
          paymentDetails: {
            reference: reference,
            amount: data.amount / 100, // Convert back from kobo
            paymentDate: new Date(),
            channel: data.channel,
            transactionId: data.id
          }
        },
        { new: true }
      );
      
      // Clear user's cart after successful payment
      await Cart.findOneAndUpdate(
        { user: order.user },
        { $set: { items: [] } }
      );
      
      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          order
        }
      });
    } else {
      // Payment failed
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        data: response.data
      });
    }
    
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying payment',
      error: error.message
    });
  }
};

exports.getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        status: order.status,
        paymentDetails: order.paymentDetails || {}
      }
    });
    
  } catch (error) {
    console.error('Get payment status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting payment status',
      error: error.message
    });
  }
};