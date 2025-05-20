const { sendMail } = require('../config/email.config');

/**
 * Send welcome email to newly registered user
 * @param {Object} user - User object with name and email
 * @returns {Promise}
 */
const sendWelcomeEmail = async (user) => {
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'Ice Deluxe Wears'}" <${process.env.EMAIL_FROM || 'noreply@icedeluxewears.com'}>`,
    to: user.email,
    subject: 'Welcome to Ice Deluxe Wears',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #333;">Welcome to Ice Deluxe Wears!</h1>
        </div>
        <div style="padding: 20px;">
          <p>Hello ${user.name},</p>
          <p>Thank you for registering with Ice Deluxe Wears. We're excited to have you as part of our community!</p>
          <p>With your new account, you can:</p>
          <ul>
            <li>Shop our latest collections</li>
            <li>Track your orders</li>
            <li>Save items to your wishlist</li>
            <li>Receive exclusive offers</li>
          </ul>
          <p>If you have any questions or need assistance, please don't hesitate to contact our customer support team.</p>
          <div style="margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Start Shopping</a>
          </div>
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px;">
          <p>u00a9 ${new Date().getFullYear()} Ice Deluxe Wears. All rights reserved.</p>
          <p>If you did not register for this account, please ignore this email.</p>
        </div>
      </div>
    `
  };

  return sendMail(mailOptions);
};

/**
 * Send order confirmation email to customer
 * @param {Object} order - Order object with details
 * @param {Object} user - User object with name and email
 * @returns {Promise}
 */
const sendOrderConfirmationEmail = async (order, user) => {
  // Generate order items HTML
  const orderItemsHtml = order.items.map(item => {
    return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.product.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'Ice Deluxe Wears'}" <${process.env.EMAIL_FROM || 'orders@icedeluxewears.com'}>`,
    to: user.email,
    subject: `Order Confirmation #${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #333;">Your Order Confirmation</h1>
          <p style="font-size: 18px;">Order #${order.orderNumber}</p>
        </div>
        <div style="padding: 20px;">
          <p>Hello ${user.name},</p>
          <p>Thank you for your order! We're processing it now and will let you know when it ships.</p>
          
          <h3>Order Summary</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="padding: 10px; text-align: left;">Product</th>
                <th style="padding: 10px; text-align: center;">Quantity</th>
                <th style="padding: 10px; text-align: right;">Price</th>
                <th style="padding: 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${orderItemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold;">Subtotal:</td>
                <td style="padding: 10px; text-align: right;">$${order.totalAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold;">Total:</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">$${order.totalAmount.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          
          <h3>Shipping Address</h3>
          <p>
            ${order.shippingAddress.street}<br>
            ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}<br>
            ${order.shippingAddress.country}
          </p>
          
          <h3>Payment Method</h3>
          <p>${order.paymentMethod === 'paystack' ? 'Paystack' : order.paymentMethod}</p>
          
          <div style="margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/orders/${order._id}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Order Details</a>
          </div>
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px;">
          <p>u00a9 ${new Date().getFullYear()} Ice Deluxe Wears. All rights reserved.</p>
          <p>If you have any questions, please contact our customer support.</p>
        </div>
      </div>
    `
  };

  return sendMail(mailOptions);
};

/**
 * Send new order notification to admin
 * @param {Object} order - Order object with details
 * @param {Object} user - User object with name and email
 * @returns {Promise}
 */
const sendNewOrderAdminNotification = async (order, user) => {
  // Generate order items HTML
  const orderItemsHtml = order.items.map(item => {
    return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.product.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'Ice Deluxe Wears'}" <${process.env.EMAIL_FROM || 'orders@icedeluxewears.com'}>`,
    to: process.env.ADMIN_EMAIL || 'admin@icedeluxewears.com',
    subject: `New Order #${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #333;">New Order Received</h1>
          <p style="font-size: 18px;">Order #${order.orderNumber}</p>
        </div>
        <div style="padding: 20px;">
          <p>A new order has been placed by ${user.name} (${user.email}).</p>
          
          <h3>Order Summary</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="padding: 10px; text-align: left;">Product</th>
                <th style="padding: 10px; text-align: center;">Quantity</th>
                <th style="padding: 10px; text-align: right;">Price</th>
                <th style="padding: 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${orderItemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold;">Total:</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">$${order.totalAmount.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          
          <h3>Customer Details</h3>
          <p>
            <strong>Name:</strong> ${user.name}<br>
            <strong>Email:</strong> ${user.email}<br>
            <strong>Phone:</strong> ${user.phone || 'N/A'}
          </p>
          
          <h3>Shipping Address</h3>
          <p>
            ${order.shippingAddress.street}<br>
            ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}<br>
            ${order.shippingAddress.country}
          </p>
          
          <h3>Payment Method</h3>
          <p>${order.paymentMethod === 'paystack' ? 'Paystack' : order.paymentMethod}</p>
          <p><strong>Payment Status:</strong> ${order.paymentStatus}</p>
          
          <div style="margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/admin/orders/${order._id}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Order Details</a>
          </div>
        </div>
      </div>
    `
  };

  return sendMail(mailOptions);
};

/**
 * Send order status update email to customer
 * @param {Object} order - Order object with details
 * @param {Object} user - User object with name and email
 * @returns {Promise}
 */
const sendOrderStatusUpdateEmail = async (order, user) => {
  // Get status message based on order status
  let statusMessage = '';
  let statusTitle = '';
  
  switch(order.status) {
    case 'processing':
      statusTitle = 'Your Order is Being Processed';
      statusMessage = 'We\'re preparing your items for shipment.';
      break;
    case 'shipped':
      statusTitle = 'Your Order Has Been Shipped';
      statusMessage = 'Your order is on its way to you!';
      break;
    case 'delivered':
      statusTitle = 'Your Order Has Been Delivered';
      statusMessage = 'Your order has been delivered. We hope you enjoy your purchase!';
      break;
    case 'cancelled':
      statusTitle = 'Your Order Has Been Cancelled';
      statusMessage = 'Your order has been cancelled. If you have any questions, please contact our customer support.';
      break;
    default:
      statusTitle = 'Order Status Update';
      statusMessage = 'There has been an update to your order.';
  }
  
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'Ice Deluxe Wears'}" <${process.env.EMAIL_FROM || 'orders@icedeluxewears.com'}>`,
    to: user.email,
    subject: `${statusTitle} - Order #${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #333;">${statusTitle}</h1>
          <p style="font-size: 18px;">Order #${order.orderNumber}</p>
        </div>
        <div style="padding: 20px;">
          <p>Hello ${user.name},</p>
          <p>${statusMessage}</p>
          
          <h3>Order Status: ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</h3>
          
          <div style="margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/orders/${order._id}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Order Details</a>
          </div>
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px;">
          <p>u00a9 ${new Date().getFullYear()} Ice Deluxe Wears. All rights reserved.</p>
          <p>If you have any questions, please contact our customer support.</p>
        </div>
      </div>
    `
  };

  return sendMail(mailOptions);
};

module.exports = {
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendNewOrderAdminNotification,
  sendOrderStatusUpdateEmail
};
