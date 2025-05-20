const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/product.model');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const { uploadFile, deleteFile, getSignedUrl } = require('../config/s3.config');
const transformS3Urls = require('../middleware/s3-url.middleware');

// Apply S3 URL transformation middleware to all routes
router.use(transformS3Urls);

/**
 * @swagger
 * components:
 *   schemas:
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
 *           description: Product price
 *         description:
 *           type: string
 *           description: Product description
 *         category:
 *           type: string
 *           description: Product category ID
 *         stock:
 *           type: number
 *           description: Available stock
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
 *     summary: Create a new product
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
    const products = await Product.find().populate('category');
    
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

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);
    pipeline.push({ $skip: skip }, { $limit: Number(limit) });

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
    const product = await Product.findById(req.params.id).populate('ratings.user', 'name');
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

router.post('/', protect, restrictTo('admin'), upload.array('images', 5), async (req, res) => {
  try {
    const productData = req.body;
    productData.images = [];

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
            console.log(`Generated signed URL for ${image.key}`);
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
 *     requestBody:
 *       content:
 *         application/json:
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
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       404:
 *         description: Product not found
 */
router.patch('/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
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

// Delete product (Admin only)
router.delete('/:id', protect, restrictTo('admin'), async (req, res) => {
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