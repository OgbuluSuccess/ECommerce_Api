require('dotenv').config();
const { sendMail } = require('./config/email.config');
const { sendWelcomeEmail, sendOrderConfirmationEmail, sendNewOrderAdminNotification, sendOrderStatusUpdateEmail } = require('./utils/email.utils');

// Test function to verify email configuration
async function testEmailConfiguration() {
  try {
    // Send a test email to verify configuration
    const info = await sendMail({
      from: `"Test Email" <test@example.com>`,
      to: process.env.TEST_EMAIL || process.env.ADMIN_EMAIL || 'test@example.com',
      subject: 'Test Email Connection',
      text: 'This is a test email to verify the email configuration is working correctly.',
      html: '<p>This is a test email to verify the email configuration is working correctly.</p>'
    });
    
    console.log('Test email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Test email failed:', error);
    return false;
  }
}

// Sample user object for testing
const testUser = {
  _id: '60d21b4667d0d8992e610c85',
  name: 'Test User',
  email: process.env.TEST_EMAIL || process.env.ADMIN_EMAIL || 'test@example.com',
  phone: '+2341234567890'
};

// Sample order object for testing
const testOrder = {
  _id: '60d21b4667d0d8992e610c86',
  orderNumber: 'ORD-' + Date.now(),
  user: testUser._id,
  items: [
    {
      product: {
        _id: '60d21b4667d0d8992e610c87',
        name: 'Test Product 1',
        price: 1999.99,
        images: ['https://example.com/image1.jpg']
      },
      quantity: 2,
      price: 1999.99
    },
    {
      product: {
        _id: '60d21b4667d0d8992e610c88',
        name: 'Test Product 2',
        price: 999.99,
        images: ['https://example.com/image2.jpg']
      },
      quantity: 1,
      price: 999.99
    }
  ],
  totalAmount: 4999.97,
  shippingAddress: {
    street: '123 Test Street',
    city: 'Test City',
    state: 'Test State',
    zipCode: '12345',
    country: 'Nigeria'
  },
  paymentMethod: 'paystack',
  paymentStatus: 'completed',
  status: 'processing',
  createdAt: new Date(),
  updatedAt: new Date()
};

// Test all email types
async function testAllEmails() {
  console.log('Starting email tests...');
  
  // First verify SMTP connection
  const isConnected = await testEmailConfiguration();
  if (!isConnected) {
    console.error('Cannot proceed with email tests due to SMTP connection failure');
    return;
  }
  
  try {
    // Test welcome email
    console.log('Testing welcome email...');
    await sendWelcomeEmail(testUser);
    console.log('Welcome email sent successfully');
    
    // Wait a bit before sending the next email
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test order confirmation email
    console.log('Testing order confirmation email...');
    await sendOrderConfirmationEmail(testOrder, testUser);
    console.log('Order confirmation email sent successfully');
    
    // Wait a bit before sending the next email
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test admin notification email
    console.log('Testing admin notification email...');
    await sendNewOrderAdminNotification(testOrder, testUser);
    console.log('Admin notification email sent successfully');
    
    // Wait a bit before sending the next email
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test order status update email
    console.log('Testing order status update email...');
    // Test with different statuses
    const statuses = ['processing', 'shipped', 'delivered', 'cancelled'];
    for (const status of statuses) {
      const statusOrder = { ...testOrder, status };
      await sendOrderStatusUpdateEmail(statusOrder, testUser);
      console.log(`Order status update email (${status}) sent successfully`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('All email tests completed successfully!');
  } catch (error) {
    console.error('Error during email tests:', error);
  }
}

// Run the tests
testAllEmails();
