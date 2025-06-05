/**
 * Shared email templates and styling components for consistent email design
 * This file provides reusable components and styles for all email templates
 */

// Email style constants
const EMAIL_STYLES = {
  colors: {
    primary: '#3f51b5',
    secondary: '#f50057',
    success: '#4caf50',
    warning: '#ff9800',
    danger: '#f44336',
    info: '#2196f3',
    dark: '#212121',
    light: '#f5f5f5',
    white: '#ffffff',
    darkText: '#333333',
    lightText: '#757575',
    lightBg: '#f9f9f9',
    border: '#e0e0e0'
  },
  fonts: {
    primary: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    size: {
      small: '12px',
      normal: '14px',
      large: '16px',
      xlarge: '18px',
      xxlarge: '24px'
    }
  },
  spacing: {
    small: '10px',
    medium: '20px',
    large: '30px'
  },
  borderRadius: '4px',
  maxWidth: '600px'
};

/**
 * Email component library for consistent UI elements
 */
const emailComponents = {
  /**
   * Create a button component
   * @param {string} text - Button text
   * @param {string} url - Button URL
   * @param {string} bgColor - Background color
   * @returns {string} HTML button
   */
  button: (text, url, bgColor = EMAIL_STYLES.colors.primary) => {
    return `
      <table border="0" cellpadding="0" cellspacing="0" style="margin: ${EMAIL_STYLES.spacing.medium} 0;">
        <tr>
          <td align="center" bgcolor="${bgColor}" style="border-radius: ${EMAIL_STYLES.borderRadius};">
            <a href="${url}" target="_blank" style="
              display: inline-block;
              padding: 12px 24px;
              font-family: ${EMAIL_STYLES.fonts.primary};
              font-size: ${EMAIL_STYLES.fonts.size.normal};
              color: ${EMAIL_STYLES.colors.white};
              text-decoration: none;
              border-radius: ${EMAIL_STYLES.borderRadius};
              font-weight: bold;
            ">${text}</a>
          </td>
        </tr>
      </table>
    `;
  },

  /**
   * Create a table component
   * @param {Array} headers - Table headers
   * @param {Array} rows - Table rows
   * @returns {string} HTML table
   */
  table: (headers, rows) => {
    return `
      <table border="0" cellpadding="10" cellspacing="0" width="100%" style="
        margin-bottom: ${EMAIL_STYLES.spacing.medium};
        border-collapse: collapse;
      ">
        <thead>
          <tr style="background-color: ${EMAIL_STYLES.colors.lightBg};">
            ${headers.map(header => `
              <th style="
                text-align: left;
                padding: 12px;
                border-bottom: 1px solid ${EMAIL_STYLES.colors.border};
                font-family: ${EMAIL_STYLES.fonts.primary};
                font-size: ${EMAIL_STYLES.fonts.size.normal};
              ">${header}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, rowIndex) => `
            <tr style="background-color: ${rowIndex % 2 === 0 ? EMAIL_STYLES.colors.white : EMAIL_STYLES.colors.lightBg};">
              ${row.map(cell => {
                const align = cell.align || 'left';
                const colSpan = cell.colSpan || 1;
                return `
                  <td style="
                    padding: 12px;
                    border-bottom: 1px solid ${EMAIL_STYLES.colors.border};
                    font-family: ${EMAIL_STYLES.fonts.primary};
                    font-size: ${EMAIL_STYLES.fonts.size.normal};
                    text-align: ${align};
                  " ${colSpan > 1 ? `colspan="${colSpan}"` : ''}>
                    ${cell.content}
                  </td>
                `;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  /**
   * Create an alert box component
   * @param {string} content - Alert content
   * @param {string} type - Alert type (success, warning, danger, info)
   * @returns {string} HTML alert box
   */
  alertBox: (content, type = 'info') => {
    const colors = {
      success: { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' },
      warning: { bg: '#fff8e1', border: '#ff9800', text: '#ef6c00' },
      danger: { bg: '#ffebee', border: '#f44336', text: '#c62828' },
      info: { bg: '#e3f2fd', border: '#2196f3', text: '#0d47a1' }
    };
    
    const alertColor = colors[type] || colors.info;
    
    return `
      <div style="
        background-color: ${alertColor.bg};
        border-left: 4px solid ${alertColor.border};
        color: ${alertColor.text};
        padding: ${EMAIL_STYLES.spacing.medium};
        margin: ${EMAIL_STYLES.spacing.medium} 0;
        border-radius: ${EMAIL_STYLES.borderRadius};
        font-family: ${EMAIL_STYLES.fonts.primary};
      ">
        ${content}
      </div>
    `;
  },

  /**
   * Create a divider component
   * @returns {string} HTML divider
   */
  divider: () => {
    return `
      <div style="
        height: 1px;
        background-color: ${EMAIL_STYLES.colors.border};
        margin: ${EMAIL_STYLES.spacing.medium} 0;
      "></div>
    `;
  },

  /**
   * Create a product card component
   * @param {Object} product - Product object
   * @param {string} actionUrl - Action URL
   * @param {string} actionText - Action text
   * @returns {string} HTML product card
   */
  productCard: (product, actionUrl, actionText = 'View Product') => {
    const imageUrl = product.images?.length > 0 
      ? product.images[0]
      : 'https://via.placeholder.com/300x200';
    
    return `
      <div style="
        border: 1px solid ${EMAIL_STYLES.colors.border};
        border-radius: ${EMAIL_STYLES.borderRadius};
        overflow: hidden;
        margin-bottom: ${EMAIL_STYLES.spacing.medium};
        font-family: ${EMAIL_STYLES.fonts.primary};
      ">
        <img src="${imageUrl}" alt="${product.name}" style="
          width: 100%;
          max-height: 200px;
          object-fit: cover;
        ">
        <div style="padding: ${EMAIL_STYLES.spacing.medium};">
          <h3 style="
            margin-top: 0;
            color: ${EMAIL_STYLES.colors.darkText};
            font-size: ${EMAIL_STYLES.fonts.size.large};
          ">${product.name}</h3>
          <p style="
            color: ${EMAIL_STYLES.colors.primary};
            font-weight: bold;
            font-size: ${EMAIL_STYLES.fonts.size.large};
          ">₦${product.price.toFixed(2)}</p>
          <a href="${actionUrl}" style="
            display: inline-block;
            padding: 8px 16px;
            background-color: ${EMAIL_STYLES.colors.primary};
            color: ${EMAIL_STYLES.colors.white};
            text-decoration: none;
            border-radius: ${EMAIL_STYLES.borderRadius};
            font-size: ${EMAIL_STYLES.fonts.size.normal};
          ">${actionText}</a>
        </div>
      </div>
    `;
  }
};

/**
 * Base email template that wraps all email content
 * @param {string} content - Main email content
 * @param {string} title - Email title
 * @param {string} subtitle - Email subtitle
 * @param {string} headerColor - Header background color
 * @returns {string} Complete HTML email
 */
const baseEmailTemplate = (content, title, subtitle = '', headerColor = EMAIL_STYLES.colors.primary) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body, html {
          margin: 0;
          padding: 0;
          font-family: ${EMAIL_STYLES.fonts.primary};
          line-height: 1.5;
          color: ${EMAIL_STYLES.colors.darkText};
        }
        .wrapper {
          width: 100%;
          background-color: #f5f5f5;
          padding: 20px 0;
        }
        .container {
          max-width: ${EMAIL_STYLES.maxWidth};
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: ${EMAIL_STYLES.borderRadius};
          overflow: hidden;
        }
        .header {
          background-color: ${headerColor};
          padding: ${EMAIL_STYLES.spacing.medium};
          color: #ffffff;
          text-align: center;
        }
        .content {
          padding: ${EMAIL_STYLES.spacing.medium};
        }
        .footer {
          background-color: ${EMAIL_STYLES.colors.lightBg};
          padding: ${EMAIL_STYLES.spacing.medium};
          text-align: center;
          font-size: ${EMAIL_STYLES.fonts.size.small};
          color: ${EMAIL_STYLES.colors.lightText};
        }
        h1 {
          margin: 0;
          font-size: ${EMAIL_STYLES.fonts.size.xxlarge};
        }
        h2 {
          margin: 5px 0 0;
          font-size: ${EMAIL_STYLES.fonts.size.large};
          font-weight: normal;
          opacity: 0.9;
        }
        @media only screen and (max-width: 600px) {
          .container {
            width: 100% !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <h1>${title}</h1>
            ${subtitle ? `<h2>${subtitle}</h2>` : ''}
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Ice Deluxe Wears. All rights reserved.</p>
            <p>
              <a href="${process.env.FRONTEND_URL}/privacy-policy" style="color: ${EMAIL_STYLES.colors.primary}; text-decoration: none;">Privacy Policy</a> | 
              <a href="${process.env.FRONTEND_URL}/terms-of-service" style="color: ${EMAIL_STYLES.colors.primary}; text-decoration: none;">Terms of Service</a>
            </p>
            <p>
              Ice Deluxe Wears, Lagos, Nigeria
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  EMAIL_STYLES,
  emailComponents,
  baseEmailTemplate
};
