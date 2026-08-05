"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDailyNeedsTaxonomy = exports.DAILY_NEEDS_TAXONOMY = exports.makeSlug = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Category_1 = __importDefault(require("../models/Category"));
const CategoryProductSchema_1 = __importDefault(require("../models/CategoryProductSchema"));
dotenv_1.default.config();
const makeSlug = (name) => name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
exports.makeSlug = makeSlug;
exports.DAILY_NEEDS_TAXONOMY = [
    {
        name: 'Fruits and Vegetables',
        slug: 'fruits-and-vegetables',
        allowedCapabilities: [
            'vegetable_shop',
            'fruit_shop',
            'fresh_produce_store',
            'farmer',
            'farmer_producer_organization',
            'organic_farm',
            'wholesale_produce_vendor',
            'mobile_vegetable_van',
        ],
        productMode: 'fresh',
        supportedItemTypes: ['product'],
        inventoryMode: 'fresh_batch',
        attributes: [
            { key: 'produce_type', name: 'Produce Type', type: 'select', required: true, isVariant: false, options: ['Vegetable', 'Fruit', 'Herbs', 'Greens', 'Exotic', 'Dry Fruits', 'Combo'] },
            { key: 'origin_type', name: 'Origin Type', type: 'select', required: true, isVariant: false, options: ['local_farm', 'regional_market', 'wholesale_market', 'imported', 'own_farm'] },
            { key: 'grade', name: 'Produce Grade', type: 'select', required: true, isVariant: true, options: ['A', 'B', 'C', 'Premium'] },
            { key: 'organic_status', name: 'Organic Status', type: 'select', required: true, isVariant: true, options: ['regular', 'organic_claimed', 'organic_certified', 'natural'] },
            { key: 'harvest_date', name: 'Harvest Date', type: 'text', required: false, isVariant: false, placeholder: 'YYYY-MM-DD' },
            { key: 'freshness_level', name: 'Freshness Rating', type: 'select', required: false, isVariant: false, options: ['Same Day Harvest', 'Fresh Arrival', 'Standard'] },
            { key: 'storage_temperature', name: 'Storage Temperature', type: 'select', required: false, isVariant: false, options: ['ambient', 'chilled', 'temperature_controlled'] },
            { key: 'selling_unit', name: 'Selling Unit', type: 'select', required: true, isVariant: true, options: ['100 g', '250 g', '500 g', '750 g', '1 kg', '2 kg', 'Piece', 'Dozen', 'Bunch', 'Custom Weight'] },
            { key: 'custom_weight_allowed', name: 'Custom Weight Allowed', type: 'boolean', required: false, isVariant: false },
        ],
        childCategories: [
            { name: 'Leafy Greens' },
            { name: 'Root Vegetables' },
            { name: 'Seasonal Vegetables' },
            { name: 'Exotic Vegetables' },
            { name: 'Citrus Fruits' },
            { name: 'Tropical Fruits' },
            { name: 'Seasonal Fruits' },
            {
                name: 'Dry Fruits',
                inventoryMode: 'variant',
                extraAttributes: [
                    { key: 'dry_fruit_type', name: 'Dry Fruit Type', type: 'select', required: true, isVariant: true, options: ['Almonds', 'Cashews', 'Raisins', 'Pistachios', 'Walnuts', 'Dates', 'Figs', 'Mixed'] },
                    { key: 'roasted_or_raw', name: 'Processing State', type: 'select', required: true, isVariant: true, options: ['Raw', 'Roasted', 'Fried', 'Salted', 'Unsalted'] },
                ],
            },
            { name: 'Fresh Herbs and Leaves' },
            {
                name: 'Organic Fruits and Vegetables',
                extraAttributes: [
                    { key: 'organic_certification_type', name: 'Certification Agency', type: 'text', required: true, isVariant: false },
                    { key: 'organic_certificate_asset_id', name: 'Certificate Asset ID', type: 'text', required: false, isVariant: false },
                ],
            },
            {
                name: 'Fresh Produce Combo Baskets',
                productMode: 'combo',
                extraAttributes: [
                    { key: 'combo_name', name: 'Combo Basket Name', type: 'text', required: true, isVariant: false },
                    { key: 'basket_size', name: 'Basket Size', type: 'select', required: true, isVariant: true, options: ['Small', 'Medium', 'Family Pack', 'Jumbo'] },
                    { key: 'family_size', name: 'Suitable for Family Size', type: 'select', required: false, isVariant: false, options: ['1-2 members', '3-4 members', '5+ members'] },
                ],
            },
            {
                name: 'Wholesale Fresh Produce',
                productMode: 'wholesale',
                catalogueScope: 'vendor_procurement',
                extraAttributes: [
                    { key: 'moq', name: 'Minimum Order Quantity (MOQ)', type: 'number', required: true, isVariant: false, unit: 'kg' },
                    { key: 'tier_pricing', name: 'Tier Bulk Pricing Info', type: 'textarea', required: false, isVariant: false },
                ],
            },
        ],
    },
    {
        name: 'Milk and Dairy',
        slug: 'milk-and-dairy',
        allowedCapabilities: [
            'local_milk_vendor',
            'dairy_farm',
            'milk_booth',
            'organic_dairy',
            'dairy_distributor',
            'milk_collection_center',
        ],
        productMode: 'fresh',
        supportedItemTypes: ['product'],
        inventoryMode: 'chilled_batch',
        attributes: [
            { key: 'milk_type', name: 'Milk / Dairy Type', type: 'select', required: true, isVariant: true, options: ['cow', 'buffalo', 'a2', 'organic', 'toned', 'double_toned', 'full_cream', 'curd', 'ghee', 'paneer', 'cheese', 'butter', 'lassi'] },
            { key: 'brand_or_farm', name: 'Brand or Farm Name', type: 'text', required: true, isVariant: false },
            { key: 'fat_percentage', name: 'Fat Percentage (%)', type: 'number', required: false, isVariant: true, unit: '%' },
            { key: 'snf_percentage', name: 'SNF Percentage (%)', type: 'number', required: false, isVariant: false, unit: '%' },
            { key: 'pasteurized', name: 'Pasteurized', type: 'boolean', required: false, isVariant: false },
            { key: 'volume', name: 'Volume / Weight', type: 'select', required: true, isVariant: true, options: ['200 ml', '250 ml', '500 ml', '1 litre', '2 litres', '5 litres', '100 g', '250 g', '500 g', '1 kg'] },
            { key: 'packaging_type', name: 'Packaging Type', type: 'select', required: true, isVariant: true, options: ['pouch', 'bottle', 'glass_bottle', 'loose_container', 'packet', 'box', 'can'] },
            { key: 'storage_temperature', name: 'Storage Temp', type: 'select', required: true, isVariant: false, options: ['chilled', 'ambient', 'frozen'] },
            { key: 'manufacturing_date', name: 'Packing Date/Time', type: 'text', required: false, isVariant: false },
            { key: 'expiry_date', name: 'Expiry Date/Time', type: 'text', required: true, isVariant: false },
        ],
        childCategories: [
            { name: 'Cow Milk' },
            { name: 'Buffalo Milk' },
            { name: 'A2 and Organic Milk' },
            { name: 'Toned and Double Toned Milk' },
            { name: 'Full Cream Milk' },
            { name: 'Curd and Yogurt' },
            { name: 'Butter and Ghee', inventoryMode: 'batch_expiry' },
            { name: 'Paneer and Cheese' },
            { name: 'Cream and Buttermilk' },
            { name: 'Flavoured Milk and Lassi' },
            {
                name: 'Dairy Combo Packs',
                productMode: 'combo',
                extraAttributes: [
                    { key: 'combo_name', name: 'Dairy Pack Name', type: 'text', required: true, isVariant: false },
                    { key: 'morning_delivery', name: 'Morning Delivery Available', type: 'boolean', required: false, isVariant: false },
                ],
            },
            {
                name: 'Wholesale Dairy Supplies',
                productMode: 'wholesale',
                catalogueScope: 'vendor_procurement',
                extraAttributes: [
                    { key: 'moq', name: 'Minimum Order Quantity', type: 'number', required: true, isVariant: false, unit: 'litres/kg' },
                ],
            },
        ],
    },
    {
        name: 'Grocery and Staples',
        slug: 'grocery-and-staples',
        allowedCapabilities: [
            'kirana_store',
            'mini_mart',
            'supermarket',
            'organic_grocery_store',
            'wholesale_grocery',
            'dairy_fmcg_store',
            'fmcg_distributor',
        ],
        productMode: 'standard',
        supportedItemTypes: ['product'],
        inventoryMode: 'variant',
        attributes: [
            { key: 'brand', name: 'Brand Name', type: 'text', required: true, isVariant: false },
            { key: 'manufacturer', name: 'Manufacturer Name', type: 'text', required: false, isVariant: false },
            { key: 'barcode', name: 'Barcode / EAN', type: 'text', required: false, isVariant: false },
            { key: 'pack_size', name: 'Pack Size / Net Weight', type: 'text', required: true, isVariant: true },
            { key: 'veg_marker', name: 'Dietary Preference', type: 'select', required: false, isVariant: false, options: ['Veg', 'Non-Veg', 'Egg', 'Vegan'] },
            { key: 'shelf_life', name: 'Shelf Life (Days/Months)', type: 'text', required: false, isVariant: false },
            { key: 'batch_number', name: 'Batch Number', type: 'text', required: false, isVariant: false },
            { key: 'manufacturing_date', name: 'Manufacturing Date', type: 'text', required: false, isVariant: false },
            { key: 'expiry_date', name: 'Expiry Date', type: 'text', required: false, isVariant: false },
            { key: 'gst_rate', name: 'GST Rate (%)', type: 'number', required: false, isVariant: false, unit: '%' },
            { key: 'hsn_code', name: 'HSN Code', type: 'text', required: false, isVariant: false },
        ],
        childCategories: [
            { name: 'Rice and Grains' },
            { name: 'Wheat, Atta, Rava and Sooji' },
            { name: 'Pulses and Dal' },
            { name: 'Cooking Oils' },
            { name: 'Spices and Masalas' },
            { name: 'Salt, Sugar and Jaggery' },
            { name: 'Dry Fruits and Nuts' },
            { name: 'Biscuits, Chips and Namkeen' },
            { name: 'Tea, Coffee and Beverages' },
            { name: 'Bakery Essentials' },
            { name: 'Dairy and Chilled Grocery' },
            { name: 'Personal Care' },
            { name: 'Home Cleaning and Laundry' },
            { name: 'Baby Care' },
            { name: 'Pet Care' },
            { name: 'Organic and Special Diet Grocery' },
            {
                name: 'Subscription Essentials',
                productMode: 'subscription',
                catalogueScope: 'subscription_plan',
                extraAttributes: [
                    { key: 'plan_name', name: 'Subscription Plan Name', type: 'text', required: true, isVariant: false },
                    { key: 'frequency', name: 'Delivery Frequency', type: 'select', required: true, isVariant: false, options: ['daily', 'alternate_days', 'weekly', 'monthly', 'custom_days'] },
                    { key: 'pause_allowed', name: 'Pause Allowed', type: 'boolean', required: false, isVariant: false },
                ],
            },
            {
                name: 'Festival and Monthly Grocery Kits',
                productMode: 'combo',
                extraAttributes: [
                    { key: 'kit_name', name: 'Kit Name', type: 'text', required: true, isVariant: false },
                    { key: 'occasion', name: 'Occasion / Event', type: 'text', required: false, isVariant: false },
                ],
            },
        ],
    },
    {
        name: 'Water and Hydration',
        slug: 'water-and-hydration',
        allowedCapabilities: [
            'ro_water_plant',
            'mineral_water_supplier',
            'packaged_water_distributor',
            'local_water_can_supplier',
            'corporate_water_supplier',
        ],
        productMode: 'standard',
        supportedItemTypes: ['product'],
        inventoryMode: 'variant',
        attributes: [
            { key: 'water_type', name: 'Water Type', type: 'select', required: true, isVariant: true, options: ['RO Water', 'Mineral Water', 'Packaged Drinking Water', 'Spring Water', 'Alkaline Water'] },
            { key: 'brand', name: 'Brand Name', type: 'text', required: true, isVariant: false },
            { key: 'capacity_litres', name: 'Capacity (Litres)', type: 'select', required: true, isVariant: true, options: ['250 ml', '500 ml', '1 L', '2 L', '5 L', '10 L', '20 L'] },
            { key: 'purification_method', name: 'Purification Method', type: 'select', required: false, isVariant: false, options: ['RO', 'UV', 'UF', 'Ozonation', 'Multi-Stage'] },
            { key: 'bis_number', name: 'BIS Registration No.', type: 'text', required: false, isVariant: false },
            { key: 'fssai_number', name: 'FSSAI License No.', type: 'text', required: false, isVariant: false },
        ],
        childCategories: [
            {
                name: 'Returnable Water Cans',
                inventoryMode: 'returnable_asset',
                extraAttributes: [
                    { key: 'returnable', name: 'Returnable Can', type: 'boolean', required: true, isVariant: false },
                    { key: 'empty_can_return_required', name: 'Empty Can Return Required', type: 'boolean', required: true, isVariant: false },
                    { key: 'deposit_required', name: 'Deposit Required', type: 'boolean', required: true, isVariant: false },
                    { key: 'deposit_amount', name: 'Deposit Amount (₹)', type: 'number', required: true, isVariant: false, unit: 'INR' },
                    { key: 'lost_can_penalty', name: 'Lost Can Penalty (₹)', type: 'number', required: false, isVariant: false, unit: 'INR' },
                ],
            },
            { name: 'Disposable Water Cans' },
            { name: 'Bottled Water' },
            { name: 'Corporate and Bulk Water Supply', productMode: 'wholesale', catalogueScope: 'vendor_procurement' },
            { name: 'Water Dispensers' },
            { name: 'Manual and Electric Pumps' },
            { name: 'Water Stands and Accessories' },
            {
                name: 'Emergency and Subscription Water Plans',
                productMode: 'subscription',
                catalogueScope: 'subscription_plan',
                extraAttributes: [
                    { key: 'plan_name', name: 'Plan Name', type: 'text', required: true, isVariant: false },
                    { key: 'frequency', name: 'Delivery Frequency', type: 'select', required: true, isVariant: false, options: ['daily', 'alternate_days', 'weekly', 'monthly'] },
                ],
            },
        ],
    },
    {
        name: 'Organic and Healthy Foods',
        slug: 'organic-and-healthy-foods',
        allowedCapabilities: [
            'organic_food_store',
            'organic_farmer',
            'millet_store',
            'cold_pressed_oil_store',
            'natural_honey_producer',
            'herbal_food_store',
            'healthy_snack_store',
            'farm_to_home_supplier',
        ],
        productMode: 'standard',
        supportedItemTypes: ['product'],
        inventoryMode: 'batch_expiry',
        attributes: [
            { key: 'brand_or_farm', name: 'Brand or Farm Name', type: 'text', required: true, isVariant: false },
            { key: 'organic_status', name: 'Organic Certification Status', type: 'select', required: true, isVariant: true, options: ['Organic Certified', 'Organic Claimed', 'Natural / Chemical Free'] },
            { key: 'organic_certification_type', name: 'Certification Agency', type: 'text', required: false, isVariant: false },
            { key: 'organic_certificate_number', name: 'Certificate Number', type: 'text', required: false, isVariant: false },
            { key: 'farm_name', name: 'Farm / Origin Location', type: 'text', required: false, isVariant: false },
            { key: 'health_goal_tags', name: 'Health Tags', type: 'multiselect', required: false, isVariant: false, options: ['weight_loss', 'diabetic_friendly', 'high_protein', 'high_fiber', 'keto_friendly', 'heart_healthy', 'immunity', 'vegan', 'gluten_free'] },
            { key: 'qr_traceability_enabled', name: 'QR Traceability Enabled', type: 'boolean', required: false, isVariant: false },
        ],
        childCategories: [
            { name: 'Organic Rice and Grains' },
            { name: 'Millets, Quinoa and Oats' },
            { name: 'Organic Pulses and Dal' },
            { name: 'Cold Pressed Oils' },
            { name: 'Natural Sweeteners and Honey' },
            { name: 'Healthy Snacks and Energy Foods' },
            { name: 'Dry Fruits, Nuts and Seeds' },
            { name: 'Herbal and Wellness Foods' },
            { name: 'Organic Fruits and Vegetables', productMode: 'fresh', inventoryMode: 'fresh_batch' },
            { name: 'Nutrition and Wellness Kits', productMode: 'combo' },
            { name: 'Seasonal Subscription Boxes', productMode: 'subscription', catalogueScope: 'subscription_plan' },
            { name: 'Wholesale Organic Products', productMode: 'wholesale', catalogueScope: 'vendor_procurement' },
        ],
    },
    {
        name: 'Eggs, Meat and Seafood',
        slug: 'eggs-meat-and-seafood',
        allowedCapabilities: [
            'egg_vendor',
            'chicken_shop',
            'mutton_shop',
            'fish_market',
            'seafood_store',
            'meat_processing_unit',
            'organic_meat_farm',
            'frozen_meat_store',
        ],
        productMode: 'fresh',
        supportedItemTypes: ['product'],
        inventoryMode: 'fresh_batch',
        attributes: [
            { key: 'meat_or_seafood_type', name: 'Category Type', type: 'select', required: true, isVariant: false, options: ['Egg', 'Chicken', 'Mutton', 'Fish', 'Prawns', 'Seafood', 'Frozen Meat'] },
            { key: 'fresh_or_frozen', name: 'Fresh / Frozen State', type: 'select', required: true, isVariant: true, options: ['Fresh (Chilled)', 'Frozen', 'Live'] },
            { key: 'origin', name: 'Origin / Farm', type: 'text', required: false, isVariant: false },
            { key: 'selling_unit', name: 'Selling Unit', type: 'select', required: true, isVariant: true, options: ['250 g', '500 g', '750 g', '1 kg', 'Pack of 6', 'Pack of 12', 'Pack of 30'] },
            { key: 'storage_temperature', name: 'Storage Temperature', type: 'select', required: true, isVariant: false, options: ['chilled', 'frozen', 'temperature_controlled'] },
            { key: 'fssai_number', name: 'FSSAI License No.', type: 'text', required: false, isVariant: false },
            { key: 'hygiene_certified', name: 'Hygiene Certified', type: 'boolean', required: false, isVariant: false },
        ],
        childCategories: [
            {
                name: 'Fresh Eggs',
                inventoryMode: 'batch_expiry',
                extraAttributes: [
                    { key: 'bird_type', name: 'Bird Type', type: 'select', required: true, isVariant: true, options: ['chicken', 'duck', 'quail', 'country_chicken'] },
                    { key: 'pack_count', name: 'Pack Count', type: 'select', required: true, isVariant: true, options: ['6 pcs', '10 pcs', '12 pcs', '30 pcs tray'] },
                ],
            },
            {
                name: 'Organic and Specialty Eggs',
                inventoryMode: 'batch_expiry',
                extraAttributes: [
                    { key: 'organic_status', name: 'Organic Claim', type: 'select', required: true, isVariant: true, options: ['Organic Certified', 'Free Range', 'Cage Free', 'Omega 3 Enriched'] },
                ],
            },
            { name: 'Whole Chicken' },
            {
                name: 'Chicken Cuts',
                extraAttributes: [
                    { key: 'cut_type', name: 'Cut Preference', type: 'select', required: false, isVariant: true, options: ['Curry Cut', 'Biryani Cut', 'Drumsticks', 'Wings', 'Lollipops', 'Breast Strips'] },
                ],
            },
            { name: 'Chicken Boneless and Offal' },
            { name: 'Mutton Cuts' },
            { name: 'Mutton Boneless, Keema and Offal' },
            {
                name: 'Freshwater Fish',
                extraAttributes: [
                    { key: 'species', name: 'Fish Species', type: 'text', required: true, isVariant: true },
                    { key: 'cutting_options', name: 'Cleaning & Cutting Preference', type: 'multiselect', required: false, isVariant: false, options: ['Whole Cleaned', 'Curry Cut', 'Fillet', 'Steaks', 'Head Removed', 'Skin Removed'] },
                ],
            },
            {
                name: 'Marine Fish',
                extraAttributes: [
                    { key: 'species', name: 'Fish Species', type: 'text', required: true, isVariant: true },
                    { key: 'cutting_options', name: 'Cleaning & Cutting Preference', type: 'multiselect', required: false, isVariant: false, options: ['Whole Cleaned', 'Curry Cut', 'Fillet', 'Steaks', 'Head Removed', 'Skin Removed'] },
                ],
            },
            {
                name: 'Prawns and Shrimp',
                extraAttributes: [
                    { key: 'prawn_customization', name: 'Prawn Customization', type: 'multiselect', required: false, isVariant: false, options: ['Shell On', 'Cleaned & Deveined', 'Tail On', 'Tail Off'] },
                ],
            },
            { name: 'Crab and Lobster' },
            { name: 'Squid, Mussels and Other Seafood' },
            { name: 'Frozen and Processed Meat', inventoryMode: 'frozen_batch' },
            { name: 'Family and BBQ Combos', productMode: 'combo' },
            { name: 'Subscription Meat and Seafood Packs', productMode: 'subscription', catalogueScope: 'subscription_plan' },
            { name: 'Wholesale Meat and Seafood Supplies', productMode: 'wholesale', catalogueScope: 'vendor_procurement' },
        ],
    },
];
const seedDailyNeedsTaxonomy = async () => {
    console.log('[SeedDailyNeedsTaxonomy] Initializing Daily Needs taxonomy seeding...');
    // 1. Ensure Parent Category "Daily Needs"
    const parentCategory = await Category_1.default.findOneAndUpdate({ slug: 'daily-needs' }, {
        $set: {
            name: 'Daily Needs',
            slug: 'daily-needs',
            description: 'Fresh fruits, vegetables, milk, dairy, grocery, water, organic foods, eggs, meat and seafood.',
            level: 1,
            parentId: null,
            isActive: true,
            supportedItemTypes: ['product'],
            displayOrder: 3,
            sortOrder: 3,
            image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80',
            banner: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=1600&auto=format&fit=crop&q=80',
        },
    }, { upsert: true, new: true });
    console.log(`[SeedDailyNeedsTaxonomy] Parent Category initialized: ${parentCategory.name} (ID: ${parentCategory._id})`);
    let subCount = 0;
    let childCount = 0;
    let schemaCount = 0;
    // 2. Iterate through subcategories
    for (let sIdx = 0; sIdx < exports.DAILY_NEEDS_TAXONOMY.length; sIdx++) {
        const subDef = exports.DAILY_NEEDS_TAXONOMY[sIdx];
        // Create or update Subcategory (Level 2)
        const subCategory = await Category_1.default.findOneAndUpdate({ slug: subDef.slug }, {
            $set: {
                name: subDef.name,
                slug: subDef.slug,
                description: `Daily Needs subcategory for ${subDef.name}`,
                level: 2,
                parentId: parentCategory._id,
                isActive: true,
                supportedItemTypes: subDef.supportedItemTypes,
                attributes: subDef.attributes,
                displayOrder: sIdx + 1,
                sortOrder: sIdx + 1,
            },
        }, { upsert: true, new: true });
        subCount++;
        // Create or update Subcategory Base Schema (CategoryProductSchema)
        await CategoryProductSchema_1.default.findOneAndUpdate({ categoryId: subCategory._id }, {
            $set: {
                categoryId: subCategory._id,
                subcategoryId: undefined,
                isChildOverride: false,
                schemaVersion: 1,
                productMode: subDef.productMode,
                allowedVendorCapabilities: subDef.allowedCapabilities,
                allowedItemTypes: subDef.supportedItemTypes,
                attributes: subDef.attributes,
                variantAttributes: subDef.attributes.filter(a => a.isVariant).map(a => a.key),
                inventoryPolicy: {
                    mode: subDef.inventoryMode,
                    requiresBatch: subDef.inventoryMode.includes('batch'),
                    requiresExpiry: subDef.inventoryMode.includes('batch'),
                    supportsReservedStock: true,
                    supportsDamagedStock: true,
                    supportsRawMaterials: false,
                },
                deliveryPolicy: {
                    homeDelivery: true,
                    storePickup: true,
                    sameDay: subDef.productMode === 'fresh',
                    scheduled: true,
                    fragile: subDef.name.includes('Water') || subDef.name.includes('Eggs'),
                    mergedDelivery: true,
                    multiVendorDelivery: true,
                },
                compliancePolicy: {
                    requiredDocuments: subDef.name.includes('Milk') || subDef.name.includes('Meat') || subDef.name.includes('Organic') || subDef.name.includes('Grocery')
                        ? ['FSSAI License']
                        : [],
                    optionalDocuments: ['GST Certificate', 'Organic Certificate'],
                },
                isPublished: true,
            },
        }, { upsert: true, new: true });
        schemaCount++;
        // Clean up obsolete level 3 children under this subcategory
        const validChildSlugs = subDef.childCategories.map(c => c.slug || `${subDef.slug}-${(0, exports.makeSlug)(c.name)}`);
        const obsoleteChildren = await Category_1.default.find({ parentId: subCategory._id, level: 3, slug: { $nin: validChildSlugs } });
        if (obsoleteChildren.length > 0) {
            const obsoleteChildIds = obsoleteChildren.map(c => c._id);
            await CategoryProductSchema_1.default.deleteMany({ categoryId: { $in: obsoleteChildIds } });
            await Category_1.default.deleteMany({ _id: { $in: obsoleteChildIds } });
            console.log(`[SeedDailyNeedsTaxonomy] Cleared ${obsoleteChildren.length} obsolete children under subcategory: ${subDef.name}`);
        }
        // 3. Iterate through Child Categories (Level 3)
        for (let cIdx = 0; cIdx < subDef.childCategories.length; cIdx++) {
            const childDef = subDef.childCategories[cIdx];
            const childSlug = childDef.slug || `${subDef.slug}-${(0, exports.makeSlug)(childDef.name)}`;
            // Merge base subcategory attributes with child-specific extra attributes
            const combinedAttributes = [...subDef.attributes];
            if (childDef.extraAttributes && childDef.extraAttributes.length > 0) {
                childDef.extraAttributes.forEach(extra => {
                    const exists = combinedAttributes.some(a => a.key === extra.key);
                    if (!exists) {
                        combinedAttributes.push(extra);
                    }
                });
            }
            const childCategory = await Category_1.default.findOneAndUpdate({ slug: childSlug }, {
                $set: {
                    name: childDef.name,
                    slug: childSlug,
                    description: `${childDef.name} under ${subDef.name}`,
                    level: 3,
                    parentId: subCategory._id,
                    isActive: true,
                    supportedItemTypes: subDef.supportedItemTypes,
                    attributes: combinedAttributes,
                    displayOrder: cIdx + 1,
                    sortOrder: cIdx + 1,
                },
            }, { upsert: true, new: true });
            childCount++;
            const effectiveProductMode = childDef.productMode || subDef.productMode;
            const effectiveInventoryMode = childDef.inventoryMode || subDef.inventoryMode;
            // Upsert Child Category Override Schema
            await CategoryProductSchema_1.default.findOneAndUpdate({ categoryId: childCategory._id }, {
                $set: {
                    categoryId: childCategory._id,
                    subcategoryId: subCategory._id,
                    isChildOverride: true,
                    schemaVersion: 1,
                    productMode: effectiveProductMode,
                    allowedVendorCapabilities: subDef.allowedCapabilities,
                    allowedItemTypes: subDef.supportedItemTypes,
                    attributes: combinedAttributes,
                    variantAttributes: combinedAttributes.filter(a => a.isVariant).map(a => a.key),
                    inventoryPolicy: {
                        mode: effectiveInventoryMode,
                        requiresBatch: effectiveInventoryMode.includes('batch'),
                        requiresExpiry: effectiveInventoryMode.includes('batch'),
                        supportsReservedStock: true,
                        supportsDamagedStock: true,
                        supportsRawMaterials: false,
                    },
                    deliveryPolicy: {
                        homeDelivery: true,
                        storePickup: true,
                        sameDay: effectiveProductMode === 'fresh',
                        scheduled: true,
                        fragile: childDef.name.toLowerCase().includes('water') || childDef.name.toLowerCase().includes('egg') || childDef.name.toLowerCase().includes('glass'),
                        mergedDelivery: true,
                        multiVendorDelivery: true,
                    },
                    compliancePolicy: {
                        requiredDocuments: subDef.name.includes('Milk') || subDef.name.includes('Meat') || subDef.name.includes('Organic') || subDef.name.includes('Grocery')
                            ? ['FSSAI License']
                            : [],
                        optionalDocuments: ['GST Certificate', 'Organic Certificate'],
                    },
                    isPublished: true,
                },
            }, { upsert: true, new: true });
            schemaCount++;
        }
    }
    console.log(`[SeedDailyNeedsTaxonomy] Seeding completed successfully!`);
    console.log(`Summary: 1 Parent Category, ${subCount} Subcategories, ${childCount} Child Categories, ${schemaCount} Schemas.`);
    return {
        parentCount: 1,
        subCount,
        childCount,
        schemaCount,
    };
};
exports.seedDailyNeedsTaxonomy = seedDailyNeedsTaxonomy;
const runDirect = async () => {
    if (require.main === module) {
        try {
            const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
            await mongoose_1.default.connect(mongoURI);
            console.log('Connected to MongoDB. Running Daily Needs taxonomy seed...');
            await (0, exports.seedDailyNeedsTaxonomy)();
            process.exit(0);
        }
        catch (err) {
            console.error('Daily Needs Seed execution error:', err);
            process.exit(1);
        }
    }
};
runDirect();
