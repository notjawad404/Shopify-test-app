# Integration Guide — Product Notes for Shopify

This document explains how to integrate the **Product Notes** feature into your Shopify store from start to finish. By the end, your customers will be able to add a personal note to products, which carries through the cart, checkout, and into the merchant's order details.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Step 1 — Install & Deploy the App](#step-1--install--deploy-the-app)
- [Step 2 — Enable Notes on Products](#step-2--enable-notes-on-products)
- [Step 3 — Add the Block to Your Theme](#step-3--add-the-block-to-your-theme)
- [Step 4 — Customize the Block](#step-4--customize-the-block)
- [Step 5 — Verify the Full Flow](#step-5--verify-the-full-flow)
- [How Data Flows Through Shopify](#how-data-flows-through-shopify)
- [Accessing Notes in Orders](#accessing-notes-in-orders)
  - [Admin UI](#admin-ui)
  - [Via API](#via-api)
  - [In Notifications & Emails](#in-notifications--emails)
- [Customization Recipes](#customization-recipes)
  - [Change Property Name](#change-property-name)
  - [Make Notes Required](#make-notes-required)
  - [Hide Notes from Customers](#hide-notes-from-customers)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)

---

## Overview

The Product Notes feature consists of three parts:

| Component | Location | Purpose |
|---|---|---|
| **App Page** | `app/routes/app.notes.jsx` | Merchant-facing UI to enable/disable notes per product and set labels |
| **Metafields** | `shopify.app.toml` | Two product metafields: `notes_enabled` (boolean) and `notes_label` (text) |
| **Theme App Block** | `extensions/product-notes-block/` | Storefront-facing textarea that adds the note as a line item property |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Shopify Admin (Embedded App)             │
│                                                          │
│  ┌─────────────────────────────────────────────┐         │
│  │  Product Notes Page (app.notes.jsx)          │         │
│  │  • Toggle notes ON/OFF per product          │         │
│  │  • Set custom label text                    │         │
│  │  • Saves to product metafields via GraphQL  │         │
│  └──────────────────┬──────────────────────────┘         │
│                     │ metafieldsSet mutation              │
│                     ▼                                    │
│  ┌─────────────────────────────────────────────┐         │
│  │  Product Metafields                          │         │
│  │  • app.notes_enabled  (boolean)             │         │
│  │  • app.notes_label    (single_line_text)    │         │
│  │  • Storefront access: public_read           │         │
│  └──────────────────┬──────────────────────────┘         │
└─────────────────────┼────────────────────────────────────┘
                      │ Liquid reads metafields
                      ▼
┌──────────────────────────────────────────────────────────┐
│                  Storefront (Theme)                       │
│                                                          │
│  ┌─────────────────────────────────────────────┐         │
│  │  Product Notes Block (notes-input.liquid)    │         │
│  │  • Checks if notes_enabled == true          │         │
│  │  • Renders textarea with notes_label        │         │
│  │  • On submit → properties[Note] = value     │         │
│  └──────────────────┬──────────────────────────┘         │
│                     │ Line item property                 │
│                     ▼                                    │
│  ┌─────────────────────────────────────────────┐         │
│  │  Cart → Checkout → Order                     │         │
│  │  • Note shown under line item in cart       │         │
│  │  • Note shown in checkout summary           │         │
│  │  • Note saved in order line item data       │         │
│  └─────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────┘
```

---

## Prerequisites

1. **Shopify Partner account** — [Sign up here](https://partners.shopify.com/)
2. **Development store** — Create one from your [Partner Dashboard](https://partners.shopify.com/current/stores)
3. **Node.js** ≥ 20.19 — [Download here](https://nodejs.org/)
4. **Shopify CLI** installed — `npm install -g @shopify/cli`

---

## Step 1 — Install & Deploy the App

### Development (Local)

```bash
# Install dependencies
npm install

# Start the dev server — this deploys config and installs the app
npm run dev
```

The Shopify CLI will:
- Create a tunnel to your local server
- Sync the `shopify.app.toml` config (including metafield definitions)
- Install the app on your development store
- Open the app in the Shopify Admin

### Production

```bash
# Deploy app configuration and extensions to Shopify
npm run deploy

# Build for production
npm run build

# Run the production server
npm run start
```

---

## Step 2 — Enable Notes on Products

1. Open your app in the Shopify Admin
2. Click **Product Notes** in the left sidebar
3. You will see a list of all your products
4. For each product you want notes on:
   - Click **"Enable Notes"** to toggle the notes field on
   - Enter a custom label (e.g., *"Gift message"*, *"Engraving text"*, *"Special instructions"*)
   - Click **"Save Changes"**

This writes two metafields to the product:
- `app.notes_enabled` = `true`
- `app.notes_label` = your label text

---

## Step 3 — Add the Block to Your Theme

The notes textarea is delivered as a **Theme App Block**, which means you add it via the Theme Editor (no code required).

### Instructions

1. In your Shopify Admin, go to **Online Store → Themes**
2. Click **Customize** on your active theme
3. Navigate to a **Product page** (use the page selector dropdown at the top)
4. In the left sidebar, find the product page template sections
5. Click **"Add block"** in the main product section
6. Under the **Apps** tab, select **"Product Notes"**
7. Drag the block to your desired position (recommended: above the Add to Cart button)
8. Click **Save**

> **Important:** The notes block only appears on products where you've enabled notes in the app. Products without notes enabled will show nothing.

### Theme Compatibility

The app block works with **Online Store 2.0 themes** (e.g., Dawn, Sense, Craft, and most modern themes). If your theme doesn't support app blocks, see the [Manual Integration](#manual-theme-integration-legacy-themes) section below.

---

## Step 4 — Customize the Block

After adding the block, click on it in the Theme Editor to access its settings:

| Setting | Description | Default |
|---|---|---|
| **Default label** | Fallback label if none is set in the app | "Add a note" |
| **Placeholder text** | Placeholder inside the textarea | "E.g. Gift message, special instructions..." |
| **Show description** | Show helper text below the label | ✅ Enabled |
| **Description** | The helper text to display | "This note will be included with your order." |
| **Text area rows** | Height of the textarea (2–8 rows) | 3 |
| **Maximum characters** | Character limit | 250 |
| **Show character counter** | Display "X / 250" counter | ✅ Enabled |
| **Top/Bottom spacing** | Vertical margins (0–40px) | 16px |
| **Border radius** | Corner rounding (0–16px) | 8px |
| **Colors** | Label, text, background, border, focus ring | Theme defaults |

---

## Step 5 — Verify the Full Flow

Test the complete customer journey:

### 1. Product Page
- Navigate to a product with notes enabled
- You should see the notes textarea with your configured label
- Type a test message

### 2. Add to Cart
- Click "Add to Cart"
- Go to the Cart page
- The note should appear under the product line item as a property

### 3. Checkout
- Proceed to checkout
- The note appears in the order summary under the line item
- Complete the checkout

### 4. Order Details
- In the Shopify Admin, go to **Orders**
- Open the test order
- The note appears as a line item property

---

## How Data Flows Through Shopify

The notes feature uses Shopify's **line item properties** — a built-in mechanism for attaching custom data to cart items.

```
Customer types a note
    ↓
Form submits with:  properties[Gift message] = "Happy Birthday!"
    ↓
Shopify stores it as a LINE ITEM PROPERTY on the cart item
    ↓
Cart page  →  Shows "Gift message: Happy Birthday!" under the item
    ↓
Checkout   →  Shows the property in the order summary
    ↓
Order      →  Property saved permanently on the order line item
    ↓
Admin      →  Visible in order details, fulfillments, and via API
```

### Key Technical Details

- **Property name** = the notes label (e.g., `properties[Gift message]`)
- Properties are **key-value pairs** on the line item, not hidden metadata
- They are visible to both the **customer** and the **merchant**
- Properties starting with `_` (underscore) are **hidden from customers** but visible to merchants
- Empty notes are **not submitted** (no empty property clutters the order)

---

## Accessing Notes in Orders

### Admin UI

1. Go to **Orders** in the Shopify Admin
2. Click on any order
3. Under each line item, look for properties — the note will appear as:
   ```
   Gift message: Happy Birthday!
   ```

### Via API

Query order line items via the Admin GraphQL API:

```graphql
query getOrderLineItems($orderId: ID!) {
  order(id: $orderId) {
    lineItems(first: 50) {
      edges {
        node {
          title
          quantity
          customAttributes {
            key
            value
          }
        }
      }
    }
  }
}
```

The note appears in `customAttributes`:

```json
{
  "customAttributes": [
    {
      "key": "Gift message",
      "value": "Happy Birthday!"
    }
  ]
}
```

### In Notifications & Emails

To include notes in **order confirmation emails** and other notifications:

1. Go to **Settings → Notifications** in the Shopify Admin
2. Edit the **Order confirmation** template
3. Add this Liquid code inside the line items loop:

```liquid
{% for property in line.properties %}
  {% unless property.last == blank %}
    <p style="font-size: 13px; color: #666;">
      <strong>{{ property.first }}:</strong> {{ property.last }}
    </p>
  {% endunless %}
{% endfor %}
```

> **Note:** Many themes already include this code in their notification templates. Check your templates before adding it.

---

## Customization Recipes

### Change Property Name

By default, the property name matches the notes label set in the app. To use a fixed name regardless of the label, edit `notes-input.liquid`:

```liquid
<!-- Change this line: -->
hidden.name = 'properties[{{ notes_label | escape }}]';

<!-- To a fixed name: -->
hidden.name = 'properties[Note]';
```

### Make Notes Required

To prevent form submission without a note, add validation in `notes-input.liquid`:

```javascript
form.addEventListener('submit', function (e) {
  const noteValue = noteInput.value.trim();
  if (!noteValue) {
    e.preventDefault();
    noteInput.style.borderColor = '#d72c0d';
    noteInput.setAttribute('placeholder', 'Please enter a note before adding to cart');
    noteInput.focus();
    return false;
  }
  // ... rest of the submit handler
});
```

### Hide Notes from Customers

To make notes visible **only to merchants** (not shown in customer-facing checkout or order pages), prefix the property name with an underscore:

```liquid
hidden.name = 'properties[_{{ notes_label | escape }}]';
```

---

## Manual Theme Integration (Legacy Themes)

If your theme doesn't support app blocks (Online Store 1.0 themes), you can manually add the notes field to your product template.

### Option A: Edit the Theme Liquid

1. Go to **Online Store → Themes → Edit code**
2. Open `sections/product-template.liquid` (or `templates/product.liquid`)
3. Find the product form (typically `<form action="/cart/add" ...>`)
4. Add this code **inside the form**, above the submit button:

```liquid
{% if product.metafields.app.notes_enabled.value == true %}
  {% assign notes_label = product.metafields.app.notes_label.value | default: "Add a note" %}
  <div class="product-notes" style="margin: 16px 0;">
    <label for="product-note" style="display: block; margin-bottom: 8px; font-weight: 600;">
      {{ notes_label }}
    </label>
    <textarea
      id="product-note"
      name="properties[{{ notes_label | escape }}]"
      rows="3"
      maxlength="250"
      placeholder="E.g. Gift message, special instructions..."
      style="width: 100%; padding: 10px 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 14px;"
    ></textarea>
  </div>
{% endif %}
```

### Option B: Use the AJAX API

If your theme uses AJAX to add items to the cart, modify the add-to-cart JavaScript:

```javascript
// When adding to cart via the AJAX API
fetch('/cart/add.js', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: variantId,
    quantity: 1,
    properties: {
      'Gift message': document.getElementById('product-note').value
    }
  })
});
```

---

## Troubleshooting

### Notes field not showing on the product page

| Possible Cause | Solution |
|---|---|
| Notes not enabled for this product | Go to the app → Product Notes → Enable notes on this product |
| App block not added to theme | Go to Theme Editor → Product page → Add block → Apps → "Product Notes" |
| Theme doesn't support app blocks | Use the [Manual Integration](#manual-theme-integration-legacy-themes) method |
| Metafields not deployed | Run `npm run deploy` to sync the metafield definitions |

### Notes not appearing in cart

| Possible Cause | Solution |
|---|---|
| Note field is empty | Notes are only submitted when the customer types something |
| Theme cart doesn't show properties | Edit `sections/cart-template.liquid` — see [Displaying Properties in Cart](#displaying-properties-in-cart) |
| JavaScript error | Check the browser console for errors on the product page |

### Displaying Properties in Cart

If your theme's cart doesn't display line item properties, add this to your cart template inside the line items loop:

```liquid
{% if item.properties.size > 0 %}
  <ul style="list-style: none; padding: 0; margin: 4px 0 0;">
    {% for property in item.properties %}
      {% unless property.last == blank or property.first contains '_' %}
        <li style="font-size: 13px; color: #6d7175;">
          {{ property.first }}: {{ property.last }}
        </li>
      {% endunless %}
    {% endfor %}
  </ul>
{% endif %}
```

### Notes not appearing in order emails

Add the properties loop to your notification templates. See [In Notifications & Emails](#in-notifications--emails).

---

## API Reference

### Metafields

| Metafield | Namespace | Key | Type | Access |
|---|---|---|---|---|
| Notes Enabled | `app` | `notes_enabled` | `boolean` | Admin: read/write, Storefront: read |
| Notes Label | `app` | `notes_label` | `single_line_text_field` | Admin: read/write, Storefront: read |

### GraphQL Mutations Used

**Enable/disable notes on a product:**

```graphql
mutation setProductNotes($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { id key value }
    userErrors { field message }
  }
}
```

Variables:

```json
{
  "metafields": [
    {
      "ownerId": "gid://shopify/Product/123456789",
      "namespace": "$app",
      "key": "notes_enabled",
      "type": "boolean",
      "value": "true"
    },
    {
      "ownerId": "gid://shopify/Product/123456789",
      "namespace": "$app",
      "key": "notes_label",
      "type": "single_line_text_field",
      "value": "Gift message"
    }
  ]
}
```

### Files Modified/Created

| File | Change |
|---|---|
| `shopify.app.toml` | Added `notes_enabled` and `notes_label` metafield definitions |
| `app/routes/app.notes.jsx` | **New** — Product notes management page |
| `app/routes/app.jsx` | Added "Product Notes" navigation link |
| `extensions/product-notes-block/shopify.extension.toml` | **New** — Theme extension manifest |
| `extensions/product-notes-block/blocks/notes-input.liquid` | **New** — Storefront notes input block |
| `INTEGRATION.md` | **New** — This file |
