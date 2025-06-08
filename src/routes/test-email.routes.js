const express = require('express');
const router = express.Router();
const { sendMail } = require('../config/email.config');
const { baseEmailTemplate } = require('../utils/emailTemplates');

/**
 * @swagger
 * /test/email:
 *   get:
 *     summary: Test email sending functionality
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Email test results
 */
router.get('/email', async (req, res) => {
  try {
    console.log('Testing email configuration...');
    console.log(`Host: ${process.env.EMAIL_HOST}`);
    console.log(`Port: ${process.env.EMAIL_PORT || '587'}`);
    console.log(`User: ${process.env.EMAIL_USER ? '✓ Set' : '✗ Not set'}`);
    console.log(`Password: ${process.env.EMAIL_PASSWORD ? '✓ Set' : '✗ Not set'}`);
    console.log(`From: ${process.env.EMAIL_FROM || 'Not set'}`);
    console.log(`Admin Email: ${process.env.ADMIN_EMAIL || 'Not set'}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'Not set'}`);
    
    // Create test email content
    const testHtml = baseEmailTemplate({
      preheader: 'This is a test email from your API',
      content: `
        <h1>Email Test</h1>
        <p>This is a test email sent from your API at ${new Date().toISOString()}</p>
        <p>If you're seeing this, your email configuration is working correctly!</p>
        <p>Environment: ${process.env.NODE_ENV || 'Not set'}</p>
      `
    });
    
    // Send test email
    const result = await sendMail({
      from: process.env.EMAIL_FROM || `"Ice Deluxe Wears" <info@icedeluxewears.com>`,
      to: process.env.ADMIN_EMAIL || 'info@icedeluxewears.com',
      subject: 'Test Email from API',
      html: testHtml
    });
    
    res.status(200).json({
      success: true,
      message: 'Email test attempted',
      result,
      environmentInfo: {
        host: process.env.EMAIL_HOST || 'Not set',
        port: process.env.EMAIL_PORT || '587',
        user: process.env.EMAIL_USER ? 'Set' : 'Not set',
        password: process.env.EMAIL_PASSWORD ? 'Set' : 'Not set',
        from: process.env.EMAIL_FROM || 'Not set',
        adminEmail: process.env.ADMIN_EMAIL || 'Not set',
        nodeEnv: process.env.NODE_ENV || 'Not set',
        forceEmailProduction: process.env.FORCE_EMAIL_PRODUCTION || 'Not set'
      }
    });
  } catch (error) {
    console.error('Email test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Email test failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack,
      environmentInfo: {
        host: process.env.EMAIL_HOST || 'Not set',
        port: process.env.EMAIL_PORT || '587',
        user: process.env.EMAIL_USER ? 'Set' : 'Not set',
        password: process.env.EMAIL_PASSWORD ? 'Set' : 'Not set',
        from: process.env.EMAIL_FROM || 'Not set',
        adminEmail: process.env.ADMIN_EMAIL || 'Not set',
        nodeEnv: process.env.NODE_ENV || 'Not set',
        forceEmailProduction: process.env.FORCE_EMAIL_PRODUCTION || 'Not set'
      }
    });
  }
});

/**
 * @swagger
 * /test/ses:
 *   get:
 *     summary: Test AWS SES email sending
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: SES email test results
 */
router.get('/ses', async (req, res) => {
  try {
    const AWS = require('aws-sdk');
    const ses = new AWS.SES({ 
      region: process.env.AWS_REGION || 'us-east-1',
      apiVersion: '2010-12-01'
    });
    
    console.log('Testing AWS SES email configuration...');
    
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
    
    res.status(200).json({
      success: true,
      message: 'SES email test attempted',
      result,
      environmentInfo: {
        awsRegion: process.env.AWS_REGION || 'us-east-1',
        from: process.env.EMAIL_FROM || 'Not set',
        adminEmail: process.env.ADMIN_EMAIL || 'Not set'
      }
    });
  } catch (error) {
    console.error('SES email test failed:', error);
    res.status(500).json({
      success: false,
      message: 'SES email test failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack,
      environmentInfo: {
        awsRegion: process.env.AWS_REGION || 'us-east-1',
        from: process.env.EMAIL_FROM || 'Not set',
        adminEmail: process.env.ADMIN_EMAIL || 'Not set'
      }
    });
  }
});

/**
 * @swagger
 * /test/direct-smtp:
 *   get:
 *     summary: Test direct SMTP connection
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Direct SMTP test results
 */
router.get('/direct-smtp', async (req, res) => {
  try {
    const nodemailer = require('nodemailer');
    
    console.log('Testing direct SMTP connection...');
    console.log(`Host: ${process.env.EMAIL_HOST}`);
    console.log(`Port: ${process.env.EMAIL_PORT || '587'}`);
    
    // Create a test transporter
    const testTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      debug: true,
      logger: true // Log information to console
    });
    
    // Verify connection
    console.log('Verifying SMTP connection...');
    const verifyResult = await testTransporter.verify();
    console.log('SMTP connection verified:', verifyResult);
    
    // Send test email
    const result = await testTransporter.sendMail({
      from: process.env.EMAIL_FROM || `"Ice Deluxe Wears" <info@icedeluxewears.com>`,
      to: process.env.ADMIN_EMAIL || 'info@icedeluxewears.com',
      subject: 'Direct SMTP Test Email',
      html: `
        <h1>Direct SMTP Test Email</h1>
        <p>This is a test email sent via direct SMTP connection at ${new Date().toISOString()}</p>
        <p>If you're seeing this, your SMTP configuration is working correctly!</p>
      `,
      text: `Direct SMTP Test Email. This is a test email sent via direct SMTP connection at ${new Date().toISOString()}`
    });
    
    res.status(200).json({
      success: true,
      message: 'Direct SMTP test completed',
      verifyResult,
      sendResult: result,
      environmentInfo: {
        host: process.env.EMAIL_HOST || 'Not set',
        port: process.env.EMAIL_PORT || '587',
        user: process.env.EMAIL_USER ? 'Set' : 'Not set',
        password: process.env.EMAIL_PASSWORD ? 'Set' : 'Not set',
        from: process.env.EMAIL_FROM || 'Not set',
        adminEmail: process.env.ADMIN_EMAIL || 'Not set'
      }
    });
  } catch (error) {
    console.error('Direct SMTP test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Direct SMTP test failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack,
      environmentInfo: {
        host: process.env.EMAIL_HOST || 'Not set',
        port: process.env.EMAIL_PORT || '587',
        user: process.env.EMAIL_USER ? 'Set' : 'Not set',
        password: process.env.EMAIL_PASSWORD ? 'Set' : 'Not set',
        from: process.env.EMAIL_FROM || 'Not set',
        adminEmail: process.env.ADMIN_EMAIL || 'Not set'
      }
    });
  }
});

module.exports = router;
