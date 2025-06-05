const { sendMail } = require('../config/email.config');
const { EMAIL_STYLES, emailComponents, baseEmailTemplate } = require('./emailTemplates');

/**
 * Generate order items rows with product images
 * @param {Array} items - Order items array
 * @returns {Array} Formatted table rows
 */
const generateShippedItemsRows = (items) => {
  return items.map(item => {
    const imageUrl = item.product.images?.length > 0 
      ? item.product.images[0]
      : 'https://via.placeholder.com/100';
    
    return [
      { 
        content: `
          <img src="${imageUrl}" alt="${item.product.name}" width="50" 
            style="vertical-align: middle; margin-right: 10px;">
          ${item.product.name}
        ` 
      },
      { content: item.quantity, align: 'center' }
    ];
  });
};

/**
 * Generate review items rows with review links
 * @param {Array} items - Order items array
 * @returns {Array} Formatted table rows
 */
const generateReviewItemsRows = (items) => {
  return items.map(item => [
    { content: item.product.name },
    { 
      content: `
        <a href="${process.env.FRONTEND_URL}/products/${item.product._id}#review" 
          style="${emailComponents.buttonStyles.small} background-color: ${EMAIL_STYLES.colors.success};">
          Leave Review
        </a>
      `,
      align: 'center'
    }
  ]);
};

/**
 * Send shipping confirmation email with tracking information
 * @param {Object} order - Order object with details
 * @param {Object} user - User object with name and email
 * @param {Object} trackingInfo - Tracking information object
 * @returns {Promise}
 */
const sendShippingConfirmationEmail = async (order, user, trackingInfo) => {
  try {
    const shippedItemsRows = generateShippedItemsRows(order.items);
    
    const content = `
      <p>Hello ${user.name},</p>
      <p>Great news! Your order has been shipped and is on its way to you.</p>
      
      ${emailComponents.alertBox(`
        <h3 style="margin-top: 0; color: ${EMAIL_STYLES.colors.success};">Tracking Information</h3>
        <p><strong>Courier:</strong> ${trackingInfo.courier}</p>
        <p><strong>Tracking Number:</strong> ${trackingInfo.trackingNumber}</p>
        <p><strong>Estimated Delivery:</strong> ${trackingInfo.estimatedDelivery}</p>
      `, 'success')}
      
      ${emailComponents.button(
        'Track Your Package',
        trackingInfo.trackingUrl,
        EMAIL_STYLES.colors.success
      )}
      
      <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Items Being Shipped</h3>
      ${emailComponents.table(
        ['Product', 'Quantity'],
        shippedItemsRows
      )}
      
      <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Shipping Address</h3>
      <div style="background-color: ${EMAIL_STYLES.colors.lightBg}; padding: ${EMAIL_STYLES.spacing.small}; border-radius: ${EMAIL_STYLES.borderRadius};">
        <p>
          ${order.shippingAddress.street}<br>
          ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode || ''}<br>
          ${order.shippingAddress.country}
        </p>
      </div>
      
      ${emailComponents.button(
        'View Order Details',
        `${process.env.FRONTEND_URL}/orders/${order._id}`
      )}
      
      <div style="margin-top: ${EMAIL_STYLES.spacing.large}; font-size: 14px; color: ${EMAIL_STYLES.colors.lightText};">
        <p>If you have any questions about your order, please contact our customer support team.</p>
      </div>
    `;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Ice Deluxe Wears'}" <${process.env.EMAIL_FROM || 'orders@icedeluxewears.com'}>`,
      to: user.email,
      subject: `Your Order #${order.orderNumber} Has Shipped!`,
      html: baseEmailTemplate(
        content,
        'Your Order Has Shipped!',
        `Order #${order.orderNumber}`,
        EMAIL_STYLES.colors.success
      )
    };

    return await sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending shipping confirmation email:', error);
    throw error;
  }
};

/**
 * Send delivery confirmation email with feedback request
 * @param {Object} order - Order object with details
 * @param {Object} user - User object with name and email
 * @returns {Promise}
 */
const sendDeliveryConfirmationEmail = async (order, user) => {
  try {
    const reviewItemsRows = generateReviewItemsRows(order.items);
    
    const ratingStars = [5, 4, 3].map(rating => `
      <a href="${process.env.FRONTEND_URL}/feedback?orderId=${order._id}&rating=${rating}" 
        style="display: inline-block; margin: 0 5px; text-decoration: none; font-size: 24px; color: ${EMAIL_STYLES.colors.warning};">
        ${'⭐'.repeat(rating)}
      </a>
    `).join('');
    
    const content = `
      <p>Hello ${user.name},</p>
      <p>Your order has been delivered! We hope you love your new items from Ice Deluxe Wears.</p>
      
      <h3 style="color: ${EMAIL_STYLES.colors.darkText};">How was your experience?</h3>
      <p>We'd love to hear your feedback on your products:</p>
      
      ${emailComponents.table(
        ['Product', 'Leave a Review'],
        reviewItemsRows
      )}
      
      <div style="text-align: center; margin: ${EMAIL_STYLES.spacing.large} 0;">
        <p>How was your overall shopping experience?</p>
        <div style="margin-top: ${EMAIL_STYLES.spacing.small};">
          ${ratingStars}
        </div>
      </div>
      
      ${emailComponents.button(
        'View Order Details',
        `${process.env.FRONTEND_URL}/orders/${order._id}`
      )}
    `;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Ice Deluxe Wears'}" <${process.env.EMAIL_FROM || 'orders@icedeluxewears.com'}>`,
      to: user.email,
      subject: `Your Order #${order.orderNumber} Has Been Delivered!`,
      html: baseEmailTemplate(
        content,
        'Your Order Has Been Delivered!',
        `Order #${order.orderNumber}`,
        EMAIL_STYLES.colors.success
      )
    };

    return await sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending delivery confirmation email:', error);
    throw error;
  }
};

module.exports = {
  sendShippingConfirmationEmail,
  sendDeliveryConfirmationEmail
};