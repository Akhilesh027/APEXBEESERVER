# Devotional Product Master Seed Execution Report

- **Environment**: `development`
- **Execution Timestamp**: `2026-08-04T05:12:47.568Z`
- **Overall Status**: **SUCCESS**

---

## Executive Summary

| Metric | Count |
| :--- | :--- |
| **Total Seed Definitions** | 45 |
| **Inserted Product Masters** | 0 |
| **Updated Product Masters** | 45 |
| **Skipped Products** | 0 |
| **Failed Products** | 0 |
| **Inserted Catalogue Variants** | 0 |
| **Updated Catalogue Variants** | 100 |

---

## Database Integrity Audits

| Audit Indicator | Result | Status |
| :--- | :--- | :--- |
| **Duplicate Seed Keys** | 0 | ✓ PASS |
| **Orphan System Products** | 0 | ✓ PASS |
| **Invalid Category References** | 0 | ✓ PASS |
| **Accidental StoreProduct Records** | 0 | ✓ PASS |
| **Accidental Inventory Records** | 0 | ✓ PASS |

---

## Subcategory Product Breakdown

- **pooja-essentials**: 10 products
- **pooja-kits-ritual-kits**: 5 products
- **festival-combos**: 4 products
- **flowers-garlands**: 5 products
- **fruits-coconuts**: 3 products
- **sweets-prasadam-offerings**: 3 products
- **idols-frames-spiritual-decor**: 3 products
- **brass-copper-pooja-accessories**: 3 products
- **spiritual-books-astrology-media**: 3 products
- **temple-priest-devotional-services**: 3 products
- **devotional-wholesale-supplies**: 3 products

---

## Child Category Product Breakdown

- **agarbatti**: 2 products
- **dhoop**: 1 products
- **camphor**: 1 products
- **cotton-wicks**: 1 products
- **kumkum**: 1 products
- **turmeric**: 1 products
- **deepam-oil**: 1 products
- **ghee-for-pooja**: 1 products
- **vibhuti**: 1 products
- **daily-pooja-kit**: 1 products
- **satyanarayana-vratham-kit**: 1 products
- **gruhapravesam-kit**: 1 products
- **varalakshmi-vratham-kit**: 1 products
- **vehicle-pooja-kit**: 1 products
- **diwali-pooja-combo**: 1 products
- **ganesh-chaturthi-pooja-combo**: 1 products
- **navratri-pooja-combo**: 1 products
- **sankranti-pooja-combo**: 1 products
- **jasmine-flowers**: 1 products
- **rose-flowers**: 1 products
- **jasmine-garlands**: 1 products
- **marigold-garlands**: 1 products
- **tulasi-leaves**: 1 products
- **pooja-coconuts**: 1 products
- **five-fruit-pooja-combos**: 1 products
- **betel-leaf-packs**: 1 products
- **laddu-prasadam**: 1 products
- **pulihora-prasadam**: 1 products
- **panchamrut**: 1 products
- **ganesha-idols**: 1 products
- **venkateswara-photo-frames**: 1 products
- **om-wall-decor**: 1 products
- **brass-diyas**: 1 products
- **brass-pooja-bells**: 1 products
- **brass-pooja-thalis**: 1 products
- **bhagavad-gita**: 1 products
- **rudraksha-mala**: 1 products
- **devotional-audio-albums**: 1 products
- **priest-booking**: 1 products
- **satyanarayana-vratham-service**: 1 products
- **astrology-consultation**: 1 products
- **agarbatti-master-cartons**: 1 products
- **camphor-master-cartons**: 1 products
- **brass-diya-wholesale-packs**: 1 products

---

## Verification & Idempotency Notes
- System products have `catalogueSource = "system"` and `isCatalogueMaster = true`.
- Deterministic `seedKey` identifiers preserve records without duplicates during multiple seed runs.
- Vendor price, discount, inventory, and custom vendor store products were not overwritten.
