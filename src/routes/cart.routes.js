const express = require('express');
const router = express.Router();
const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const { protect } = require('../middleware/auth.middleware');

// Get user's cart
router.get('/', protect, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product', 'name price images');

    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Add item to cart
router.post('/add', protect, async (req, res) => {
  try {
    const { productId, quantity, color = 'default', size = 'default' } = req.body;

    // Validate product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Generate variant key
    const variantKey = `${color}:${size}`;
    
    // Check if this variant exists and has stock
    let variantPrice = product.price;
    let variantStock = product.stock;
    let variantImage = product.images && product.images.length > 0 ? product.images[0].url : '';
    let variantSku = product.sku;
    
    // If product has variants, check the specific variant
    if (product.variantMatrix && product.variantMatrix.size > 0) {
      const variant = product.variantMatrix.get(variantKey);
      
      if (variant) {
        variantPrice = variant.price || product.price;
        variantStock = variant.stock;
        if (variant.image) variantImage = variant.image;
        if (variant.sku) variantSku = variant.sku;
      } else if (color !== 'default' || size !== 'default') {
        // If a specific variant was requested but doesn't exist
        return res.status(404).json({
          success: false,
          message: `The selected variant (${color}/${size}) is not available`
        });
      }
    }

    // Check stock for the specific variant
    if (variantStock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for this variant (${color}/${size})`
      });
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = await Cart.create({
        user: req.user._id,
        items: [{
          product: productId,
          quantity,
          price: variantPrice,
          color,
          size,
          variantKey,
          variantImage,
          productName: product.name,
          variantSku
        }]
      });
    } else {
      // Check if this specific variant already exists in cart
      const existingItem = cart.items.find(
        item => item.product.toString() === productId && 
               item.color === color && 
               item.size === size
      );

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.items.push({
          product: productId,
          quantity,
          price: variantPrice,
          color,
          size,
          variantKey,
          variantImage,
          productName: product.name,
          variantSku
        });
      }

      await cart.save();
    }

    await cart.populate('items.product', 'name price images');

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Update cart item quantity
router.patch('/update/:itemId', protect, async (req, res) => {
  try {
    const { quantity } = req.body;
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    // Find the cart item by its MongoDB _id
    const itemIndex = cart.items.findIndex(
      item => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    const cartItem = cart.items[itemIndex];
    const product = await Product.findById(cartItem.product);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check stock for the specific variant
    let variantStock = product.stock;
    
    // If product has variants, check the specific variant
    if (product.variantMatrix && product.variantMatrix.size > 0) {
      const variant = product.variantMatrix.get(cartItem.variantKey);
      if (variant) {
        variantStock = variant.stock;
      }
    }

    // Check stock
    if (variantStock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for this variant (${cartItem.color}/${cartItem.size})`
      });
    }

    cart.items[itemIndex].quantity = quantity;
    await cart.save();
    await cart.populate('items.product', 'name price images');

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Remove item from cart
router.delete('/remove/:itemId', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    // Remove item by its MongoDB _id instead of product ID
    // This ensures we remove the specific variant
    cart.items = cart.items.filter(
      item => item._id.toString() !== req.params.itemId
    );

    await cart.save();
    await cart.populate('items.product', 'name price images');

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Clear cart
router.delete('/clear', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;