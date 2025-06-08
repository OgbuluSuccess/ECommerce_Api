const { sendMail } = require('../config/email.config');
const { EMAIL_STYLES, emailComponents, baseEmailTemplate } = require('./emailTemplates');

/**
 * Helper function to generate order items table rows
 * @param {Array} items - Order items array
 * @returns {Array} Formatted table rows
 */
const generateOrderItemsRows = (items) => {
  return items.map(item => {
    // Handle both populated and non-populated product objects
    let productName = 'Product';
    
    // If product is populated as an object
    if (item.product && typeof item.product === 'object' && item.product.name) {
      productName = item.product.name;
    } 
    // If product name is directly on the item
    else if (item.name) {
      productName = item.name;
    }
    
    return [
      { content: productName },
      { content: item.quantity, align: 'center' },
      { content: `₦${item.price.toFixed(2)}`, align: 'right' },
      { content: `₦${(item.price * item.quantity).toFixed(2)}`, align: 'right' }
    ];
  });
};

/**
 * Send welcome email to newly registered user
 * @param {Object} user - User object with name and email
 * @returns {Promise}
 */
const sendWelcomeEmail = async (user) => {
  try {
    const content = `
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
      
      ${emailComponents.button(
        'Start Shopping',
        process.env.FRONTEND_URL,
        EMAIL_STYLES.colors.primary
      )}
      
      <div style="margin-top: ${EMAIL_STYLES.spacing.large}; font-size: 14px; color: ${EMAIL_STYLES.colors.lightText};">
        <p>If you did not register for this account, please ignore this email.</p>
      </div>
    `;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Ice Deluxe Wears'}" <${process.env.EMAIL_FROM || 'noreply@icedeluxewears.com'}>`,
      to: user.email,
      subject: 'Welcome to Ice Deluxe Wears',
      headers: {
        'X-Priority': '1',
        'Importance': 'high',
        'X-MSMail-Priority': 'High',
        'X-Mailer': 'Ice Deluxe Wears Mailer',
      },
      html: baseEmailTemplate(
        content,
        'Welcome to Ice Deluxe Wears!',
        'Your fashion journey begins here',
        EMAIL_STYLES.colors.primary
      )
    };

    return await sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
};

/**
 * Send order confirmation email to customer
 * @param {Object} order - Order object with details
 * @param {Object} user - User object with name and email
 * @returns {Promise}
 */
const sendOrderConfirmationEmail = async (order, user) => {
  try {
    const orderItemsRows = generateOrderItemsRows(order.items);
    
    const content = `
      <p>Hello ${user.name},</p>
      <p>Thank you for your order! We're processing it now and will let you know when it ships.</p>
      
      <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Order Summary</h3>
      ${emailComponents.table(
        ['Product', 'Qty', 'Price', 'Total'],
        orderItemsRows
      )}
      
      <div style="margin: ${EMAIL_STYLES.spacing.medium} 0;">
        <p><strong>Subtotal:</strong> ₦${order.totalAmount.toFixed(2)}</p>
        <p><strong>Total:</strong> ₦${order.totalAmount.toFixed(2)}</p>
      </div>
      
      <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Shipping Information</h3>
      <div style="background-color: ${EMAIL_STYLES.colors.lightBg}; padding: ${EMAIL_STYLES.spacing.small}; border-radius: ${EMAIL_STYLES.borderRadius};">
        <p>
          <strong>Address:</strong><br>
          ${order.shippingAddress.street}<br>
          ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}<br>
          ${order.shippingAddress.country}
        </p>
        <p>
          <strong>Shipping Zone:</strong> ${order.shipping && order.shipping.method === 'pickup' ? 'Store Pickup' : 
            (order.shipping && order.shipping.zone && order.shipping.zone.name ? order.shipping.zone.name : 'Standard Shipping')}
        </p>
        ${order.shipping && order.shipping.estimatedDeliveryTime ? 
          `<p><strong>Estimated Delivery:</strong> ${order.shipping.estimatedDeliveryTime}</p>` : ''}
      </div>
      
      <h3 style="color: ${EMAIL_STYLES.colors.darkText}; margin-top: ${EMAIL_STYLES.spacing.medium};">Payment Method</h3>
      <p>${order.paymentMethod === 'paystack' ? 'Paystack' : order.paymentMethod}</p>
      
    `;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Ice Deluxe Wears'}" <${process.env.EMAIL_FROM || 'orders@icedeluxewears.com'}>`,
      to: user.email,
      subject: `Order Confirmation #${order.orderNumber}`,
      headers: {
        'X-Priority': '1',
        'Importance': 'high',
        'X-MSMail-Priority': 'High',
        'X-Mailer': 'Ice Deluxe Wears Mailer',
      },
      html: baseEmailTemplate(
        content,
        'Your Order Confirmation',
        `Order #${order.orderNumber}`,
        EMAIL_STYLES.colors.success
      )
    };

    return await sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    throw error;
  }
};

/**
 * Send new order notification to admin
 * @param {Object} order - Order object with details
 * @param {Object} user - User object with name and email
 * @returns {Promise}
 */
