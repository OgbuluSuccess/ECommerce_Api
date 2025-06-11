const express = require('express');
const router = express.Router();
const { ShippingZone, StorePickup, ShippingSettings } = require('../models/shipping.model');
const { protect, restrictTo } = require('../middleware/auth.middleware');

/**
 * @swagger
 * /shipping/zones:
 *   get:
 *     summary: Get all shipping zones
 *     tags: [Shipping]
 *     parameters:
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Nigerian state name to filter shipping zones (e.g., Lagos, Abuja, FCT)
 *     responses:
 *       200:
 *         description: List of all shipping zones
 */
router.get('/zones', async (req, res) => {
  try {
    const { state } = req.query;
    
    // First, get all zones to see what we're working with
    const allZones = await ShippingZone.find({});
    console.log(`Total shipping zones in database: ${allZones.length}`);
    
    if (allZones.length === 0) {
      return res.status(200).json({
        success: true,
        results: 0,
        message: 'No shipping zones found in database. Please create shipping zones first.',
        data: []
      });
    }
    
    // If no state provided, return all active zones
    if (!state) {
      const zones = await ShippingZone.find({ isActive: true });
      return res.status(200).json({
        success: true,
        results: zones.length,
        data: zones
      });
    }
    
    // For state filtering, we'll do it manually since regex in MongoDB query might not work as expected
    const normalizedState = state.toLowerCase();
    const isAbuja = normalizedState === 'abuja' || normalizedState === 'fct';
    
    // Get all active zones
    const activeZones = await ShippingZone.find({ isActive: true });
    
    // Filter zones manually
    const filteredZones = activeZones.filter(zone => {
      // For Abuja/FCT, include all abuja type zones
      if (isAbuja && zone.type === 'abuja') {
        return true;
      }
      
      // Check if any area in the zone matches the state (case insensitive)
      if (zone.areas && zone.areas.length > 0) {
        return zone.areas.some(area => {
          const normalizedArea = area.toLowerCase();
          
          // Check for direct match
          if (normalizedArea === normalizedState) {
            return true;
          }
          
          // Check for Abuja/FCT variations
          if (isAbuja && (normalizedArea === 'abuja' || normalizedArea === 'fct')) {
            return true;
          }
          
          // Check for nationwide zones
          if (normalizedArea === 'nationwide' || normalizedArea === 'all states') {
            return true;
          }
          
          // Check if area contains the state name
          if (normalizedArea.includes(normalizedState)) {
            return true;
          }
          
          return false;
        });
      }
      
      return false;
    });
    
    console.log(`Found ${filteredZones.length} zones matching state: ${state}`);
    
    res.status(200).json({
      success: true,
      results: filteredZones.length,
      data: filteredZones
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
 * /shipping/zones/{type}:
 *   get:
 *     summary: Get shipping zones by type
 *     tags: [Shipping]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [abuja, interstate, pickup]
 *     responses:
 *       200:
 *         description: List of shipping zones by type
 */
router.get('/zones/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!['abuja', 'interstate', 'pickup'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid zone type. Must be one of: abuja, interstate, pickup'
      });
    }
    
    const zones = await ShippingZone.find({ type, isActive: true });
    
    res.status(200).json({
      success: true,
      results: zones.length,
      data: zones
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
 * /shipping/calculate:
 *   post:
 *     summary: Calculate shipping cost with optional weight and item count
 *     tags: [Shipping]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - zoneId
 *               - totalAmount
 *             properties:
 *               zoneId:
 *                 type: string
 *                 description: ID of the shipping zone
 *               totalAmount:
 *                 type: number
 *                 description: Total order amount in Naira
 *               weight:
 *                 type: number
 *                 description: Total weight of the order in kg (optional)
 *               itemCount:
 *                 type: number
 *                 description: Total number of items in the order (optional)
 *     responses:
 *       200:
 *         description: Calculated shipping cost with details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 */
router.post('/calculate', async (req, res) => {
  try {
    const { zoneId, state, totalAmount, weight, itemCount } = req.body;
    
    // Get shipping settings
    let settings = await ShippingSettings.findOne();
    if (!settings) {
      settings = await ShippingSettings.create({});
    }
    
    // Handle store pickup
    if (zoneId === 'pickup') {
      let pickupConfig = await StorePickup.findOne();
      if (!pickupConfig || !pickupConfig.isEnabled) {
        return res.status(404).json({
          success: false,
          message: 'Store pickup is not available'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: {
          shippingCost: 0,
          zoneName: 'Store Pickup',
          zoneType: 'pickup',
          estimatedDeliveryTime: pickupConfig.preparationTime || '2-4 hours',
          storeAddress: pickupConfig.storeAddress,
          workingHours: pickupConfig.workingHours,
          pickupInstructions: pickupConfig.pickupInstructions
        }
      });
    }
    
    let zone;
    
    // If we have a zoneId, use that directly
    if (zoneId) {
      // Handle regular shipping zones
      zone = await ShippingZone.findById(zoneId);
      if (!zone || !zone.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Shipping zone not found or inactive'
        });
      }
    } 
    // If we have a state but no zoneId, find the appropriate zone
    else if (state) {
      // Check if it's Abuja/FCT
      if (state === 'FCT' || state.toLowerCase().includes('abuja')) {
        // Get the first active Abuja zone
        zone = await ShippingZone.findOne({ type: 'abuja', isActive: true });
      } else {
        // Try to find a specific zone for this state
        zone = await ShippingZone.findOne({
          type: 'interstate',
          isActive: true,
          areas: { $in: [state] }
        });
        
        // If no specific zone, try to find a nationwide zone
        if (!zone) {
          zone = await ShippingZone.findOne({
            type: 'interstate',
            isActive: true,
            areas: { $in: ['nationwide', 'all states'] }
          });
        }
      }
      
      if (!zone) {
        return res.status(404).json({
          success: false,
          message: `No shipping zone available for ${state}`
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either shipping zone ID or state is required'
      });
    }
    
    // Advanced shipping cost calculation logic
    let shippingCost = zone.price;
    const FREE_SHIPPING_THRESHOLD = settings.freeDeliveryThreshold; // From settings
    const HEAVY_ITEM_THRESHOLD = 5; // kg
    const HEAVY_ITEM_SURCHARGE = 500; // ₦500
    const BULK_ORDER_THRESHOLD = 10; // items
    const BULK_ORDER_SURCHARGE = 1000; // ₦1,000
    
    // Apply weight-based surcharge if provided
    if (weight && weight > HEAVY_ITEM_THRESHOLD) {
      shippingCost += HEAVY_ITEM_SURCHARGE;
    }
    
    // Apply bulk order surcharge if provided
    if (itemCount && itemCount > BULK_ORDER_THRESHOLD) {
      shippingCost += BULK_ORDER_SURCHARGE;
    }
    
    // Apply free shipping for orders above threshold
    const freeShippingEligible = totalAmount >= FREE_SHIPPING_THRESHOLD;
    if (freeShippingEligible) {
      shippingCost = 0;
    }
    
    res.status(200).json({
      success: true,
      data: {
        shippingCost,
        zoneName: zone.name,
        zoneType: zone.type,
        estimatedDeliveryTime: zone.estimatedDeliveryTime,
        courierPartner: zone.courierPartner || settings.defaultCourierPartner,
        state: state || (zone.areas && zone.areas.length > 0 ? zone.areas[0] : ''),
        freeShippingEligible,
        freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
        cashOnDeliveryAvailable: settings.enableCashOnDelivery,
        appliedSurcharges: {
          weightBased: weight && weight > HEAVY_ITEM_THRESHOLD ? HEAVY_ITEM_SURCHARGE : 0,
          bulkOrder: itemCount && itemCount > BULK_ORDER_THRESHOLD ? BULK_ORDER_SURCHARGE : 0
        }
      }
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
 * /shipping/pickup:
 *   get:
 *     summary: Get store pickup configuration
 *     tags: [Shipping]
 *     responses:
 *       200:
 *         description: Store pickup configuration
 */
router.get('/pickup', async (req, res) => {
  try {
    let pickupConfig = await StorePickup.findOne();
    
    // Create default pickup config if none exists
    if (!pickupConfig) {
      pickupConfig = await StorePickup.create({
        storeAddress: 'Shop 15, Banex Plaza, Wuse 2, Abuja',
        workingHours: 'Mon-Sat: 9:00 AM - 6:00 PM'
      });
    }
    
    res.status(200).json({
      success: true,
      data: pickupConfig
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
 * /shipping/settings:
 *   get:
 *     summary: Get shipping settings
 *     tags: [Shipping]
 *     responses:
 *       200:
 *         description: Shipping settings
 */
router.get('/settings', async (req, res) => {
  try {
    let settings = await ShippingSettings.findOne();
    
    // Create default settings if none exists
    if (!settings) {
      settings = await ShippingSettings.create({});
    }
    
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Admin routes for managing shipping zones

/**
 * @swagger
 * /shipping/admin/zones:
 *   get:
 *     summary: Get all shipping zones (admin)
 *     tags: [Admin, Shipping]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all shipping zones
 */
router.get('/admin/zones', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const zones = await ShippingZone.find().sort('type name');
    
    res.status(200).json({
      success: true,
      results: zones.length,
      data: zones
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
 * /shipping/admin/zones:
 *   post:
 *     summary: Create a new shipping zone
 *     tags: [Admin, Shipping]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               states:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Nigerian states covered by this shipping zone
 *               price:
 *                 type: number
 *               estimatedDeliveryTime:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [abuja, interstate, pickup]
 *               courierPartner:
 *                 type: string
 *     responses:
 *       201:
 *         description: Shipping zone created successfully
 */
router.post('/admin/zones', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const { name, states, price, estimatedDeliveryTime, type, courierPartner } = req.body;
    
    // For interstate shipping, states are required
    if (type === 'interstate' && (!states || states.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'States are required for interstate shipping zones'
      });
    }
    
    // For Abuja shipping, we default to FCT
    const areas = type === 'abuja' ? ['FCT'] : states;
    
    const zone = await ShippingZone.create({
      name,
      areas, // Store states in the areas field
      price,
      estimatedDeliveryTime,
      type: type || 'abuja',
      courierPartner
    });
    
    res.status(201).json({
      success: true,
      data: zone
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
 * /shipping/admin/zones/{id}:
 *   get:
 *     summary: Get shipping zone by ID
 *     tags: [Admin, Shipping]
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
 *         description: Shipping zone details
 */
router.get('/admin/zones/:id', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const zone = await ShippingZone.findById(req.params.id);
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Shipping zone not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: zone
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
 * /shipping/admin/zones/{id}:
 *   put:
 *     summary: Update shipping zone
 *     tags: [Admin, Shipping]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               areas:
 *                 type: array
 *                 items:
 *                   type: string
 *               price:
 *                 type: number
 *               estimatedDeliveryTime:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               type:
 *                 type: string
 *                 enum: [local, interstate, international]
 *     responses:
 *       200:
 *         description: Shipping zone updated successfully
 */
router.put('/admin/zones/:id', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const { name, areas, price, estimatedDeliveryTime, isActive, type } = req.body;
    
    const zone = await ShippingZone.findByIdAndUpdate(
      req.params.id,
      {
        name,
        areas,
        price,
        estimatedDeliveryTime,
        isActive,
        type
      },
      { new: true, runValidators: true }
    );
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Shipping zone not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: zone
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
 * /shipping/admin/zones/{id}:
 *   delete:
 *     summary: Delete a shipping zone
 *     tags: [Admin, Shipping]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Zone deleted successfully
 */
router.delete('/admin/zones/:id', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const zone = await ShippingZone.findByIdAndDelete(req.params.id);
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Shipping zone not found'
      });
    }
    
    res.status(204).json({
      success: true,
      data: null
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
 * /shipping/admin/pickup:
 *   put:
 *     summary: Update store pickup configuration
 *     tags: [Admin, Shipping]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isEnabled:
 *                 type: boolean
 *               storeAddress:
 *                 type: string
 *               workingHours:
 *                 type: string
 *               preparationTime:
 *                 type: string
 *               pickupInstructions:
 *                 type: string
 *     responses:
 *       200:
 *         description: Store pickup configuration updated
 */
router.put('/admin/pickup', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const { isEnabled, storeAddress, workingHours, preparationTime, pickupInstructions } = req.body;
    
    let pickupConfig = await StorePickup.findOne();
    
    if (!pickupConfig) {
      pickupConfig = await StorePickup.create({
        isEnabled,
        storeAddress,
        workingHours,
        preparationTime,
        pickupInstructions
      });
    } else {
      // Update existing config
      if (isEnabled !== undefined) pickupConfig.isEnabled = isEnabled;
      if (storeAddress) pickupConfig.storeAddress = storeAddress;
      if (workingHours) pickupConfig.workingHours = workingHours;
      if (preparationTime) pickupConfig.preparationTime = preparationTime;
      if (pickupInstructions) pickupConfig.pickupInstructions = pickupInstructions;
      
      await pickupConfig.save();
    }
    
    res.status(200).json({
      success: true,
      data: pickupConfig
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
 * /shipping/admin/settings:
 *   put:
 *     summary: Update shipping settings
 *     tags: [Admin, Shipping]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               freeDeliveryThreshold:
 *                 type: number
 *               defaultCourierPartner:
 *                 type: string
 *               maxDeliveryDays:
 *                 type: number
 *               enableCashOnDelivery:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Shipping settings updated
 */
router.put('/admin/settings', protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const { freeDeliveryThreshold, defaultCourierPartner, maxDeliveryDays, enableCashOnDelivery } = req.body;
    
    let settings = await ShippingSettings.findOne();
    
    if (!settings) {
      settings = await ShippingSettings.create({
        freeDeliveryThreshold,
        defaultCourierPartner,
        maxDeliveryDays,
        enableCashOnDelivery
      });
    } else {
      // Update existing settings
      if (freeDeliveryThreshold !== undefined) settings.freeDeliveryThreshold = freeDeliveryThreshold;
      if (defaultCourierPartner) settings.defaultCourierPartner = defaultCourierPartner;
      if (maxDeliveryDays !== undefined) settings.maxDeliveryDays = maxDeliveryDays;
      if (enableCashOnDelivery !== undefined) settings.enableCashOnDelivery = enableCashOnDelivery;
      
      await settings.save();
    }
    
    res.status(200).json({
      success: true,
      data: settings
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
 * /shipping/states:
 *   get:
 *     summary: Get all Nigerian states from existing shipping zones
 *     tags: [Shipping]
 *     responses:
 *       200:
 *         description: List of Nigerian state names from shipping zones for dropdown mapping
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
router.get('/states', async (req, res) => {
  try {
    // Get all active shipping zones
    const zones = await ShippingZone.find({ isActive: true });
    
    if (zones.length === 0) {
      return res.status(200).json([]);
    }
    
    // List of Nigerian states
    const nigerianStates = [
      'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River',
      'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano',
      'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
      'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
    ];
    
    // Extract areas from each zone and filter to include only Nigerian states
    const stateNames = [];
    
    zones.forEach(zone => {
      if (zone.areas && Array.isArray(zone.areas)) {
        zone.areas.forEach(area => {
          const trimmedArea = area.trim();
          // Check if the area is a Nigerian state
          const isState = nigerianStates.some(state => {
            // Case insensitive comparison
            return trimmedArea.toLowerCase() === state.toLowerCase() ||
                  // Special case for Abuja/FCT
                  (trimmedArea.toLowerCase() === 'abuja' && state === 'FCT');
          });
          
          if (isState) {
            // Normalize 'Abuja' to 'FCT'
            const normalizedState = trimmedArea.toLowerCase() === 'abuja' ? 'FCT' : trimmedArea;
            stateNames.push(normalizedState);
          }
        });
      }
    });
    
    // Remove duplicates and sort alphabetically
    const uniqueStates = [...new Set(stateNames)].sort();
    
    // Return just the array of state names for direct dropdown mapping
    res.status(200).json(uniqueStates);
  } catch (error) {
    console.error('Error fetching states:', error);
    res.status(500).json([]);
  }
});

module.exports = router;
