const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'E-commerce API Documentation',
      version: '1.0.0',
      description: 'API documentation for the E-commerce platform',
    },
    servers: [
      {
        url: 'https://api.icedeluxewears.com/api',
        description: 'Production server',
      },
      {
        url: 'http://localhost:5000/api',
        description: 'Local Development server',
      },
      
      {
        url: 'http://16.170.229.92:5000/api',
        description: 'EC2 Development server',
      },
      
      
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.js'] // Path to the API routes
};

module.exports = swaggerJsdoc(options);