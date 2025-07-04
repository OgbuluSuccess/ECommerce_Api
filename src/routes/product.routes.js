const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/product.model');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const uploadMiddleware = require('../middleware/upload.middleware');
const { uploadFile, deleteFile, getSignedUrl } = require('../config/s3.config');
const transformS3Urls = require('../middleware/s3-url.middleware');

// Use the raw upload for backward compatibility with existing routes
const upload = uploadMiddleware.raw;

// Apply S3 URL transformation middleware to all routes
router.use(transformS3Urls);

/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Category ID
 *         name:
 *           type: string
 *           description: Category name
 *         description:
 *           type: string
 *           description: Category description
 *         slug:
 *           type: string
 *           description: URL-friendly category name
 *         parent:
 *           type: string
 *           description: Parent category ID (null for top-level categories)
 *     ProductVariant:
 *       type: object
 *       properties:
 *         color:
 *           type: string
 *           description: Color variant
 *         size:
 *           type: string
 *           description: Size variant
 *         price:
 *           type: number
 *           description: Variant-specific price (optional, falls back to product price)
 *         stock:
 *           type: number
 *           description: Variant-specific stock quantity
 *         sku:
 *           type: string
 *           description: Variant-specific SKU
 *         image:
 *           type: string
 *           description: Variant-specific image URL
 *     Product:
 *       type: object
 *       required:
 *         - name
 *         - price
 *         - description
 *         - category
 *         - stock
 *       properties:
 *         name:
 *           type: string
 *           description: Product name
 *         price:
 *           type: number
 *           description: Base product price
 *         description:
 *           type: string
 *           description: Product description
 *         category:
 *           $ref: '#/components/schemas/Category'
 *           description: Product category object
 *         stock:
 *           type: number
 *           description: Base product stock (for non-variant products)
 *         sku:
 *           type: string
 *           description: Product SKU
 *         availableColors:
 *           type: array
 *           items:
 *             type: string
 *           description: List of available color options
 *         availableSizes:
 *           type: array
 *           items:
 *             type: string
 *           description: List of available size options
 *         variants:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductVariant'
 *           description: Array of product variants with color, size, price, stock, and image
 *         images:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 description: Image URL
 *               key:
 *                 type: string
 *                 description: S3 key for the image
 *           description: Product images
 *         ratings:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               user:
 *                 type: string
 *                 description: User ID who rated the product
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Rating value (1-5)
 *               review:
 *                 type: string
 *                 description: Review text
 *           description: Product ratings and reviews
 */

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Get all products
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort criteria
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *     responses:
 *       200:
 *         description: List of products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 results:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                   description: Total number of products matching the criteria
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *   post:
 *     summary: Create a new product with variants
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - description
 *               - category
 *               - stock
 *             properties:
 *               name:
 *                 type: string
 *                 description: Product name
 *               price:
 *                 type: number
 *                 description: Base product price
 *               description:
 *                 type: string
 *                 description: Product description
 *               category:
 *                 type: string
 *                 description: Category ID
 *               stock:
 *                 type: number
 *                 description: Base stock quantity
 *               sku:
 *                 type: string
 *                 description: Product SKU (auto-generated if not provided)
 *               availableColors:
 *                 type: string
 *                 description: Comma-separated list of colors (e.g. "Red,Blue,Green")
 *               availableSizes:
 *                 type: string
 *                 description: Comma-separated list of sizes (e.g. "S,M,L,XL")
 *               variants:
 *                 type: string
 *                 description: JSON string array of variant objects
 *                 example: "[{\"color\":\"Red\",\"size\":\"M\",\"price\":1999,\"stock\":10,\"sku\":\"RED-M-123\"}]"
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Admin access required
 */

/**
 * @swagger
 * /products/all:
 *   get:
 *     summary: Get all products without filtering
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: List of all products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 */

// Get all products without any filtering
router.get('/all', getAllProducts);

// Also handle the case with the duplicated /api prefix for this specific endpoint
router.get('/api/products/all', getAllProducts);

