const Paystack = require('paystack-node');

// Initialize Paystack with your secret key
const paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY, process.env.NODE_ENV);

// Create a wrapper with the expected API structure
module.exports = {
  transaction: {
    initialize: async (data) => {
      try {
        console.log('Initializing Paystack transaction with:', {
          reference: data.reference,
          amount: data.amount,
          email: data.email,
          callback_url: data.callback_url,
          metadata: typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata)
        });
        
        const response = await paystack.initializeTransaction({
          reference: data.reference,
          amount: data.amount,
          email: data.email,
          metadata: typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata),
          callback_url: data.callback_url
        });
        
        if (!response || !response.body || !response.body.data || !response.body.data.authorization_url) {
          console.error('Invalid Paystack response:', response);
          throw new Error('Invalid response from Paystack');
        }
        
        console.log('Paystack initialization response:', response.body);
        return response.body;
      } catch (error) {
        console.error('Paystack initialization error:', {
          message: error.message,
          stack: error.stack,
          data: error.response?.data,
          code: error.response?.status,
          requestData: error.config?.data
        });
        
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Payment initialization failed';
        
        throw new Error(`Paystack Error: ${errorMessage}`);

      }
    },
    verify: async (reference) => {
      try {
        const response = await paystack.verifyTransaction({
          reference
        });
        console.log('Paystack verify response:', response.body);
        return response.body;
      } catch (error) {
        console.error('Paystack verification error:', error);
        return {
          status: false,
          message: error.message || 'Payment verification failed'
        };
      }
    }
  }
};
