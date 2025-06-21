const { sendMail } = require('../config/email.config');
const { EMAIL_STYLES, emailComponents, baseEmailTemplate } = require('./emailTemplates');
const { StorePickup } = require('../models/shipping.model');

/**
 * Helper function to generate order items table rows.
 * It robustly finds the product name from the item object.
 * @param {Array} items - Order items array.
 * @returns {Array} Formatted table rows for emailComponents.table.
 */
const generateOrderItemsRows = (items) => {
  if (!items || items.length === 0) {
    return [[{ content: 'No items in this order.', colSpan: 5 }]];
  }
  return items.map(item => {
    // Get product name with fallbacks
    let productName = 'Product Name Unavailable';
    if (item.productName) {
      productName = item.productName;
    } else if (item.name) {
      productName = item.name;
    } else if (item.product && typeof item.product === 'object' && item.product.name) {
      productName = item.product.name;
    } else if (item.productId && typeof item.productId === 'object' && item.productId.name) {
      productName = item.productId.name; // Fallback for different population strategies
    }

    // Get variant details
    const hasVariant = item.color && item.color !== 'default' || item.size && item.size !== 'default';
    let variantInfo = [];
    
    if (hasVariant) {
      // Add color information if available
      if (item.color && item.color !== 'default') {
        variantInfo.push(`Color: ${item.color}`);
      }
      
      // Add size information if available
      if (item.size && item.size !== 'default') {
        variantInfo.push(`Size: ${item.size}`);
      }
      
      // Add SKU information if available (variant-specific)
      if (item.variantSku) {
        variantInfo.push(`SKU: ${item.variantSku}`);
      }
    }

    // Format product name with variant info
    const displayName = hasVariant 
      ? `${productName}<br><span style="font-size: 0.9em; color: #666;">${variantInfo.join(', ')}</span>` 
      : productName;

    // Get product image - prefer variant-specific image if available
    const imageUrl = item.variantImage || 
      (item.product && item.product.images && item.product.images.length > 0 ? item.product.images[0].url : '');

    const price = item.price || 0;
    const quantity = item.quantity || 0;
    const total = price * quantity;

    // Return row with optional image column if image is available
    return [
      { 
        content: imageUrl ? 
          `<div style="display: flex; align-items: center;">
            <img src="${imageUrl}" alt="${productName}" style="width: 50px; height: 50px; object-fit: cover; margin-right: 10px; border-radius: 4px;">
            <div>${displayName}</div>
          </div>` : 
          displayName,
        align: 'left'
      },
      { content: quantity, align: 'center' },
      { content: `₦${price.toFixed(2)}`, align: 'right' },
      { content: `₦${total.toFixed(2)}`, align: 'right' },
    ];
  });
};

/**
 * Generates the HTML for shipping information based on order type.
 * @param {Object} order - The order object.
 * @param {Object} pickupDetails - Fallback pickup details from DB.
 * @returns {string} HTML string for the shipping section.
 */
const generateShippingInfoHtml = (order, pickupDetails) => {
  const isPickup = order.shipping && order.shipping.isPickup;

  if (isPickup) {
    const storeAddress = (order.shipping && order.shipping.storeAddress) || (pickupDetails && pickupDetails.storeAddress) || 'Our pickup location.';
    const prepTime = (order.shipping && order.shipping.estimatedDeliveryTime) || (pickupDetails && pickupDetails.preparationTime) || 'Usually ready in 2-4 hours.';
    const instructions = (order.shipping && order.shipping.pickupInstructions) || (pickupDetails && pickupDetails.pickupInstructions) || 'Please bring your order confirmation and a valid ID.';

    return `
      <p><strong>Delivery Method:</strong> Store Pickup</p>
      <p><strong>Pickup Location:</strong><br>${storeAddress.replace(/\n/g, '<br>')}</p>
      <p><strong>Ready for Pickup:</strong> ${prepTime}</p>
      <p><strong>Pickup Instructions:</strong><br>${instructions.replace(/\n/g, '<br>')}</p>
    `;
  }

  // Handle standard delivery
  const shippingAddress = order.shippingAddress;
  if (!shippingAddress || !shippingAddress.street) {
    return '<p><strong>Shipping Address:</strong> Not provided.</p>';
  }

  const addressParts = [
    shippingAddress.city,
    shippingAddress.state,
    shippingAddress.zipCode,
  ].filter(Boolean).join(', ');

  return `
    <p><strong>Delivery Method:</strong> ${order.shipping?.carrier || 'Standard Delivery'}</p>
    <p><strong>Shipping Address:</strong><br>
      ${shippingAddress.street}<br>
      ${addressParts}<br>
      ${shippingAddress.country || 'Nigeria'}
    </p>
    ${order.shipping?.estimatedDeliveryTime ? `<p><strong>Estimated Delivery:</strong> ${order.shipping.estimatedDeliveryTime}</p>` : ''}
  `;
};


