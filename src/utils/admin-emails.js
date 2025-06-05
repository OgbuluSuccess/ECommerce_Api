const { sendMail } = require('../config/email.config');

// Constants for consistent styling and branding
const EMAIL_STYLES = {
  fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  maxWidth: '650px',
  colors: {
    primary: '#4a6baf',
    danger: '#e74c3c',
    success: '#2ecc71',
    warning: '#f39c12',
    lightBg: '#f8f9fa',
    darkText: '#2c3e50',
    lightText: '#7f8c8d'
  },
  spacing: {
    small: '10px',
    medium: '20px',
    large: '30px'
  },
  borderRadius: '6px',
  borderColor: '#e0e0e0'
};

// Helper functions for common email components
const emailComponents = {
  header: (title, subtitle = '', color = EMAIL_STYLES.colors.primary) => `
    <div style="
      background-color: ${color};
      padding: ${EMAIL_STYLES.spacing.medium};
      text-align: center;
      border-radius: ${EMAIL_STYLES.borderRadius} ${EMAIL_STYLES.borderRadius} 0 0;
      color: white;
    ">
      <h1 style="margin: 0; font-size: 24px;">${title}</h1>
      ${subtitle ? `<p style="margin: 8px 0 0; font-size: 16px;">${subtitle}</p>` : ''}
    </div>
  `,

  footer: () => `
    <div style="
      background-color: ${EMAIL_STYLES.colors.lightBg};
      padding: ${EMAIL_STYLES.spacing.medium};
      text-align: center;
      color: ${EMAIL_STYLES.colors.lightText};
      font-size: 12px;
      border-radius: 0 0 ${EMAIL_STYLES.borderRadius} ${EMAIL_STYLES.borderRadius};
    ">
      <p style="margin: 0;">© ${new Date().getFullYear()} Ice Deluxe Wears. All rights reserved.</p>
    </div>
  `,

  alertBox: (content, type = 'info') => {
    const colorMap = {
      danger: EMAIL_STYLES.colors.danger,
      warning: EMAIL_STYLES.colors.warning,
      success: EMAIL_STYLES.colors.success,
      info: EMAIL_STYLES.colors.primary
    };
    const color = colorMap[type] || colorMap.info;
    
    return `
      <div style="
        background-color: ${EMAIL_STYLES.colors.lightBg};
        padding: ${EMAIL_STYLES.spacing.medium};
        margin: ${EMAIL_STYLES.spacing.medium} 0;
        border-left: 4px solid ${color};
        border-radius: 0 ${EMAIL_STYLES.borderRadius} ${EMAIL_STYLES.borderRadius} 0;
      ">
        ${content}
      </div>
    `;
  },

  button: (text, url, color = EMAIL_STYLES.colors.primary) => `
    <div style="text-align: center; margin: ${EMAIL_STYLES.spacing.large} 0;">
      <a href="${url}" style="
        background-color: ${color};
        color: white;
        padding: ${EMAIL_STYLES.spacing.small} ${EMAIL_STYLES.spacing.medium};
        text-decoration: none;
        border-radius: ${EMAIL_STYLES.borderRadius};
        font-weight: bold;
        display: inline-block;
      ">
        ${text}
      </a>
    </div>
  `,

  table: (headers, rows) => {
    const headerCells = headers.map(header => `
      <th style="
        padding: ${EMAIL_STYLES.spacing.small};
        text-align: left;
        background-color: ${EMAIL_STYLES.colors.lightBg};
        border-bottom: 1px solid ${EMAIL_STYLES.borderColor};
      ">
        ${header}
      </th>
    `).join('');

    const bodyRows = rows.map(row => `
      <tr>
        ${row.map(cell => `
          <td style="
            padding: ${EMAIL_STYLES.spacing.small};
            border-bottom: 1px solid ${EMAIL_STYLES.borderColor};
            ${cell.align ? `text-align: ${cell.align};` : ''}
          ">
            ${cell.content}
          </td>
        `).join('')}
      </tr>
    `).join('');

    return `
      <table style="
        width: 100%;
        border-collapse: collapse;
        margin: ${EMAIL_STYLES.spacing.medium} 0;
      ">
        <thead>
          <tr>${headerCells}</tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    `;
  }
};

/**
 * Base email template wrapper
 * @param {string} content - Main content HTML
 * @param {string} title - Email title
 * @param {string} subtitle - Email subtitle
 * @param {string} headerColor - Color for the header
 * @returns {string} Complete email HTML
 */
