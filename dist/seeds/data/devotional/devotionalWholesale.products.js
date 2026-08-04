"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.devotionalWholesaleProducts = void 0;
exports.devotionalWholesaleProducts = [
    {
        seedKey: 'devotional:devotional-wholesale-supplies:agarbatti-master-cartons:agarbatti-wholesale-master-carton',
        name: 'Sandalwood & Rose Agarbatti Wholesale Master Carton',
        slug: 'agarbatti-wholesale-master-carton',
        subcategorySlug: 'devotional-wholesale-supplies',
        childCategorySlug: 'agarbatti-master-cartons',
        itemType: 'wholesale',
        productMode: 'wholesale',
        shortDescription: 'Bulk wholesale carton containing 240 retail packs of premium incense sticks for retailers and temple stalls.',
        keywords: ['agarbatti wholesale', 'master carton', 'bulk incense', 'wholesale agarbatti'],
        tags: ['wholesale', 'agarbatti', 'bulk'],
        supportedUnits: ['carton', 'box'],
        complianceRules: { businessVerificationRequired: true },
        wholesaleRules: {
            minimumOrderQuantity: 1,
            minimumOrderUnit: 'carton',
            unitsPerCarton: 240,
            cartonWeight: 12.5
        },
        variantDefinitions: [
            { name: '240 Packs Master Carton', skuSuffix: '240P', attributes: { cartonCapacity: 240 } }
        ]
    },
    {
        seedKey: 'devotional:devotional-wholesale-supplies:camphor-master-cartons:pure-bhimseni-camphor-bulk-carton',
        name: 'Pure Bhimseni Camphor Wholesale Bulk Carton (10 kg)',
        slug: 'pure-bhimseni-camphor-bulk-carton',
        subcategorySlug: 'devotional-wholesale-supplies',
        childCategorySlug: 'camphor-master-cartons',
        itemType: 'wholesale',
        productMode: 'wholesale',
        shortDescription: '10 kg bulk wholesale box of pure Bhimseni camphor for temples, distributors, and event organizers.',
        keywords: ['camphor wholesale', 'bulk camphor', 'kapoor wholesale', '10kg camphor'],
        tags: ['wholesale', 'camphor', 'bulk'],
        supportedUnits: ['carton', 'kg'],
        complianceRules: { businessVerificationRequired: true },
        wholesaleRules: {
            minimumOrderQuantity: 1,
            minimumOrderUnit: 'carton',
            unitsPerCarton: 1,
            cartonWeight: 10
        },
        variantDefinitions: [
            { name: '10 kg Bulk Carton', skuSuffix: '10KG', attributes: { weight: 10000 } },
            { name: '25 kg Bulk Drum', skuSuffix: '25KG', attributes: { weight: 25000 } }
        ]
    },
    {
        seedKey: 'devotional:devotional-wholesale-supplies:brass-diya-wholesale-packs:brass-diya-wholesale-retailer-pack',
        name: 'Brass Diya & Lamp Wholesale Retailer Pack (50 Pcs)',
        slug: 'brass-diya-wholesale-retailer-pack',
        subcategorySlug: 'devotional-wholesale-supplies',
        childCategorySlug: 'brass-diya-wholesale-packs',
        itemType: 'wholesale',
        productMode: 'wholesale',
        shortDescription: 'Bulk wholesale bundle of 50 solid brass handcrafted diyas for resale during festival seasons.',
        keywords: ['brass diya wholesale', 'bulk diyas', 'wholesale oil lamps', 'diya bundle'],
        tags: ['wholesale', 'diya', 'brass'],
        supportedUnits: ['box', 'pack'],
        complianceRules: { businessVerificationRequired: true },
        wholesaleRules: {
            minimumOrderQuantity: 1,
            minimumOrderUnit: 'box',
            unitsPerCarton: 50
        },
        variantDefinitions: [
            { name: '50 Pieces Box', skuSuffix: '50PCS', attributes: { pieceCount: 50 } }
        ]
    }
];