// Function to get all products
async function getAllProducts(req, res) {
  try {
    const products = await Product.find().populate({
      path: 'category',
      select: 'name description slug parent'
    });
    
    // Process product images to generate pre-signed URLs
    for (const product of products) {
      if (product.images && product.images.length > 0) {
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
    }
    
    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

// Get all products with advanced filtering, sorting, and pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = '-createdAt',
      fields,
      search,
      category,
      minPrice,
      maxPrice,
      brand,
      status,
      featured,
      minRating,
      tags,
      inStock
    } = req.query;

    const pipeline = [];

    // Search by name or description
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { tags: { $in: [new RegExp(search, 'i')] } }
          ]
        }
      });
    }

    // Category filter
    if (category) {
      pipeline.push({ $match: { category: new mongoose.Types.ObjectId(category) } });
    }

    // Price range filter
    if (minPrice || maxPrice) {
      const priceFilter = {};
      if (minPrice) priceFilter.$gte = Number(minPrice);
      if (maxPrice) priceFilter.$lte = Number(maxPrice);
      pipeline.push({ $match: { price: priceFilter } });
    }

    // Brand filter
    if (brand) {
      pipeline.push({ $match: { brand: { $regex: brand, $options: 'i' } } });
    }

    // Status filter
    if (status) {
      pipeline.push({ $match: { status } });
    }

    // Featured filter
    if (featured) {
      pipeline.push({ $match: { featured: featured === 'true' } });
    }

    // Rating filter
    if (minRating) {
      pipeline.push({ $match: { averageRating: { $gte: Number(minRating) } } });
    }

    // Tags filter
    if (tags) {
      const tagArray = tags.split(',');
      pipeline.push({ $match: { tags: { $in: tagArray } } });
    }

    // Stock filter
    if (inStock === 'true') {
      pipeline.push({ $match: { stock: { $gt: 0 } } });
    }

    // Get total count before pagination
    const countPipeline = [...pipeline];
    countPipeline.push({ $count: 'total' });
    const [countResult] = await Product.aggregate(countPipeline);
    const total = countResult ? countResult.total : 0;

    // Sorting
    const sortFields = sort.split(',').reduce((acc, field) => {
      const order = field.startsWith('-') ? -1 : 1;
      const fieldName = field.startsWith('-') ? field.slice(1) : field;
      acc[fieldName] = order;
      return acc;
    }, {});
    pipeline.push({ $sort: sortFields });

    // Pagination - only apply if explicitly requested in query params
    if (req.query.page || req.query.limit) {
      const skip = (Number(page) - 1) * Number(limit);
      pipeline.push({ $skip: skip }, { $limit: Number(limit) });
    }

    // Add lookup stage to populate category details
    pipeline.push({
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'category'
      }
    });

    // Unwind category array to object
    pipeline.push({
      $unwind: {
        path: '$category',
        preserveNullAndEmptyArrays: true
      }
    });

    // Field selection
    if (fields) {
      const fieldToInclude = fields.split(',').reduce((acc, field) => {
        acc[field] = 1;
        return acc;
      }, {});
      pipeline.push({ $project: fieldToInclude });
    }

    const products = await Product.aggregate(pipeline);

    // Process product images to generate pre-signed URLs
    for (const product of products) {
      if (product.images && product.images.length > 0) {
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
    }

    res.status(200).json({
      success: true,
      results: products.length,
      total,
      data: products
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Get a product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 */
/**
 * @swagger
 * /products/{id}:
 *   patch:
 *     summary: Update a product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               stock:
 *                 type: number
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Product updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Product not found
 *   delete:
 *     summary: Delete a product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Product not found
 */

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('ratings.user', 'name')
      .populate('category');
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Process product images to generate pre-signed URLs
    if (product.images && product.images.length > 0) {
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

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Maximum products allowed per category
const MAX_PRODUCTS_PER_CATEGORY = 1000; // Adjust this value as needed

router.post('/', protect, restrictTo('admin', 'superadmin'), uploadMiddleware.handleUpload, async (req, res) => {
  try {
    const productData = req.body;
    productData.images = [];

    // Check if category exists and has not reached product limit
    const categoryProductCount = await Product.countDocuments({ category: productData.category });
    if (categoryProductCount >= MAX_PRODUCTS_PER_CATEGORY) {
      return res.status(400).json({
        success: false,
        message: `Cannot add more products to this category. Maximum limit of ${MAX_PRODUCTS_PER_CATEGORY} products reached.`
      });
    }

    // Add required fields if not provided
    productData.createdBy = req.user.id; // Add the current user as creator
    
    // Generate SKU if not provided
    if (!productData.sku) {
      // Create a unique SKU based on product name and timestamp
      const timestamp = Date.now().toString().slice(-6);
      const namePrefix = productData.name ? productData.name.slice(0, 3).toUpperCase() : 'PRD';
      productData.sku = `${namePrefix}-${timestamp}`;
    }
    
    // Set default brand if not provided
    if (!productData.brand) {
      productData.brand = 'Ice Deluxe'; // Default brand name
    }

    // Process variants data - ensure availableColors and availableSizes are arrays
    if (productData.availableColors && typeof productData.availableColors === 'string') {
      // Convert comma-separated string to array
      productData.availableColors = productData.availableColors.split(',').map(color => color.trim()).filter(Boolean);
    } else if (!Array.isArray(productData.availableColors)) {
      productData.availableColors = [];
    }

    if (productData.availableSizes && typeof productData.availableSizes === 'string') {
      // Convert comma-separated string to array
      productData.availableSizes = productData.availableSizes.split(',').map(size => size.trim()).filter(Boolean);
    } else if (!Array.isArray(productData.availableSizes)) {
      productData.availableSizes = [];
    }
    
    // Initialize empty variantMatrix if not present
    if (!productData.variantMatrix) {
      productData.variantMatrix = new Map();
    }

    // Initialize variant matrix if variants are provided
    if (productData.variants) {
      try {
        // Parse JSON string to array of variant objects
        const variantsArray = JSON.parse(productData.variants);
        
        // Create product first without variants
        delete productData.variants;
        
        // Upload images to S3
        if (req.files && req.files.length > 0) {
          for (const file of req.files) {
            const key = `products/${Date.now()}-${file.originalname}`;
            const imageUrl = await uploadFile(file, key);
            productData.images.push({ url: imageUrl, key: key });
          }
        }

        // Create the product
        const product = await Product.create(productData);

        // Add variants to the product after it's created
        if (variantsArray && Array.isArray(variantsArray) && variantsArray.length > 0) {
          // Ensure product.availableColors and product.availableSizes are arrays
          if (!product.availableColors) product.availableColors = [];
          if (!product.availableSizes) product.availableSizes = [];
          
          for (const variant of variantsArray) {
            if (variant.color && variant.size) {
              // Add color and size to available arrays if not already present
              if (!product.availableColors.includes(variant.color)) {
                product.availableColors.push(variant.color);
              }
              if (!product.availableSizes.includes(variant.size)) {
                product.availableSizes.push(variant.size);
              }
              
              // Create variant key as color:size
              const variantKey = `${variant.color}:${variant.size}`;
              
              // Generate variant-specific SKU if not provided
              if (!variant.sku) {
                variant.sku = `${product.sku}-${variant.color.slice(0, 2).toUpperCase()}-${variant.size}`;
              }
              
              // Set variant in product's variantMatrix
              product.setVariant(variantKey, {
                price: variant.price || product.price,
                stock: variant.stock || 0,
                sku: variant.sku,
                image: variant.image || (product.images.length > 0 ? product.images[0].url : '')
              });
            }
          }
          await product.save();
        }
        
        // Process product images to generate pre-signed URLs
        if (product.images && product.images.length > 0) {
          for (const image of product.images) {
            if (image.key) {
              try {
                // Generate a pre-signed URL with 1 hour expiration
                const signedUrl = await getSignedUrl(image.key, 3600);
                // Replace the original URL with the signed URL
                image.url = signedUrl;
              } catch (error) {
                console.error(`Error generating signed URL for ${image.key}:`, error);
              }
            }
          }
        }
        
        return res.status(201).json({
          success: true,
          data: product
        });
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Error processing variants: ${error.message}`
        });
      }
    } else {
      // No variants, proceed with regular product creation
      
      // Upload images to S3
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const key = `products/${Date.now()}-${file.originalname}`;
          const imageUrl = await uploadFile(file, key);
          productData.images.push({ url: imageUrl, key: key });
        }
      }

      const product = await Product.create(productData);
      
      // Process product images to generate pre-signed URLs
      if (product.images && product.images.length > 0) {
        for (const image of product.images) {
          if (image.key) {
            try {
              // Generate a pre-signed URL with 1 hour expiration
              const signedUrl = await getSignedUrl(image.key, 3600);
              // Replace the original URL with the signed URL
              image.url = signedUrl;
            } catch (error) {
              console.error(`Error generating signed URL for ${image.key}:`, error);
            }
          }
        }
      }
      
      res.status(201).json({
        success: true,
        data: product
      });
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /products/{id}:
 *   patch:
 *     summary: Update a product with variant support
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Product name
 *               price:
 *                 type: number
 *                 description: Base product price
 *               description:
 *                 type: string
 *                 description: Product description
 *               category:
 *                 type: string
 *                 description: Category ID
 *               stock:
 *                 type: number
 *                 description: Base stock quantity
 *               sku:
 *                 type: string
 *                 description: Product SKU
 *               availableColors:
 *                 type: string
 *                 description: Comma-separated list of colors (e.g. "Red,Blue,Green")
 *               availableSizes:
 *                 type: string
 *                 description: Comma-separated list of sizes (e.g. "S,M,L,XL")
 *               variants:
 *                 type: string
 *                 description: JSON string array of variant objects
 *                 example: "[{\"color\":\"Red\",\"size\":\"M\",\"price\":1999,\"stock\":10,\"sku\":\"RED-M-123\"}]"
 *               clearVariants:
 *                 type: boolean
 *                 description: If true, clears all existing variants before adding new ones
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Product images
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       404:
 *         description: Product not found
 */
router.patch('/:id', protect, restrictTo('admin', 'superadmin'), uploadMiddleware.handleUpload, async (req, res) => {
  try {
    // First find the existing product
    const existingProduct = await Product.findById(req.params.id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const productData = req.body;
    
    // Validate and clean up category field
    if (productData.category) {
      // If category is 'string' or empty, remove it from the update data
      if (productData.category === 'string' || productData.category === '') {
        delete productData.category;
      } else {
        // Try to validate if it's a valid ObjectId
        try {
          new mongoose.Types.ObjectId(productData.category);
        } catch (error) {
          // If not a valid ObjectId, remove it from the update data
          delete productData.category;
        }
      }
    }
    
    // Process variants related fields
    // Handle availableColors
    if (productData.availableColors) {
      if (productData.availableColors === 'string' || productData.availableColors === '') {
        delete productData.availableColors;
      } else {
        // Convert comma-separated string to array
        productData.availableColors = productData.availableColors.split(',').map(color => color.trim());
      }
    }
    
    // Handle availableSizes
    if (productData.availableSizes) {
      if (productData.availableSizes === 'string' || productData.availableSizes === '') {
        delete productData.availableSizes;
      } else {
        // Convert comma-separated string to array
        productData.availableSizes = productData.availableSizes.split(',').map(size => size.trim());
      }
    }
    
    // Handle image uploads if any
    if (req.files && req.files.length > 0) {
      // Initialize images array if it doesn't exist in the update data
      if (!productData.images) {
        productData.images = [...existingProduct.images]; // Keep existing images
      }
      
      // Upload new images to S3
      for (const file of req.files) {
        const key = `products/${Date.now()}-${file.originalname}`;
        const imageUrl = await uploadFile(file, key);
        productData.images.push({ url: imageUrl, key: key });
      }
    }
    
    // Handle images field if it's a string literal 'string'
    if (productData.images === 'string') {
      delete productData.images;
    }

    // Handle variants
    if (productData.variants) {
      try {
        // Parse JSON string to array of variant objects
        const variantsArray = JSON.parse(productData.variants);
        
        // Remove variants from productData as we'll handle them separately
        delete productData.variants;
        
        // Update the product with non-variant data first
        const updatedProduct = await Product.findByIdAndUpdate(
          req.params.id,
          productData,
          { new: true, runValidators: true }
        );
        
        // Clear existing variants if requested
        if (productData.clearVariants === 'true' || productData.clearVariants === true) {
          // Clear variant matrix
          updatedProduct.variantMatrix = new Map();
          // Keep the updated colors and sizes from productData, or clear them if not provided
          updatedProduct.availableColors = productData.availableColors || [];
          updatedProduct.availableSizes = productData.availableSizes || [];
        }
        
        // Add new variants
        if (variantsArray && Array.isArray(variantsArray) && variantsArray.length > 0) {
          for (const variant of variantsArray) {
            if (variant.color && variant.size) {
              // Add color and size to available arrays if not already present
              if (!updatedProduct.availableColors.includes(variant.color)) {
                updatedProduct.availableColors.push(variant.color);
              }
              if (!updatedProduct.availableSizes.includes(variant.size)) {
                updatedProduct.availableSizes.push(variant.size);
              }
              
              // Create variant key as color:size
              const variantKey = `${variant.color}:${variant.size}`;
              
              // Generate variant-specific SKU if not provided
              if (!variant.sku) {
                variant.sku = `${updatedProduct.sku}-${variant.color.slice(0, 2).toUpperCase()}-${variant.size}`;
              }
              
              // Set variant in product's variantMatrix
              updatedProduct.setVariant(variantKey, {
                price: variant.price || updatedProduct.price,
                stock: variant.stock || 0,
                sku: variant.sku,
                image: variant.image || (updatedProduct.images.length > 0 ? updatedProduct.images[0].url : '')
              });
            }
          }
        }
        
        await updatedProduct.save();
        
        // Process product images to generate pre-signed URLs
        if (updatedProduct.images && updatedProduct.images.length > 0) {
          for (const image of updatedProduct.images) {
            if (image.key) {
              try {
                // Generate a pre-signed URL with 1 hour expiration
                const signedUrl = await getSignedUrl(image.key, 3600);
                // Replace the original URL with the signed URL
                image.url = signedUrl;
              } catch (error) {
                console.error(`Error generating signed URL for ${image.key}:`, error);
              }
            }
          }
        }
        
        return res.status(200).json({
          success: true,
          data: updatedProduct
        });
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Error processing variants: ${error.message}`
        });
      }
    } else {
      // No variants to update, proceed with regular update
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        productData,
        { new: true, runValidators: true }
      );

      // Process product images to generate pre-signed URLs
      if (product.images && product.images.length > 0) {
        for (const image of product.images) {
          if (image.key) {
            try {
              // Generate a pre-signed URL with 1 hour expiration
              const signedUrl = await getSignedUrl(image.key, 3600);
              // Replace the original URL with the signed URL
              image.url = signedUrl;
            } catch (error) {
              console.error(`Error generating signed URL for ${image.key}:`, error);
            }
          }
        }
      }

      res.status(200).json({
        success: true,
        data: product
      });
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Delete product (Admin only)
router.delete('/:id', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Delete images from S3
    for (const image of product.images) {
      await deleteFile(image.key);
    }

    await product.deleteOne();
    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Add product rating
router.post('/:id/ratings', protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user already rated
    const existingRating = product.ratings.find(
      rating => rating.user.toString() === req.user._id.toString()
    );

    if (existingRating) {
      return res.status(400).json({
        success: false,
        message: 'You have already rated this product'
      });
    }

    product.ratings.push({
      user: req.user._id,
      rating: req.body.rating,
      review: req.body.review
    });

    await product.save();

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;