const baseEmailTemplate = (content, title, subtitle = '', headerColor = EMAIL_STYLES.colors.primary) => `
  <div style="
    font-family: ${EMAIL_STYLES.fontFamily};
    max-width: ${EMAIL_STYLES.maxWidth};
    margin: 0 auto;
    border: 1px solid ${EMAIL_STYLES.borderColor};
    border-radius: ${EMAIL_STYLES.borderRadius};
    overflow: hidden;
  ">
    ${emailComponents.header(title, subtitle, headerColor)}
    
    <div style="padding: ${EMAIL_STYLES.spacing.medium};">
      ${content}
    </div>
    
    ${emailComponents.footer()}
  </div>
`;

/**
 * Send low stock alert to admin
 * @param {Object} product - Product object with details
 * @returns {Promise}
 */
const sendLowStockAlert = async (product) => {
  try {
    const productDetails = `
      <h3 style="margin-top: 0; color: ${EMAIL_STYLES.colors.darkText};">${product.name}</h3>
      <p><strong>Current Stock:</strong> ${product.stock} units</p>
      <p><strong>SKU:</strong> ${product.sku || 'N/A'}</p>
      ${product.category ? `<p><strong>Category:</strong> ${product.category.name}</p>` : ''}
    `;

    const content = `
      <p>This is an automated alert to inform you that the following product is running low on stock:</p>
      
      ${emailComponents.alertBox(productDetails, 'danger')}
      
      <p>Please restock this item soon to avoid stockouts.</p>
      
      ${emailComponents.button(
        'Manage Product', 
        `${process.env.FRONTEND_URL}/admin/products/${product._id}`,
        EMAIL_STYLES.colors.danger
      )}
    `;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Ice Deluxe Wears System'}" <${process.env.EMAIL_FROM || 'system@icedeluxewears.com'}>`,
      to: process.env.ADMIN_EMAIL || 'info@icedeluxewears.com',
      subject: `Low Stock Alert: ${product.name}`,
      html: baseEmailTemplate(
        content,
        'Low Stock Alert',
        'Immediate attention required',
        EMAIL_STYLES.colors.danger
      )
    };

    return await sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending low stock alert:', error);
    throw error;
  }
};

/**
 * Generate order summary content
 * @param {Array} orders - Array of orders
 * @param {string} period - 'daily' or 'weekly'
 * @returns {Object} Summary data and HTML
 */
const generateOrderSummary = (orders, period) => {
  // Calculate total revenue
  const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  
  // Count orders by status
  const ordersByStatus = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});
  
  // Generate status items
  const statusItems = Object.entries(ordersByStatus).map(([status, count]) => {
    return `<li><strong>${status.charAt(0).toUpperCase() + status.slice(1)}:</strong> ${count} orders</li>`;
  }).join('');
  
  // Get top selling products
  const productSales = {};
  orders.forEach(order => {
    order.items.forEach(item => {
      const productId = item.product._id.toString();
      if (!productSales[productId]) {
        productSales[productId] = {
          name: item.product.name,
          quantity: 0,
          revenue: 0
        };
      }
      productSales[productId].quantity += item.quantity;
      productSales[productId].revenue += item.price * item.quantity;
    });
  });
  
  // Sort products by revenue and get top 5
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  
  // Generate top products table rows
  const topProductRows = topProducts.map(product => ([
    { content: product.name },
    { content: product.quantity, align: 'center' },
    { content: `₦${product.revenue.toFixed(2)}`, align: 'right' }
  ]));
  
  const summaryContent = `
    <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Summary</h3>
    <ul>
      <li><strong>Total Orders:</strong> ${orders.length}</li>
      <li><strong>Total Revenue:</strong> ₦${totalRevenue.toFixed(2)}</li>
    </ul>
    
    <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Orders by Status</h3>
    <ul>${statusItems}</ul>
    
    <h3 style="color: ${EMAIL_STYLES.colors.darkText};">Top Selling Products</h3>
    ${emailComponents.table(
      ['Product', 'Quantity', 'Revenue'],
      topProductRows.length > 0 
        ? topProductRows 
        : [[
            { content: 'No products sold in this period', colSpan: 3, align: 'center' }
          ]]
    )}
    
    ${emailComponents.button(
      'View All Orders',
      `${process.env.FRONTEND_URL}/admin/orders`
    )}
  `;

  return {
    totalRevenue,
    ordersByStatus,
    topProducts,
    summaryContent
  };
};

