const express = require('express');
const router = express.Router();
const Category = require('../models/category.model');
const { protect, restrictTo } = require('../middleware/auth.middleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           description: Category name
 *         description:
 *           type: string
 *           description: Category description
 *         parent:
 *           type: string
 *           description: Parent category ID (for subcategories)
 *         subcategories:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of subcategory IDs
 *         createdBy:
 *           type: string
 *           description: ID of admin who created the category
 */

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Categories]
 *     description: Retrieve all main categories with their subcategories
 *     responses:
 *       200:
 *         description: List of categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 results:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Category'
 */
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ parent: null })
      .populate('subcategories');

    res.status(200).json({
      success: true,
      results: categories.length,
      data: categories
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
 * /categories/{id}:
 *   get:
 *     summary: Get a category by ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       404:
 *         description: Category not found
 */
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('subcategories');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(200).json({
      success: true,
      data: category
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
 * /categories:
 *   post:
 *     summary: Create a new category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               parent:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Admin access required
 */
router.post('/', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const { name, description, parent } = req.body;
    const categoryData = {
      name,
      description,
      createdBy: req.user._id
    };

    if (parent) {
      // Validate if parent category exists
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        return res.status(404).json({
          success: false,
          message: 'Parent category not found'
        });
      }
      categoryData.parent = parent;
    }

    const category = await Category.create(categoryData);
    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    // Handle specific MongoDB validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map(err => err.message).join(', ')
      });
    }
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /categories/{id}:
 *   patch:
 *     summary: Update a category
 *     tags: [Categories]
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
 *               description:
 *                 type: string
 *               parent:
 *                 type: string
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       404:
 *         description: Category not found
 */
router.patch('/:id', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(200).json({
      success: true,
      data: category
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
 * /categories/{id}:
 *   delete:
 *     summary: Delete a category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *       400:
 *         description: Cannot delete category with subcategories
 *       404:
 *         description: Category not found
 */
router.delete('/:id', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category has subcategories
    const hasSubcategories = await Category.exists({ parent: category._id });
    if (hasSubcategories) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with subcategories'
      });
    }

    // Using deleteOne instead of the deprecated remove() method
    await Category.deleteOne({ _id: category._id });

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;