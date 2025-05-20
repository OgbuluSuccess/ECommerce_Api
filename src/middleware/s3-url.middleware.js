const { getSignedUrl } = require('../config/s3.config');

/**
 * Middleware to transform S3 URLs in product data to pre-signed URLs
 * This solves the S3 Access Denied issue by generating temporary access URLs
 */
const transformS3Urls = async (req, res, next) => {
  // Store the original json function
  const originalJson = res.json;

  // Override the json function
  res.json = async function(data) {
    try {
      // Process single product
      if (data && data.data && data.data.images && Array.isArray(data.data.images)) {
        await processProductImages(data.data);
        console.log('Transformed single product images');
      }
      
      // Process product arrays
      if (data && data.data && Array.isArray(data.data)) {
        let hasImages = false;
        for (const product of data.data) {
          if (product && product.images && Array.isArray(product.images)) {
            await processProductImages(product);
            hasImages = true;
          }
        }
        if (hasImages) {
          console.log('Transformed product array images');
        }
      }
    } catch (error) {
      console.error('Error transforming S3 URLs:', error);
      // Continue with original response if there's an error
    }
    
    // Call the original json function
    return originalJson.call(this, data);
  };
  
  // Also override the send function for cases where json() isn't used directly
  const originalSend = res.send;
  res.send = async function(body) {
    try {
      // Only process JSON responses
      const contentType = res.getHeader('content-type');
      if (contentType && contentType.includes('application/json') && typeof body === 'string') {
        let data = JSON.parse(body);
        
        // Process single product
        if (data.data && data.data.images && Array.isArray(data.data.images)) {
          await processProductImages(data.data);
          console.log('Transformed single product images via send');
        }
        
        // Process product arrays
        if (data.data && Array.isArray(data.data)) {
          let hasImages = false;
          for (const product of data.data) {
            if (product && product.images && Array.isArray(product.images)) {
              await processProductImages(product);
              hasImages = true;
            }
          }
          if (hasImages) {
            console.log('Transformed product array images via send');
          }
        }
        
        // Convert back to string
        body = JSON.stringify(data);
      }
    } catch (error) {
      console.error('Error transforming S3 URLs in send:', error);
      // Continue with original response if there's an error
    }
    
    // Call the original send function
    return originalSend.call(this, body);
  };
  
  next();
};

/**
 * Helper function to process product images and generate pre-signed URLs
 */
async function processProductImages(product) {
  if (!product.images || !Array.isArray(product.images)) return;
  
  for (const image of product.images) {
    if (image.key) {
      try {
        // Generate a pre-signed URL with 1 hour expiration
        const signedUrl = await getSignedUrl(image.key, 3600);
        // Replace the original URL with the signed URL
        image.url = signedUrl;
        console.log(`Generated signed URL for ${image.key}`);
      } catch (error) {
        console.error(`Error generating signed URL for ${image.key}:`, error);
      }
    }
  }
}

module.exports = transformS3Urls;
