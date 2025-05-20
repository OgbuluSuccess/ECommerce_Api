const AWS = require('aws-sdk');

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

// Create S3 instance
const s3 = new AWS.S3();

// Upload file to S3
const uploadFile = async (file, key) => {
  const params = {
    Bucket: process.env.S3_BUCKET || process.env.AWS_S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    // Make objects publicly readable
    ACL: 'public-read'
  };

  try {
    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (error) {
    throw new Error(`Error uploading file to S3: ${error.message}`);
  }
};

// Generate a pre-signed URL for an S3 object
const getSignedUrl = async (key, expiresIn = 3600) => {
  // Ensure we have a bucket name
  const bucketName = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || 'banksstorage';
  
  const params = {
    Bucket: bucketName,
    Key: key,
    Expires: expiresIn // URL expiration time in seconds (default: 1 hour)
  };

  try {
    // Use the synchronous version since AWS SDK v2's getSignedUrlPromise can be inconsistent
    const url = s3.getSignedUrl('getObject', params);
    return url;
  } catch (error) {
    throw new Error(`Error generating signed URL: ${error.message}`);
  }
};

// Delete file from S3
const deleteFile = async (key) => {
  const params = {
    Bucket: process.env.S3_BUCKET || process.env.AWS_S3_BUCKET,
    Key: key
  };

  try {
    await s3.deleteObject(params).promise();
  } catch (error) {
    throw new Error(`Error deleting file from S3: ${error.message}`);
  }
};

module.exports = {
  uploadFile,
  deleteFile,
  getSignedUrl
};