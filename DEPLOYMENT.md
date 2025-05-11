# AWS Elastic Beanstalk Deployment Guide

## Prerequisites
1. Install AWS CLI
2. Install AWS Elastic Beanstalk CLI (eb cli)
3. AWS Account with Free Tier access

## Setup AWS Credentials
1. Create an IAM user with appropriate permissions
2. Configure AWS credentials locally:
```bash
aws configure
```

## Environment Variables Setup
Create these environment variables in AWS Elastic Beanstalk environment:
- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: Your JWT secret key
- `JWT_EXPIRES_IN`: JWT expiration time
- `NODE_ENV`: Set to 'production'

## Deployment Steps

1. Initialize EB CLI (already done):
```bash
eb init
```

2. Create Elastic Beanstalk environment:
```bash
eb create ecommerce-api-env
```

3. Deploy your application:
```bash
eb deploy
```

4. Open the deployed application:
```bash
eb open
```

## Important Notes
- The application is configured to run on Node.js 18
- Default region is set to us-east-1
- Make sure to update the Swagger server URL after deployment
- Monitor the application through AWS CloudWatch
- Set up proper security groups and VPC settings in AWS console

## Troubleshooting
- Check logs: `eb logs`
- SSH into instance: `eb ssh`
- View status: `eb status`

## Security Considerations
1. Never commit .env file to version control
2. Use AWS Parameter Store for sensitive data
3. Enable HTTPS/SSL
4. Configure proper CORS settings
5. Set up proper IAM roles and policies