# Email Notification System Documentation

## Overview

The Ice Deluxe Wears e-commerce platform includes a comprehensive email notification system that keeps customers informed throughout their shopping journey and provides administrators with important updates about store operations.

## Email Types

### Customer Emails

1. **Welcome Email**
   - Sent when a new user registers
   - Contains account activation information and welcome message

2. **Order Confirmation Email**
   - Sent immediately after an order is placed
   - Includes order summary, items purchased, pricing, and shipping details

3. **Shipping Confirmation Email**
   - Sent when an order's status is updated to "shipped"
   - Includes tracking information, courier details, and estimated delivery date

4. **Delivery Confirmation Email**
   - Sent when an order's status is updated to "delivered"
   - Includes order summary and requests product reviews/feedback

5. **Order Status Update Email**
   - Sent when an order status changes (processing, cancelled, etc.)
   - Provides details about the status change and next steps

6. **Abandoned Cart Recovery Email**
   - Sent 24 hours after a user adds items to cart but doesn't complete checkout
   - Reminds users of items in their cart and encourages purchase completion

### Admin Emails

1. **New Order Notification**
   - Sent to admin when a new order is placed
   - Includes complete order details, customer information, and payment status

2. **Failed Payment Alert**
   - Sent when a payment attempt fails
   - Includes order details, customer information, and error message

3. **Low Stock Alert**
   - Sent when product inventory falls below the configured threshold
   - Helps prevent stockouts by prompting inventory replenishment

4. **Daily Order Summary**
   - Sent at the end of each day
   - Provides overview of orders received, total revenue, and order statuses

5. **Weekly Order Summary**
   - Sent at the end of each week (Sunday)
   - Provides weekly sales summary and top-selling products

## Configuration

The email notification system is configured through environment variables:

```
EMAIL_HOST=mail.privateemail.com
EMAIL_PORT=587
EMAIL_USER=your_email@icedeluxewears.com
EMAIL_PASSWORD=your_email_password
EMAIL_FROM=orders@icedeluxewears.com
EMAIL_FROM_NAME=Ice Deluxe Wears
ADMIN_EMAIL=admin@icedeluxewears.com
FORCE_EMAIL_PRODUCTION=false
ENABLE_EMAIL_SCHEDULER=true
LOW_STOCK_THRESHOLD=5
```

### Environment Variables

- `EMAIL_HOST`: SMTP server hostname
- `EMAIL_PORT`: SMTP server port (typically 587 for TLS or 465 for SSL)
- `EMAIL_USER`: Email account username/address
- `EMAIL_PASSWORD`: Email account password
- `EMAIL_FROM`: Sender email address shown to recipients
- `EMAIL_FROM_NAME`: Sender name shown to recipients
- `ADMIN_EMAIL`: Administrator email to receive notifications
- `FORCE_EMAIL_PRODUCTION`: When true, forces production email mode even in development
- `ENABLE_EMAIL_SCHEDULER`: Enables/disables automated email scheduling
- `LOW_STOCK_THRESHOLD`: Product quantity threshold for low stock alerts

## Email Scheduler

The system includes an automated email scheduler that runs the following tasks:

1. **Abandoned Cart Recovery**: Daily at 10:00 AM
   - Finds carts with items that haven't been updated in 24-72 hours
   - Sends reminder emails to users

2. **Daily Order Summary**: Daily at 11:59 PM
   - Compiles all orders from the current day
   - Sends summary to admin

3. **Weekly Order Summary**: Sunday at 11:59 PM
   - Compiles all orders from the past week
   - Sends summary to admin

4. **Low Stock Check**: Every 6 hours
   - Checks for products with stock below the threshold
   - Sends alerts to admin for each low-stock product

## Implementation Details

### Email Transport

The system uses Nodemailer with the following configuration:

- Production mode: Uses configured SMTP server
- Development mode: Uses console transport (logs emails to console)

### Email Templates

All emails use responsive HTML templates with inline CSS for maximum compatibility across email clients. Templates include:

- Ice Deluxe Wears branding
- Clear call-to-action buttons
- Mobile-responsive design
- Plain text alternatives for email clients that don't support HTML

### Error Handling

The email system includes robust error handling:

- Email sending failures are logged but don't block critical operations
- Failed emails don't prevent order processing or status updates
- Automatic fallback to console transport if SMTP configuration fails

## Integration Points

The email notification system is integrated at key points in the customer journey:

1. **User Registration**: Welcome email
2. **Order Creation**: Order confirmation email + admin notification
3. **Payment Verification**: Payment success/failure notifications
4. **Order Status Updates**: Status-specific emails based on the new status
5. **Shipping/Delivery**: Tracking information and delivery confirmation
6. **Abandoned Cart**: Automated follow-up for incomplete purchases

## Adding New Email Types

To add a new email type:

1. Create a new email template function in the appropriate utility file
2. Integrate the function at the relevant point in the application flow
3. Add appropriate error handling and logging
4. Test thoroughly in development mode before enabling in production

## Testing Email Configuration

Use the `test-email-config.js` script to verify your email configuration:

```bash
node src/test-email-config.js
```

This interactive script will:
- Test SMTP connection
- Send a test email
- Provide detailed troubleshooting guidance if issues occur
