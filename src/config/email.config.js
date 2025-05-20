const nodemailer = require('nodemailer');

// Create a transporter object
let transporter;

// Create a console transport for development
function createConsoleTransport() {
  return {
    sendMail: (mailOptions) => {
      console.log('\n==================================');
      console.log('📧 EMAIL SENT (Development Mode)');
      console.log('==================================');
      console.log(`From: ${mailOptions.from}`);
      console.log(`To: ${mailOptions.to}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log('----------------------------------');
      console.log('Text content:');
      console.log(mailOptions.text || '(No text content)');
      console.log('----------------------------------');
      console.log('HTML content preview:');
      if (mailOptions.html) {
        // Just show a preview of the HTML content
        const htmlPreview = mailOptions.html.substring(0, 150) + '...';
        console.log(htmlPreview);
      } else {
        console.log('(No HTML content)');
      }
      console.log('==================================\n');
      
      // Return a successful response
      return Promise.resolve({
        messageId: `dev-${Date.now()}@localhost`,
        response: 'Development mode - email logged to console'
      });
    }
  };
}

// Initialize the transporter based on environment
function initializeTransporter() {
  // Force development mode if running locally, unless explicitly set to production
  const isProduction = process.env.NODE_ENV === 'production' && 
                      process.env.FORCE_EMAIL_PRODUCTION === 'true';
  
  if (isProduction) {
    try {
      // AWS SES or other production email configuration
      console.log('Initializing production email transport');
      transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,   // 10 seconds
      });
      
      console.log('Email transport initialized for production');
    } catch (error) {
      console.error('Failed to initialize production email transport:', error);
      console.log('Falling back to console transport');
      transporter = createConsoleTransport();
    }
  } else {
    // Development email configuration (console transport)
    console.log('Initializing development email transport (console mode)');
    transporter = createConsoleTransport();
  }
}

// Initialize the transporter immediately
initializeTransporter();

// Wrapper function to ensure transporter is initialized
const sendMail = async (mailOptions) => {
  // Make sure we have a transporter
  if (!transporter) {
    initializeTransporter();
  }
  
  // Add text version if only HTML is provided
  if (mailOptions.html && !mailOptions.text) {
    // Simple HTML to text conversion
    mailOptions.text = mailOptions.html
      .replace(/<[^>]*>/g, '')  // Remove HTML tags
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  }
  
  // Send the email
  return transporter.sendMail(mailOptions);
};

module.exports = { sendMail };