/**
 * Send order confirmation email to a customer.
 * @param {Object} order - The order object.
 * @param {Object} user - The user object.
 */
const sendOrderConfirmationEmail = async (order, user) => {
  try {
    let pickupDetails = null;
    if (order.shipping && order.shipping.isPickup) {
      pickupDetails = await StorePickup.findOne();
    }

    const orderItemsTable = emailComponents.table(
      ['Product', 'Qty', 'Price', 'Total'],
      generateOrderItemsRows(order.items)
    );

    const shippingInfoHtml = generateShippingInfoHtml(order, pickupDetails);

    const content = `
      <p>Dear ${user.name || 'Customer'},</p>
      <p>Thank you for your order! We've received it and are getting it ready. Here is a summary of your purchase:</p>
      
      <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Order Summary</h3>
      <div style="background-color: ${EMAIL_STYLES.colors.lightBg}; padding: ${EMAIL_STYLES.spacing.small}; border-radius: ${EMAIL_STYLES.borderRadius}; margin-bottom: ${EMAIL_STYLES.spacing.medium};">
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
        <p><strong>Payment Status:</strong> ${order.paymentStatus}</p>
      </div>

      ${orderItemsTable}
      
      <div style="margin: ${EMAIL_STYLES.spacing.medium} 0; text-align: right;">
        <p><strong>Subtotal:</strong> ₦${(order.productAmount || 0).toFixed(2)}</p>
        ${order.shipping.cost > 0 ? `<p><strong>Shipping:</strong> ₦${order.shipping.cost.toFixed(2)}</p>` : ''}
        <p style="font-size: 1.1em; font-weight: bold;"><strong>Total:</strong> ₦${(order.totalAmount || 0).toFixed(2)}</p>
      </div>

      <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Shipping Information</h3>
      <div style="background-color: ${EMAIL_STYLES.colors.lightBg}; padding: ${EMAIL_STYLES.spacing.small}; border-radius: ${EMAIL_STYLES.borderRadius};">
        ${shippingInfoHtml}
      </div>

      <div style="margin-top: ${EMAIL_STYLES.spacing.large};">
        <p>If you have any questions, please reply to this email or contact our support team.</p>
        <p>Thank you for shopping with us!</p>
      </div>
    `;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: user.email,
      subject: `Your Ice Deluxe Wears Order #${order.orderNumber} is Confirmed`,
      html: baseEmailTemplate(
        content,
        'Order Confirmed!',
        `Order #${order.orderNumber}`
      )
    };

    await sendMail(mailOptions);
    console.log(`Order confirmation email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
  }
};

/**
 * Send new order notification to the admin.
 * @param {Object} order - The order object.
 * @param {Object} user - The user object.
 */
const sendNewOrderAdminNotification = async (order, user) => {
  try {
    let pickupDetails = null;
    if (order.shipping && order.shipping.isPickup) {
        pickupDetails = await StorePickup.findOne();
    }

    const orderItemsTable = emailComponents.table(
      ['Product', 'Qty', 'Price', 'Total'],
      generateOrderItemsRows(order.items)
    );

    const shippingInfoHtml = generateShippingInfoHtml(order, pickupDetails);

    const content = `
      <p>A new order has been placed on the website.</p>
      
      <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Order Details</h3>
      ${emailComponents.table([], [
        [{ content: '<strong>Order Number</strong>' }, { content: order.orderNumber }],
        [{ content: '<strong>Order Date</strong>' }, { content: new Date(order.createdAt).toLocaleString() }],
        [{ content: '<strong>Payment Status</strong>' }, { content: order.paymentStatus }],
        [{ content: '<strong>Order Status</strong>' }, { content: order.status }],
      ])}

      <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Order Items</h3>
      ${orderItemsTable}
      
      <div style="margin: ${EMAIL_STYLES.spacing.medium} 0; text-align: right;">
        <p><strong>Subtotal:</strong> ₦${(order.productAmount || 0).toFixed(2)}</p>
        ${order.shipping.cost > 0 ? `<p><strong>Shipping:</strong> ₦${order.shipping.cost.toFixed(2)}</p>` : ''}
        <p style="font-size: 1.1em; font-weight: bold;"><strong>Total:</strong> ₦${(order.totalAmount || 0).toFixed(2)}</p>
      </div>

      <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Customer Information</h3>
      <div style="background-color: ${EMAIL_STYLES.colors.lightBg}; padding: ${EMAIL_STYLES.spacing.small}; border-radius: ${EMAIL_STYLES.borderRadius};">
        <p><strong>Name:</strong> ${user.name || 'N/A'}</p>
        <p><strong>Email:</strong> ${user.email || 'N/A'}</p>
        <p><strong>Phone:</strong> ${user.phone || 'N/A'}</p>
        <p><strong>Account Type:</strong> ${user.isGuest ? 'Guest' : 'Registered'}</p>
      </div>

      <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Shipping Information</h3>
      <div style="background-color: ${EMAIL_STYLES.colors.lightBg}; padding: ${EMAIL_STYLES.spacing.small}; border-radius: ${EMAIL_STYLES.borderRadius};">
        ${shippingInfoHtml}
      </div>

      ${emailComponents.button(
        'View Order in Admin',
        `${process.env.FRONTEND_URL}/admin/orders/${order._id}`
      )}
    `;

    const adminEmail = process.env.ADMIN_EMAIL || 'info@icedeluxewears.com';

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: adminEmail,
      subject: `New Order Received - #${order.orderNumber}`,
      html: baseEmailTemplate(
        content,
        'New Order Received',
        `Order #${order.orderNumber}`,
        EMAIL_STYLES.colors.secondary
      )
    };

    await sendMail(mailOptions);
    console.log(`New order notification sent to ${adminEmail}`);
  } catch (error) {
    console.error('Error sending admin order notification:', error);
  }
};

