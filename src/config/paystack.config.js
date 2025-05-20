const Paystack = require('paystack-node');

// Initialize Paystack with your secret key
const paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY, process.env.NODE_ENV);

module.exports = paystack;
