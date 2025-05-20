const AWS = require('aws-sdk');
require('dotenv').config();

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'eu-north-1'
});

// Create S3 instance
const s3 = new AWS.S3();

async function checkBucketConfiguration() {
  const bucketName = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || 'banksstorage';
  
  try {
    console.log(`Checking configuration for bucket: ${bucketName}`);
    
    // Check bucket CORS configuration
    const corsConfig = await s3.getBucketCors({ Bucket: bucketName }).promise()
      .catch(err => {
        if (err.code === 'NoSuchCORSConfiguration') {
          console.log('No CORS configuration found. Setting up CORS...');
          return null;
        }
        throw err;
      });
    
    if (!corsConfig) {
      // Set up CORS configuration
      await s3.putBucketCors({
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
              AllowedOrigins: ['*'],  // In production, you should restrict this to your domain
              ExposeHeaders: ['ETag']
            }
          ]
        }
      }).promise();
      console.log('u2705 CORS configuration updated successfully');
    } else {
      console.log('u2705 CORS is already configured');
    }
    
    // Generate a test pre-signed URL
    const testKey = 'products/test-image.jpg';
    const signedUrl = s3.getSignedUrl('getObject', {
      Bucket: bucketName,
      Key: testKey,
      Expires: 60  // URL expires in 60 seconds
    });
    
    console.log('\nTest pre-signed URL generated successfully!');
    console.log('This URL will work even if the object does not exist, but it confirms your credentials can generate valid pre-signed URLs.');
    console.log(`URL: ${signedUrl}`);
    console.log('\nNote: This URL will expire in 60 seconds.');
    
    // Provide instructions for frontend
    console.log('\n--- IMPLEMENTATION NOTES ---');
    console.log('1. Your backend is now configured to automatically convert S3 URLs to pre-signed URLs');
    console.log('2. Pre-signed URLs expire after 1 hour by default');
    console.log('3. Your frontend should handle image loading errors gracefully');
    console.log('4. If images still fail to load, check your network tab for the exact error');
    
  } catch (error) {
    console.error('Error checking/updating bucket configuration:', error);
  }
}

checkBucketConfiguration();