/**
 * Send a failed payment alert to the admin.
 * @param {Object} order - The order object.
 * @param {Object} user - The user object.
 * @param {Object} paymentDetails - Details about the failed payment.
 */
const sendFailedPaymentAlert = async (order, user, paymentDetails) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    
    const orderItemsTable = emailComponents.table(
      ['Product', 'Qty', 'Price', 'Total'],
      generateOrderItemsRows(order.items)
    );

    const content = `
      <p><strong style="color: red;">⚠️ PAYMENT FAILED</strong></p>
      <p>A payment attempt has failed on the website.</p>
      
      <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Payment Details</h3>
      ${emailComponents.table([], [
        [{ content: '<strong>Payment Reference</strong>' }, { content: paymentDetails.reference || 'N/A' }],
        [{ content: '<strong>Payment Method</strong>' }, { content: paymentDetails.method || 'N/A' }],
        [{ content: '<strong>Error</strong>' }, { content: paymentDetails.errorMessage || 'Unknown error' }],
        [{ content: '<strong>Time</strong>' }, { content: new Date(paymentDetails.timestamp).toLocaleString() }],
      ])}
      
      <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Order Details</h3>
      ${emailComponents.table([], [
        [{ content: '<strong>Order Number</strong>' }, { content: order.orderNumber }],
        [{ content: '<strong>Customer</strong>' }, { content: `${user.name || 'Guest'} (${user.email})` }],
        [{ content: '<strong>Order Date</strong>' }, { content: new Date(order.createdAt).toLocaleString() }],
        [{ content: '<strong>Order Status</strong>' }, { content: order.status }],
        [{ content: '<strong>Amount</strong>' }, { content: `₦${(order.totalAmount || 0).toFixed(2)}` }],
      ])}

      <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Order Items</h3>
      ${orderItemsTable}
      
      <div style="margin-top: ${EMAIL_STYLES.spacing.large};">
        <p>Please check the payment gateway dashboard for more details.</p>
      </div>
    `;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: adminEmail,
      subject: `⚠️ PAYMENT FAILED - Order #${order.orderNumber}`,
      html: baseEmailTemplate(
        content,
        'Payment Failed',
        `Order #${order.orderNumber}`,
        EMAIL_STYLES.colors.danger
      )
    };

    await sendMail(mailOptions);
    console.log(`Failed payment alert sent to ${adminEmail}`);
  } catch (error) {
    console.error('Error sending failed payment alert:', error);
  }
};

module.exports = {
  sendOrderConfirmationEmail,
  sendNewOrderAdminNotification,
  sendFailedPaymentAlert,
  generateOrderItemsRows // Export this helper function for use in other modules
};
