const { sendMail } = require('../config/email.config');
const { EMAIL_STYLES, emailComponents, baseEmailTemplate } = require('./emailTemplates');
const Cart = require('../models/cart.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');

/**
 * Generate cart items rows with product images
 * @param {Array} items - Cart items array
 * @returns {Array} Formatted table rows
 */
const generateCartItemsRows = (items) => {
  return items.map(item => {
    if (!item.product) return null; // Skip if product is missing
    
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
      { content: item.quantity, align: 'center' },
      { content: `₦${item.price.toFixed(2)}`, align: 'right' }
    ];
  }).filter(Boolean); // Remove any null entries
};

/**
 * Send abandoned cart recovery emails to customers with inactive carts
 * @returns {Promise<{success: boolean, emailsSent: number, error?: string}>}
 */
const sendAbandonedCartEmails = async () => {
  try {
    console.log('Starting abandoned cart email process...');
    
    // Find carts that have items and haven't been updated in the last 24-72 hours
    const abandonedCarts = await Cart.find({
      'items.0': { $exists: true }, // Has at least one item
      updatedAt: { 
        $lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Older than 24 hours
        $gt: new Date(Date.now() - 72 * 60 * 60 * 1000)  // But not older than 72 hours
      },
      lastEmailSent: { $exists: false } // Only carts that haven't been emailed yet
    }).populate('user').populate('items.product');
    
    console.log(`Found ${abandonedCarts.length} abandoned carts`);
    
    let emailsSent = 0;
    
    // Process each abandoned cart
    for (const cart of abandonedCarts) {
      // Skip if no valid user is associated
      if (!cart.user || !mongoose.Types.ObjectId.isValid(cart.user._id)) {
        console.log('Skipping cart - no valid user');
        continue;
      }
      
      const user = await User.findById(cart.user._id);
      if (!user || !user.email) {
        console.log(`Skipping cart for user ${cart.user._id} - no valid email`);
        continue;
      }
      
      // Generate email content
      const cartItemsRows = generateCartItemsRows(cart.items);
      
      const content = `
        <p>Hello ${user.name},</p>
        <p>We noticed you left some items in your shopping cart. Would you like to complete your purchase?</p>
        
        <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Your Cart Items</h3>
        ${emailComponents.table(
          ['Product', 'Quantity', 'Price'],
          cartItemsRows.length > 0 ? cartItemsRows : [[
            { content: 'Your cart items are no longer available', colSpan: 3, align: 'center' }
          ]]
        )}
        
        ${emailComponents.button(
          'Complete Your Purchase',
          `${process.env.FRONTEND_URL}/cart`,
          EMAIL_STYLES.colors.primary
        )}
        
        <div style="margin-top: ${EMAIL_STYLES.spacing.large};">
          <p>If you experienced any issues during checkout or have questions about your order, 
          please don't hesitate to contact our customer support team.</p>
        </div>
        
        <div style="margin-top: ${EMAIL_STYLES.spacing.large}; font-size: 14px; color: ${EMAIL_STYLES.colors.lightText};">
          <p>If you no longer wish to receive these emails, you can 
          <a href="${process.env.FRONTEND_URL}/account/preferences" style="color: ${EMAIL_STYLES.colors.primary};">
            update your preferences
          </a>.</p>
        </div>
      `;

      // Send the email
      await sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || 'Ice Deluxe Wears'}" <${process.env.EMAIL_FROM || 'noreply@icedeluxewears.com'}>`,
        to: user.email,
        subject: 'Complete Your Purchase at Ice Deluxe Wears',
        html: baseEmailTemplate(
          content,
          'Your Cart is Waiting!',
          'Don\'t miss out on these items',
          EMAIL_STYLES.colors.warning
        )
      });
      
      // Mark the cart as emailed to prevent duplicate emails
      cart.lastEmailSent = new Date();
      await cart.save();
      
      emailsSent++;
      console.log(`Sent abandoned cart email to ${user.email}`);
    }
    
    console.log(`Abandoned cart email process completed. Sent ${emailsSent} emails.`);
    return { success: true, emailsSent };
    
  } catch (error) {
    console.error('Error sending abandoned cart emails:', error);
    return { success: false, error: error.message, emailsSent: 0 };
  }
};

/**
 * Send abandoned cart recovery email for a specific cart
 * @param {Object} cart - Cart object with populated user and items
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const sendAbandonedCartEmail = async (cart) => {
  try {
    // Validate cart and user
    if (!cart.user || !mongoose.Types.ObjectId.isValid(cart.user._id)) {
      throw new Error('No valid user associated with cart');
    }
    
    const user = await User.findById(cart.user._id);
    if (!user || !user.email) {
      throw new Error('User not found or no email available');
    }
    
    // Generate email content
    const cartItemsRows = generateCartItemsRows(cart.items);
    
    const content = `
      <p>Hello ${user.name},</p>
      <p>We noticed you left some items in your shopping cart. Would you like to complete your purchase?</p>
      
      <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Your Cart Items</h3>
      ${emailComponents.table(
        ['Product', 'Quantity', 'Price'],
        cartItemsRows.length > 0 ? cartItemsRows : [[
          { content: 'Your cart items are no longer available', colSpan: 3, align: 'center' }
        ]]
      )}
      
      ${emailComponents.button(
        'Complete Your Purchase',
        `${process.env.FRONTEND_URL}/cart`,
        EMAIL_STYLES.colors.primary
      )}
      
      <div style="margin-top: ${EMAIL_STYLES.spacing.large};">
        <p>If you experienced any issues during checkout or have questions about your order, 
        please don't hesitate to contact our customer support team.</p>
      </div>
    `;

    // Send the email
    await sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Ice Deluxe Wears'}" <${process.env.EMAIL_FROM || 'noreply@icedeluxewears.com'}>`,
      to: user.email,
      subject: 'Complete Your Purchase at Ice Deluxe Wears',
      html: baseEmailTemplate(
        content,
        'Your Cart is Waiting!',
        'Don\'t miss out on these items',
        EMAIL_STYLES.colors.warning
      )
    });
    
    console.log(`Sent abandoned cart email to ${user.email}`);
    return { success: true };
    
  } catch (error) {
    console.error('Error sending abandoned cart email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendAbandonedCartEmails,
  sendAbandonedCartEmail
};