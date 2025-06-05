require('dotenv').config();
const nodemailer = require('nodemailer');
const readline = require('readline');

// Create interactive interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Create email transporter
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

// Function to display email configuration
function displayEmailConfig() {
  console.log('\n=== EMAIL CONFIGURATION ===');
  console.log(`Host: ${process.env.EMAIL_HOST || 'Not set'}`);
  console.log(`Port: ${process.env.EMAIL_PORT || 'Not set'}`);
  console.log(`User: ${process.env.EMAIL_USER || 'Not set'}`);
  console.log(`From: ${process.env.EMAIL_FROM || 'Not set'}`);
  console.log(`From Name: ${process.env.EMAIL_FROM_NAME || 'Not set'}`);
  console.log(`Admin Email: ${process.env.ADMIN_EMAIL || 'Not set'}`);
  console.log('==========================\n');
}

// Function to verify SMTP connection
async function verifyConnection() {
  console.log('Verifying SMTP connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    return true;
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message);
    provideTroubleshooting(error);
    return false;
  }
}

// Function to send a test email
async function sendTestEmail(recipient) {
  console.log(`Sending test email to ${recipient}...`);
  
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: recipient,
      subject: 'Test Email from Ice Deluxe Wears',
      text: 'This is a test email to verify email configuration is working correctly.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
            <h1 style="color: #333;">Email Configuration Test</h1>
          </div>
          <div style="padding: 20px;">
            <p>This is a test email to verify that your email configuration is working correctly.</p>
            <p>If you're receiving this email, it means your email system is properly configured!</p>
            <p><strong>Configuration Details:</strong></p>
            <ul>
              <li>Host: ${process.env.EMAIL_HOST}</li>
              <li>Port: ${process.env.EMAIL_PORT}</li>
              <li>From: ${process.env.EMAIL_FROM}</li>
            </ul>
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
    return true;
  } catch (error) {
    console.error('❌ Error sending test email:', error.message);
    provideTroubleshooting(error);
    return false;
  }
}

// Function to provide troubleshooting guidance
function provideTroubleshooting(error) {
  console.log('\n=== TROUBLESHOOTING GUIDE ===');
  
  if (error.code === 'ECONNREFUSED') {
    console.log('Connection refused issues:');
    console.log('- Check if your EMAIL_HOST is correct');
    console.log('- Verify that your EMAIL_PORT is not blocked by firewall');
    console.log('- Make sure you have internet connectivity');
  } else if (error.code === 'EAUTH') {
    console.log('Authentication issues:');
    console.log('- Check if your EMAIL_USER and EMAIL_PASSWORD are correct');
    console.log('- For AWS SES: Verify that your IAM user has SES sending permissions');
    console.log('- For AWS SES: Make sure your account is out of the SES sandbox if sending to non-verified emails');
  } else if (error.code === 'ETIMEDOUT') {
    console.log('Connection timeout issues:');
    console.log('- Check your internet connection');
    console.log('- Verify that the EMAIL_HOST is reachable');
    console.log('- Try using a different port (587, 465, or 25)');
  } else {
    console.log('General issues:');
    console.log('- Check all your email environment variables');
    console.log('- Verify that your email service is properly set up');
    console.log('- Check if your email provider requires additional security settings');
    console.log(`- Error code: ${error.code || 'N/A'}`);
  }
  
  console.log('\nFor AWS SES specific issues:');
  console.log('- Verify your AWS region matches your SES configuration');
  console.log('- Check if your sending identity is verified in SES');
  console.log('- Review your SES sending limits and statistics');
  console.log('============================\n');
}

// Main function
async function testEmailConfig() {
  displayEmailConfig();
  
  const connectionSuccess = await verifyConnection();
  if (!connectionSuccess) {
    console.log('⚠️ Connection verification failed. Do you still want to attempt sending a test email? (y/n)');
    rl.question('> ', async (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        await promptAndSendEmail();
      } else {
        console.log('Email test cancelled. Please fix the connection issues first.');
        rl.close();
      }
    });
  } else {
    await promptAndSendEmail();
  }
}

// Function to prompt for email and send test
async function promptAndSendEmail() {
  const defaultEmail = process.env.ADMIN_EMAIL || 'admin@icedeluxewears.com';
  
  console.log(`\nEnter recipient email (default: ${defaultEmail}):`);
  rl.question('> ', async (email) => {
    const recipient = email.trim() || defaultEmail;
    await sendTestEmail(recipient);
    rl.close();
  });
}

// Run the test
testEmailConfig();
