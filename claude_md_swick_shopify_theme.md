# Swick — "Nature Bottled" Shopify Theme

## 1. Brand & Store Overview
- **Brand Name:** Swick
- **Tagline:** Nature Bottled
- **Live Domain:** `swick.in`
- **Permanent Shopify Domain (CLI):** `w0i7sc-cn.myshopify.com`
- **Market & Currency:** India D2C, INR (`₹`), mobile-first audience (80%+ traffic on mobile).
- **Product Catalog:** Pure Camphor, Blended Camphor (herbs + natural scents), Room Sprays, Linen Sprays, Temple Fragrances, Room Fresheners, Aroma Oils, and Discovery / Trial Kits.

## 2. Design System & UX Direction
- **Visual Inspiration:** Snitch's fast, app-like mobile UX + The Souled Store's structured visual discovery across large SKU catalogs.
- **Aesthetic:** Clean, warm, sensory, and editorial. Avoid cluttered marketplace layouts.
- **Color Palette:**
  - Background: `#FAF8F5` (warm off-white)
  - Primary: `#1E3A2F` (deep botanical green)
  - Accent: `#C27D48` (warm terracotta / amber)
  - Text Primary: `#1A1A1A` (charcoal)
  - Text Muted: `#5C5C5C`
  - Subtle Border: `#E8E2D9`
- **Typography:** Clean serif for editorial headings + crisp sans-serif for body copy, UI labels, and `₹` pricing.
- **Mobile-First Rule:** Design and test for `390px` viewport width first, then scale gracefully to tablet and desktop. Use 2-column product grids on mobile and thumb-friendly tap targets (min `44px`).

## 3. Engineering & Shopify Liquid Rules
- **Tech Stack:** Pure Shopify Liquid, scoped CSS, and vanilla JavaScript only. **Do not** add jQuery, Bootstrap, Tailwind CDN, or heavy third-party JS libraries.
- **CSS Scoping:** Prefix all custom CSS classes and custom properties with `.swick-` (e.g., `.swick-hero`, `--swick-primary`) so base theme styles (Horizon/Dawn) are never broken.
- **Theme Editor Compatibility:** Every custom section **must** include a complete, valid `{% schema %}` with `presets` so all text, images, videos, colors, links, and collection pickers are editable in the Shopify Theme Editor.
- **Fallback / Placeholder UI:** Always render clean, realistic placeholder content (e.g., sample Swick fragrance names, scent notes, warm gradient placeholders) when an image, collection, or metafield is empty so sections look finished before catalog upload.
- **Performance:**
  - Lazy-load all below-the-fold images (`loading="lazy"`).
  - Eager-load above-the-fold hero media (`fetchpriority="high"`) with explicit aspect ratios to prevent Cumulative Layout Shift (CLS).
  - Use Shopify's native AJAX Cart API (`/cart/add.js`, `/cart.js`, `/cart/change.js`) for quick-add and cart drawer updates without page reloads.

## 4. Standard Metafield Conventions
When building product cards or product page blocks, read from these standard product metafields (with clean fallbacks if blank):
- `product.metafields.custom.top_notes` (single-line text)
- `product.metafields.custom.heart_notes` (single-line text)
- `product.metafields.custom.base_notes` (single-line text)
- `product.metafields.custom.intensity_level` (integer `1` to `5`)
- `product.metafields.custom.space_tag` (e.g., `Mandir & Pooja`, `Living Room`, `Bedroom & Linen`)
- `product.metafields.custom.format_type` (e.g., `Blended Camphor`, `Room Spray`, `Linen Spray`, `Aroma Oil`)
- `product.metafields.custom.how_to_use` (multi-line text)
- `product.metafields.custom.related_formats` (list of product references for the Format Switcher)

## 5. Planned Custom Sections Roadmap
Build sections modularly so they can be arranged freely in `templates/index.json` and `templates/product.json`:
1. `sections/swick-hero.liquid` — Full-bleed mobile-first hero (4:5 mobile, 16:9 desktop) with video/image support and dual CTAs.
2. `sections/swick-category-bubbles.liquid` — Horizontally scrollable circular category pills under the hero.
3. `sections/swick-space-grid.liquid` & `sections/swick-trust-strip.liquid` — 2x2 "Shop by Space" lifestyle grid + 4-icon "Nature Bottled" trust bar.
4. `sections/swick-mood-tabs.liquid` & `snippets/swick-product-card.liquid` — Interactive "Shop by Scent Mood" tabbed slider + clean 2-col product cards with format sub-labels and AJAX `+ Quick Add`.
5. `sections/swick-scent-profile.liquid` — PDP Scent Notes breakdown, 1–5 Intensity Bar, and Format Switcher pills.
6. `sections/swick-cart-drawer.liquid` — Slide-out cart drawer with Free Shipping (`₹699`) progress bar, prepaid UPI discount note, and Discovery Kit upsell.

## 6. Workflow & Safety Guardrails
- **Validation:** After creating or editing any Liquid/CSS/JS file, run `shopify theme check` and fix all errors and high-priority warnings before finishing.
- **Live Store Protection:** **NEVER** run `shopify theme push` to the live/published theme. Only use `shopify theme dev --store w0i7sc-cn.myshopify.com` for local preview or `shopify theme push --unpublished` when explicitly requested.