/**
 * Send order summary to admin
 * @param {Array} orders - Array of orders for the period
 * @param {String} period - 'daily' or 'weekly'
 * @returns {Promise}
 */
const sendOrderSummary = async (orders, period) => {
  try {
    const { summaryContent } = generateOrderSummary(orders, period);
    
    const periodTitle = period === 'daily' ? 'Daily' : 'Weekly';
    const dateString = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Ice Deluxe Wears System'}" <${process.env.EMAIL_FROM || 'system@icedeluxewears.com'}>`,
      to: process.env.ADMIN_EMAIL || 'info@icedeluxewears.com',
      subject: `${periodTitle} Order Summary - ${dateString}`,
      html: baseEmailTemplate(
        summaryContent,
        `${periodTitle} Order Summary`,
        dateString
      )
    };

    return await sendMail(mailOptions);
  } catch (error) {
    console.error(`Error sending ${period} order summary:`, error);
    throw error;
  }
};

/**
 * Send failed payment notification to admin
 * @param {Object} order - Order object with details
 * @param {Object} user - User object with name and email
 * @param {Object} paymentDetails - Payment attempt details
 * @returns {Promise}
 */
const sendFailedPaymentAlert = async (order, user, paymentDetails) => {
  try {
    const orderDetails = `
      <h3 style="margin-top: 0; color: ${EMAIL_STYLES.colors.darkText};">Order Details</h3>
      <p><strong>Order ID:</strong> ${order._id}</p>
      <p><strong>Order Number:</strong> ${order.orderNumber}</p>
      <p><strong>Amount:</strong> ₦${order.totalAmount.toFixed(2)}</p>
      <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
    `;

    const customerDetails = `
      <h3 style="margin-top: 0; color: ${EMAIL_STYLES.colors.darkText};">Customer Details</h3>
      <p><strong>Name:</strong> ${user.name}</p>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Phone:</strong> ${user.phone || 'N/A'}</p>
    `;

    const paymentInfo = `
      <h3 style="margin-top: 0; color: ${EMAIL_STYLES.colors.darkText};">Payment Details</h3>
      <p><strong>Payment Method:</strong> ${paymentDetails.method || 'Unknown'}</p>
      <p><strong>Reference:</strong> ${paymentDetails.reference || 'N/A'}</p>
      <p><strong>Error Message:</strong> ${paymentDetails.errorMessage || 'Unknown error'}</p>
      <p><strong>Attempt Time:</strong> ${new Date(paymentDetails.timestamp).toLocaleString()}</p>
    `;

    const content = `
      <p>A payment attempt has failed for the following order:</p>
      
      ${emailComponents.alertBox(orderDetails, 'danger')}
      ${emailComponents.alertBox(customerDetails, 'warning')}
      ${emailComponents.alertBox(paymentInfo, 'danger')}
      
      ${emailComponents.button(
        'View Order',
        `${process.env.FRONTEND_URL}/admin/orders/${order._id}`,
        EMAIL_STYLES.colors.danger
      )}
    `;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Ice Deluxe Wears System'}" <${process.env.EMAIL_FROM || 'system@icedeluxewears.com'}>`,
      to: process.env.ADMIN_EMAIL || 'info@icedeluxewears.com',
      subject: `Failed Payment Alert - Order #${order.orderNumber}`,
      html: baseEmailTemplate(
        content,
        'Failed Payment Alert',
        `Order #${order.orderNumber}`,
        EMAIL_STYLES.colors.danger
      )
    };

    return await sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending failed payment alert:', error);
    throw error;
  }
};

/**
 * Send daily order summary to admin
 * @param {Array} orders - Array of orders for the day
 * @returns {Promise}
 */
const sendDailyOrderSummary = async (orders) => {
  return sendOrderSummary(orders, 'daily');
};

/**
 * Send weekly order summary to admin
 * @param {Array} orders - Array of orders for the week
 * @returns {Promise}
 */
const sendWeeklyOrderSummary = async (orders) => {
  return sendOrderSummary(orders, 'weekly');
};

module.exports = {
  sendLowStockAlert,
  sendOrderSummary,
  sendDailyOrderSummary,
  sendWeeklyOrderSummary,
  sendFailedPaymentAlert
};