const sendNewOrderAdminNotification = async (order, user) => {
  try {
    const orderItemsRows = generateOrderItemsRows(order.items);
    
    const content = `
      <p>A new order has been placed by ${user.name} (${user.email}).</p>
      
      <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Order Summary</h3>
      ${emailComponents.table(
        ['Product', 'Qty', 'Price', 'Total'],
        orderItemsRows
      )}
      
      <div style="margin: ${EMAIL_STYLES.spacing.medium} 0;">
        <p><strong>Total:</strong> ₦${order.totalAmount.toFixed(2)}</p>
      </div>
      
      <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Customer Details</h3>
      <div style="background-color: ${EMAIL_STYLES.colors.lightBg}; padding: ${EMAIL_STYLES.spacing.small}; border-radius: ${EMAIL_STYLES.borderRadius};">
        <p>
          <strong>Name:</strong> ${user.name}<br>
          <strong>Email:</strong> ${user.email}<br>
          <strong>Phone:</strong> ${user.phone || 'N/A'}
        </p>
      </div>
      
      <h3 style="color: ${EMAIL_STYLES.colors.darkText}; margin-top: ${EMAIL_STYLES.spacing.medium};">Shipping Information</h3>
      <div style="background-color: ${EMAIL_STYLES.colors.lightBg}; padding: ${EMAIL_STYLES.spacing.small}; border-radius: ${EMAIL_STYLES.borderRadius};">
        <p>
          <strong>Address:</strong><br>
          ${order.shippingAddress.street}<br>
          ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}<br>
          ${order.shippingAddress.country}
        </p>
        <p>
          <strong>Shipping Zone:</strong> ${order.shipping && order.shipping.method === 'pickup' ? 'Store Pickup' : 
            (order.shipping && order.shipping.zone && order.shipping.zone.name ? order.shipping.zone.name : 'Standard Shipping')}
        </p>
        ${order.shipping && order.shipping.estimatedDeliveryTime ? 
          `<p><strong>Estimated Delivery:</strong> ${order.shipping.estimatedDeliveryTime}</p>` : ''}
        ${order.shipping && order.shipping.cost ? 
          `<p><strong>Shipping Cost:</strong> ₦${order.shipping.cost.toFixed(2)}</p>` : ''}
      </div>
      
      <h3 style="color: ${EMAIL_STYLES.colors.darkText}; margin-top: ${EMAIL_STYLES.spacing.medium};">Payment Details</h3>
      <div style="background-color: ${EMAIL_STYLES.colors.lightBg}; padding: ${EMAIL_STYLES.spacing.small}; border-radius: ${EMAIL_STYLES.borderRadius};">
        <p><strong>Method:</strong> ${order.paymentMethod === 'paystack' ? 'Paystack' : order.paymentMethod}</p>
        <p><strong>Status:</strong> ${order.paymentStatus}</p>
      </div>
      
      ${emailComponents.button(
        'View Order Details',
        `${process.env.FRONTEND_URL}/admin/orders/${order._id}`,
        EMAIL_STYLES.colors.primary
      )}
    `;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Ice Deluxe Wears'}" <${process.env.EMAIL_FROM || 'orders@icedeluxewears.com'}>`,
      to: process.env.ADMIN_EMAIL || 'info@icedeluxewears.com',
      subject: `New Order #${order.orderNumber}`,
      headers: {
        'X-Priority': '1',
        'Importance': 'high',
        'X-MSMail-Priority': 'High',
        'X-Mailer': 'Ice Deluxe Wears Mailer',
      },
      html: baseEmailTemplate(
        content,
        'New Order Received',
        `Order #${order.orderNumber}`,
        EMAIL_STYLES.colors.success
      )
    };

    return await sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending new order admin notification:', error);
    throw error;
  }
};

/**
 * Send order status update email to customer
 * @param {Object} order - Order object with details
 * @param {Object} user - User object with name and email
 * @returns {Promise}
 */
const sendOrderStatusUpdateEmail = async (order, user) => {
  try {
    // Get status message based on order status
    const statusConfig = {
      processing: {
        title: 'Your Order is Being Processed',
        message: 'We\'re preparing your items for shipment.',
        color: EMAIL_STYLES.colors.primary
      },
      shipped: {
        title: 'Your Order Has Been Shipped',
        message: 'Your order is on its way to you!',
        color: EMAIL_STYLES.colors.success
      },
      delivered: {
        title: 'Your Order Has Been Delivered',
        message: 'Your order has been delivered. We hope you enjoy your purchase!',
        color: EMAIL_STYLES.colors.success
      },
      cancelled: {
        title: 'Your Order Has Been Cancelled',
        message: 'Your order has been cancelled. If you have any questions, please contact our customer support.',
        color: EMAIL_STYLES.colors.danger
      }
    };

    const { title, message, color } = statusConfig[order.status] || {
      title: 'Order Status Update',
      message: 'There has been an update to your order.',
      color: EMAIL_STYLES.colors.primary
    };

    const formattedStatus = order.status.charAt(0).toUpperCase() + order.status.slice(1);

    const content = `
      <p>Hello ${user.name},</p>
      <p>${message}</p>
      
      ${emailComponents.alertBox(
        `<h3 style="margin-top: 0; color: ${color};">Order Status: ${formattedStatus}</h3>`,
        order.status === 'cancelled' ? 'danger' : 'success'
      )}
      
      <div style="margin-top: ${EMAIL_STYLES.spacing.large}; font-size: 14px; color: ${EMAIL_STYLES.colors.lightText};">
        <p>If you have any questions, please contact our customer support.</p>
      </div>
    `;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Ice Deluxe Wears'}" <${process.env.EMAIL_FROM || 'orders@icedeluxewears.com'}>`,
      to: user.email,
      subject: `${title} - Order #${order.orderNumber}`,
      headers: {
        'X-Priority': '1',
        'Importance': 'high',
        'X-MSMail-Priority': 'High',
        'X-Mailer': 'Ice Deluxe Wears Mailer',
      },
      html: baseEmailTemplate(
        content,
        title,
        `Order #${order.orderNumber}`,
        color
      )
    };

    return await sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending order status update email:', error);
    throw error;
  }
};

module.exports = {
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendNewOrderAdminNotification,
  sendOrderStatusUpdateEmail
};