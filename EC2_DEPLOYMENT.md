# EC2 Deployment Guide for E-commerce API

## Prerequisites
- AWS Account
- SSH Client (PuTTY for Windows or Terminal for Mac/Linux)
- Node.js project files

## Step 1: Launch EC2 Instance
1. Go to AWS Console > EC2 Dashboard
2. Click "Launch Instance"
3. Configure instance:
   - Name: ecommerce-api
   - AMI: Ubuntu Server 22.04 LTS
   - Instance type: t2.micro (free tier)
   - Key pair: Create new key pair
   - Security group settings:
     - Allow SSH (Port 22)
     - Allow HTTP (Port 80)
     - Allow HTTPS (Port 443)

## Step 2: Connect to EC2 Instance
1. Download and save your key pair (.pem file)
2. Convert permissions: `chmod 400 your-key.pem` (Mac/Linux)
3. Connect using SSH:
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-public-dns
   ```

## Step 3: Install Required Software
```bash
# Update package list
sudo apt update
sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -y pm2 -g

# Install Nginx
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Step 4: Clone and Setup Application
```bash
# Create app directory
mkdir ~/app
cd ~/app

# Clone your repository (replace with your repo URL)
git clone your-repository-url .

# Install dependencies
npm install

# Create .env file
cat > .env << EOL
PORT=5000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
NODE_ENV=production
EOL
```

## Step 5: Configure Nginx as Reverse Proxy
```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/ecommerce-api
```

Add the following configuration:
```nginx
server {
    listen 80;
    server_name your_domain_or_ip;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the configuration:
```bash
sudo ln -s /etc/nginx/sites-available/ecommerce-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 6: Start Application with PM2
```bash
cd ~/app
pm2 start src/index.js --name "ecommerce-api"
pm2 startup
pm2 save
```

## Step 7: SSL Configuration (Optional)
```bash
# Install Certbot
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot

# Get SSL certificate
sudo certbot --nginx -d your_domain
```

## Step 8: Update Swagger Configuration
Update the servers array in src/swagger.js to include your EC2 domain:
```javascript
servers: [
  {
    url: 'http://your-ec2-domain/api',
    description: 'Production server',
  }
]
```

## Monitoring and Maintenance
- View logs: `pm2 logs`
- Monitor app: `pm2 monit`
- Restart app: `pm2 restart ecommerce-api`
- View status: `pm2 status`

## Security Best Practices
1. Keep your system updated: `sudo apt update && sudo apt upgrade`
2. Configure UFW firewall:
   ```bash
   sudo ufw allow ssh
   sudo ufw allow http
   sudo ufw allow https
   sudo ufw enable
   ```
3. Regularly monitor logs for suspicious activity
4. Keep Node.js and npm packages updated
5. Use environment variables for sensitive data
6. Implement rate limiting and security headers

## Troubleshooting
1. Check application logs: `pm2 logs`
2. Check Nginx logs:
   - Access log: `sudo tail -f /var/log/nginx/access.log`
   - Error log: `sudo tail -f /var/log/nginx/error.log`
3. Check Node.js process: `pm2 list`
4. Verify Nginx configuration: `sudo nginx -t`
5. Check firewall status: `sudo ufw status`