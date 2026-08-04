"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.poojaKitsProducts = void 0;
exports.poojaKitsProducts = [
    {
        seedKey: 'devotional:pooja-kits-ritual-kits:daily-pooja-kit:daily-home-pooja-kit',
        name: 'Daily Home Pooja Kit',
        slug: 'daily-home-pooja-kit',
        subcategorySlug: 'pooja-kits-ritual-kits',
        childCategorySlug: 'daily-pooja-kit',
        itemType: 'combo',
        productMode: 'combo',
        shortDescription: 'Complete monthly package of essential daily pooja items including wicks, camphor, agarbatti, kumkum, and deepam oil.',
        keywords: ['daily pooja kit', 'home pooja pack', 'monthly pooja kit', 'pooja box'],
        tags: ['pooja-kit', 'daily-essential', 'combo'],
        supportedUnits: ['box', 'kit'],
        attributeValues: { kit_type: 'Complete Kit', instructions_included: true },
        variantDefinitions: [
            { name: 'Standard Kit', skuSuffix: 'STD', attributes: { kitLevel: 'Standard' } },
            { name: 'Premium Kit', skuSuffix: 'PREM', attributes: { kitLevel: 'Premium' } }
        ]
    },
    {
        seedKey: 'devotional:pooja-kits-ritual-kits:satyanarayana-vratham-kit:satyanarayana-vratham-pooja-kit',
        name: 'Sri Satyanarayana Vratham Complete Pooja Kit',
        slug: 'satyanarayana-vratham-pooja-kit',
        subcategorySlug: 'pooja-kits-ritual-kits',
        childCategorySlug: 'satyanarayana-vratham-kit',
        itemType: 'combo',
        productMode: 'combo',
        shortDescription: 'Authentic 32-item complete ritual kit curated for Satyanarayana Swamy Vratham.',
        keywords: ['satyanarayana vratham kit', 'vratham pooja items', 'satyanarayana pooja pack'],
        tags: ['vratham', 'satyanarayana', 'pooja-kit'],
        supportedUnits: ['box', 'kit'],
        complianceRules: { priestApproved: true },
        variantDefinitions: [
            { name: 'Basic Kit', skuSuffix: 'BASIC', attributes: { kitLevel: 'Basic' } },
            { name: 'Grand Complete Kit', skuSuffix: 'GRAND', attributes: { kitLevel: 'Grand' } }
        ]
    },
    {
        seedKey: 'devotional:pooja-kits-ritual-kits:gruhapravesam-kit:gruha-pravesham-pooja-kit',
        name: 'Gruha Pravesham Complete Homam & Pooja Kit',
        slug: 'gruha-pravesham-pooja-kit',
        subcategorySlug: 'pooja-kits-ritual-kits',
        childCategorySlug: 'gruhapravesam-kit',
        itemType: 'combo',
        productMode: 'combo',
        shortDescription: 'Comprehensive housewarming ritual kit with all samagri for Ganapathi Homam and Vastu Pooja.',
        keywords: ['gruha pravesham kit', 'housewarming pooja kit', 'homam samagri pack'],
        tags: ['housewarming', 'gruhapravesam', 'homam-kit'],
        supportedUnits: ['box', 'kit'],
        complianceRules: { priestApproved: true },
        variantDefinitions: [
            { name: 'Standard Homam Kit', skuSuffix: 'STD', attributes: { kitLevel: 'Standard' } },
            { name: 'Deluxe Homam Kit', skuSuffix: 'DLX', attributes: { kitLevel: 'Deluxe' } }
        ]
    },
    {
        seedKey: 'devotional:pooja-kits-ritual-kits:varalakshmi-vratham-kit:varalakshmi-vratham-pooja-kit',
        name: 'Varalakshmi Vratham Sacred Ritual Kit',
        slug: 'varalakshmi-vratham-pooja-kit',
        subcategorySlug: 'pooja-kits-ritual-kits',
        childCategorySlug: 'varalakshmi-vratham-kit',
        itemType: 'combo',
        productMode: 'combo',
        shortDescription: 'Traditional ritual kit containing Lakshmi kalasham accessories, sacred threads, and vratham samagri.',
        keywords: ['varalakshmi vratham kit', 'lakshmi pooja kit', 'varalakshmi pooja pack'],
        tags: ['vratham', 'varalakshmi', 'lakshmi-pooja'],
        supportedUnits: ['box', 'kit'],
        variantDefinitions: [
            { name: 'Standard Kit', skuSuffix: 'STD', attributes: { kitLevel: 'Standard' } },
            { name: 'With Garlands & Flowers', skuSuffix: 'FLW', attributes: { kitLevel: 'With Flowers' } }
        ]
    },
    {
        seedKey: 'devotional:pooja-kits-ritual-kits:vehicle-pooja-kit:new-vehicle-pooja-kit',
        name: 'New Vehicle Vahana Pooja Kit',
        slug: 'new-vehicle-pooja-kit',
        subcategorySlug: 'pooja-kits-ritual-kits',
        childCategorySlug: 'vehicle-pooja-kit',
        itemType: 'combo',
        productMode: 'combo',
        shortDescription: 'Convenient ritual kit for new car or bike vahana pooja with coconuts, lemons, garland and kumkum.',
        keywords: ['vehicle pooja kit', 'car pooja kit', 'vahana pooja pack'],
        tags: ['vehicle-pooja', 'vahana'],
        supportedUnits: ['kit'],
        variantDefinitions: [
            { name: 'Car & Heavy Vehicle Kit', skuSuffix: 'CAR', attributes: { vehicleType: 'Car' } },
            { name: 'Two Wheeler Bike Kit', skuSuffix: 'BIKE', attributes: { vehicleType: 'Bike' } }
        ]
    }
];
