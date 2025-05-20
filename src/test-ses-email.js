require('dotenv').config();
const nodemailer = require('nodemailer');

// Create SES transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  debug: true // Enable debug output
});

// Test email function
async function testSESEmail() {
  console.log('Testing AWS SES email configuration...');
  console.log(`Host: ${process.env.EMAIL_HOST}`);
  console.log(`Port: ${process.env.EMAIL_PORT}`);
  console.log(`User: ${process.env.EMAIL_USER}`);
  
  try {
    // First verify connection
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    
    // Send a test email
    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: process.env.ADMIN_EMAIL || 'admin@icedeluxewears.com',
      subject: 'Test Email from Ice Deluxe Wears',
      text: 'This is a test email to verify AWS SES configuration is working correctly.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
            <h1 style="color: #333;">Email Configuration Test</h1>
          </div>
          <div style="padding: 20px;">
            <p>This is a test email to verify that your AWS SES email configuration is working correctly.</p>
            <p>If you're receiving this email, it means your email system is properly configured!</p>
            <p>Time sent: ${new Date().toLocaleString()}</p>
          </div>
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px;">
            <p>© ${new Date().getFullYear()} Ice Deluxe Wears. All rights reserved.</p>
          </div>
        </div>
      `
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
    
  } catch (error) {
    console.error('❌ Error testing SES email:', error);
    
    // Provide more detailed troubleshooting information
    if (error.code === 'ECONNREFUSED') {
      console.log('\nTROUBLESHOOTING:');
      console.log('- Check if your EMAIL_HOST is correct');
      console.log('- Verify that your EMAIL_PORT is not blocked by firewall');
      console.log('- Make sure you have internet connectivity');
    } else if (error.code === 'EAUTH') {
      console.log('\nTROUBLESHOOTING:');
      console.log('- Check if your EMAIL_USER and EMAIL_PASSWORD are correct');
      console.log('- Verify that your IAM user has SES sending permissions');
      console.log('- Make sure your AWS account is out of the SES sandbox if sending to non-verified emails');
    } else {
      console.log('\nTROUBLESHOOTING:');
      console.log('- Check all your email environment variables');
      console.log('- Verify that your AWS region matches your SES configuration');
      console.log('- Make sure your AWS SES service is properly set up');
    }
  }
}

// Run the test
testSESEmail();
