require('dotenv').config();
const nodemailer = require('nodemailer');

// Log environment variables (without showing passwords)
console.log('=== Email Configuration ===');
console.log(`EMAIL_HOST: ${process.env.EMAIL_HOST || 'Not set'}`);
console.log(`EMAIL_PORT: ${process.env.EMAIL_PORT || '587'}`);
console.log(`EMAIL_USER: ${process.env.EMAIL_USER ? '✓ Set' : '✗ Not set'}`);
console.log(`EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? '✓ Set' : '✗ Not set'}`);
console.log(`EMAIL_FROM: ${process.env.EMAIL_FROM || 'Not set'}`);
console.log(`ADMIN_EMAIL: ${process.env.ADMIN_EMAIL || 'Not set'}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'Not set'}`);
console.log(`FORCE_EMAIL_PRODUCTION: ${process.env.FORCE_EMAIL_PRODUCTION || 'Not set'}`);
console.log('=========================');

// Create transporter with debug mode
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  debug: true, // Show debug output
  logger: true  // Log information to console
});

// Test email function
async function testEmail() {
  try {
    console.log('Testing SMTP connection...');
    
    // First verify connection
    const verifyResult = await transporter.verify();
    console.log('SMTP connection verified:', verifyResult);
    
    // Send test email
    console.log('Sending test email...');
    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"Ice Deluxe Wears" <info@icedeluxewears.com>`,
      to: process.env.ADMIN_EMAIL || 'info@icedeluxewears.com',
      subject: 'Test Email from API',
      html: `
        <h1>Email Test</h1>
        <p>This is a test email sent from your API at ${new Date().toISOString()}</p>
        <p>If you're seeing this, your email configuration is working correctly!</p>
        <p>Environment: ${process.env.NODE_ENV || 'Not set'}</p>
      `,
      text: `Email Test. This is a test email sent from your API at ${new Date().toISOString()}`
    });
    
    console.log('Email sent successfully!');
    console.log('Message ID:', result.messageId);
    console.log('Response:', result.response);
    
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Test AWS SES if available
async function testSES() {
  try {
    // Check if AWS SDK is installed
    let AWS;
    try {
      AWS = require('aws-sdk');
    } catch (e) {
      console.log('AWS SDK not installed. Skipping SES test.');
      return;
    }
    
    console.log('Testing AWS SES...');
    const ses = new AWS.SES({ 
      region: process.env.AWS_REGION || 'us-east-1',
      apiVersion: '2010-12-01'
    });
    
    const params = {
      Source: process.env.EMAIL_FROM || 'info@icedeluxewears.com',
      Destination: {
        ToAddresses: [process.env.ADMIN_EMAIL || 'info@icedeluxewears.com']
      },
      Message: {
        Subject: {
          Data: 'Test Email from API using AWS SES'
        },
        Body: {
          Html: {
            Data: `
              <h1>AWS SES Test Email</h1>
              <p>This is a test email sent from your API using AWS SES at ${new Date().toISOString()}</p>
              <p>If you're seeing this, your AWS SES configuration is working correctly!</p>
            `
          },
          Text: {
            Data: `AWS SES Test Email. This is a test email sent from your API using AWS SES at ${new Date().toISOString()}`
          }
        }
      }
    };
    
    const result = await ses.sendEmail(params).promise();
    console.log('SES email sent successfully!');
    console.log('Message ID:', result.MessageId);
    
    return result;
  } catch (error) {
    console.error('Error sending SES email:', error);
    // Don't throw, just log the error
    console.log('SES test failed. This is normal if you are not using AWS SES.');
  }
}

// Run tests
async function runTests() {
  console.log('Starting email tests...');
  
  try {
    // Test regular SMTP
    await testEmail();
  } catch (error) {
    console.error('SMTP test failed:', error.message);
  }
  
  try {
    // Test AWS SES if available
    await testSES();
  } catch (error) {
    console.error('SES test failed:', error.message);
  }
  
  console.log('Tests completed.');
}

// Run the tests
runTests().catch(console.error);
