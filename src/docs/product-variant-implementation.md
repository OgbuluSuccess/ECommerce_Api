# Product Variant Implementation Guide

## Overview

The Ice Deluxe Wears e-commerce platform implements a dynamic product variant system that allows for flexible product configurations with multiple colors, sizes, and variant-specific attributes such as pricing, stock levels, SKUs, and images.

## Data Structure

### Product Model

The product model has been enhanced with the following fields to support variants:

```javascript
{
  // Base product fields
  name: String,
  price: Number,  // Base price
  stock: Number,  // Base stock
  sku: String,    // Base SKU
  
  // Variant-specific fields
  availableColors: [String],  // Array of available colors
  availableSizes: [String],   // Array of available sizes
  variantMatrix: Map          // Map of variant data keyed by "color:size"
}
```

### Variant Matrix Structure

The `variantMatrix` uses a key format of `"color:size"` with values containing variant-specific data:

```javascript
{
  "Red:M": {
    price: 2000,
    stock: 10,
    sku: "RED-M-GucciShirt",
    image: "https://example.com/red-m-shirt.jpg"
  },
  "Blue:L": {
    price: 2200,
    stock: 5,
    sku: "BLUE-L-GucciShirt",
    image: "https://example.com/blue-l-shirt.jpg"
  }
}
```

## Backend Implementation

### API Endpoints

1. **Create Product with Variants**
   - `POST /api/products`
   - Accepts multipart/form-data with variant information
   - Variant data is passed as a JSON string in the `variants` field

2. **Update Product with Variants**
   - `PATCH /api/products/:id`
   - Can add, modify, or remove variants
   - Option to clear all variants with `clearVariants` flag

### Creating Variants

Variants are created by sending a JSON array in the `variants` field:

```json
[
  {
    "color": "Red",
    "size": "M",
    "price": 2000,
    "stock": 10,
    "sku": "RED-M-123"
  },
  {
    "color": "Blue",
    "size": "L",
    "price": 2200,
    "stock": 5
  }
]
```

The backend will:
1. Parse the JSON string
2. Create the product with basic information
3. Process each variant and add it to the `variantMatrix`
4. Automatically generate variant SKUs if not provided

## Frontend Implementation Workflow

### 1. Product Listing Page

- Display base product image
- Show price range if variants have different prices
- Show color swatches to indicate available colors
- Optionally show size availability

### 2. Product Detail Page

#### Initial Load:
1. Fetch product data with all variant information
2. Initialize state for selected color and size
   ```js
   const [selectedColor, setSelectedColor] = useState(product.availableColors[0]);
   const [selectedSize, setSelectedSize] = useState(product.availableSizes[0]);
   ```

#### User Interaction Flow:
1. User selects a color
   - Update `selectedColor` state
   - Filter available sizes for this color
   - Update product image if variant has specific image

2. User selects a size
   - Update `selectedSize` state
   - Generate variant key: `${selectedColor}:${selectedSize}`
   - Look up variant in `variantMatrix` object

3. Update UI based on selected variant
   - Show variant-specific price: `variant.price || product.price`
   - Show variant-specific stock: `variant.stock || 0`
   - Show "Out of Stock" if `variant.stock <= 0`
   - Update product image: `variant.image || product.images[0].url`

4. User selects quantity and adds to cart
   - Add to cart with variant information:
     ```js
     addToCart({
       productId: product._id,
       name: product.name,
       price: selectedVariant.price,
       quantity: selectedQuantity,
       color: selectedColor,
       size: selectedSize,
       variantSku: selectedVariant.sku,
       variantImage: selectedVariant.image
     });
     ```

### 3. Shopping Cart
- Display product name with variant info: "GucciShirt (Red, M)"
- Show variant-specific price
- Show variant-specific image if available
- Include variant information when proceeding to checkout

### 4. Checkout
- Send variant information with order:
  ```js
  const orderData = {
    // User and shipping info...
    items: [
      {
        productId: "68569298535fceea1ca88953",
        quantity: 1,
        color: "Red",
        size: "M",
        variantSku: "RED-M-GucciShirt"
      }
    ]
  };
  ```

### 5. Order Confirmation
- Display variant details in order summary
- Show variant-specific images
- Include variant SKU for reference

## Implementation Example

### Finding the Selected Variant

```javascript
// Get the currently selected variant
const getSelectedVariant = () => {
  if (!selectedColor || !selectedSize) return null;
  
  const variantKey = `${selectedColor}:${selectedSize}`;
  return product.variantMatrix[variantKey];
};

const selectedVariant = getSelectedVariant();
```

### Rendering Color Options

```jsx
<div className="color-options">
  <h3>Color: {selectedColor}</h3>
  <div className="color-swatches">
    {product.availableColors.map(color => (
      <button
        key={color}
        className={`color-swatch ${selectedColor === color ? 'selected' : ''}`}
        style={{ backgroundColor: color.toLowerCase() }}
        onClick={() => setSelectedColor(color)}
      />
    ))}
  </div>
</div>
```

### Rendering Size Options

```jsx
<div className="size-options">
  <h3>Size: {selectedSize}</h3>
  <div className="size-buttons">
    {product.availableSizes.map(size => {
      // Check if this size is available for the selected color
      const isAvailable = Object.keys(product.variantMatrix)
        .some(key => key.startsWith(`${selectedColor}:`) && 
              key.endsWith(size) && 
              product.variantMatrix[key].stock > 0);
      
      return (
        <button
          key={size}
          className={`size-button ${selectedSize === size ? 'selected' : ''}`}
          disabled={!isAvailable}
          onClick={() => setSelectedSize(size)}
        >
          {size}
        </button>
      );
    })}
  </div>
</div>
```

## Best Practices

1. **Validation**
   - Always check if a variant exists before accessing its properties
   - Provide fallbacks to base product data when variant data is unavailable

2. **User Experience**
   - Disable size options that aren't available for the selected color
   - Update price, stock, and image dynamically when variant selection changes
   - Show clear visual feedback for selected variants

3. **Performance**
   - Use object lookup for variant data rather than array filtering
   - Cache variant availability calculations when possible

4. **Backward Compatibility**
   - Handle products without variants gracefully
   - Support legacy products that don't use the variant system

## Email Integration

The email notification system has been updated to include variant information in order confirmation and admin notification emails. The `generateOrderItemsRows` function now displays:

1. Variant color and size
2. Variant-specific SKU
3. Variant-specific images

This ensures that both customers and administrators have complete information about the specific product variants that were ordered.
