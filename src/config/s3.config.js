const AWS = require('aws-sdk');

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'eu-north-1'
});

// Create S3 instance with explicit endpoint
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'eu-north-1',
  signatureVersion: 'v4',
  endpoint: `https://s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com`
});

// Upload file to S3
const uploadFile = async (file, key) => {
  const bucketName = process.env.S3_BUCKET || 'banksstorage';
  
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  };

  try {
    console.log(`Attempting to upload to bucket: ${bucketName} in region: ${AWS.config.region}`);
    const result = await s3.upload(params).promise();
    console.log(`Upload successful: ${result.Location}`);
    return result.Location;
  } catch (error) {
    console.error('S3 Upload Error Details:', JSON.stringify(error, null, 2));
    throw new Error(`Error uploading file to S3: ${error.message}`);
  }
};

// Generate a pre-signed URL for an S3 object
const getSignedUrl = async (key, expiresIn = 3600) => {
  const bucketName = process.env.S3_BUCKET || 'banksstorage';
  
  const params = {
    Bucket: bucketName,
    Key: key,
    Expires: expiresIn // URL expiration time in seconds (default: 1 hour)
  };

  try {
    const url = s3.getSignedUrl('getObject', params);
    return url;
  } catch (error) {
    console.error('S3 SignedURL Error Details:', JSON.stringify(error, null, 2));
    throw new Error(`Error generating signed URL: ${error.message}`);
  }
};

// Delete file from S3
const deleteFile = async (key) => {
  const bucketName = process.env.S3_BUCKET || 'banksstorage';
  
  const params = {
    Bucket: bucketName,
    Key: key
  };

  try {
    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    console.error('S3 Delete Error Details:', JSON.stringify(error, null, 2));
    throw new Error(`Error deleting file from S3: ${error.message}`);
  }
};

module.exports = {
  uploadFile,
  deleteFile,
  getSignedUrl
};