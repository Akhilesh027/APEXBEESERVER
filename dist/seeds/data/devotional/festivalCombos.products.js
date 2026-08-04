"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.festivalCombosProducts = void 0;
exports.festivalCombosProducts = [
    {
        seedKey: 'devotional:festival-combos:diwali-pooja-combo:diwali-lakshmi-pooja-combo',
        name: 'Diwali Lakshmi Pooja Festival Combo',
        slug: 'diwali-lakshmi-pooja-combo',
        subcategorySlug: 'festival-combos',
        childCategorySlug: 'diwali-pooja-combo',
        itemType: 'combo',
        productMode: 'combo',
        shortDescription: 'Festival gift and ritual combo for Diwali including brass diyas, kamal gatta, lotus flowers, and prasadam sweets.',
        keywords: ['diwali pooja combo', 'lakshmi pooja combo', 'diwali gift box'],
        tags: ['diwali', 'festival-combo'],
        supportedUnits: ['pack', 'box'],
        deliveryRules: { preOrderClosingHours: 24 },
        variantDefinitions: [
            { name: 'Family Combo', skuSuffix: 'FAM', attributes: { comboTier: 'Family' } },
            { name: 'Corporate Gift Pack', skuSuffix: 'CORP', attributes: { comboTier: 'Corporate Gift' } }
        ]
    },
    {
        seedKey: 'devotional:festival-combos:ganesh-chaturthi-pooja-combo:ganesh-chaturthi-vratham-combo',
        name: 'Ganesh Chaturthi Eco-Pooja Combo',
        slug: 'ganesh-chaturthi-vratham-combo',
        subcategorySlug: 'festival-combos',
        childCategorySlug: 'ganesh-chaturthi-pooja-combo',
        itemType: 'combo',
        productMode: 'combo',
        shortDescription: 'Complete Vinayaka Chaturthi combo with clay Ganesha idol, 21 Patri leaves, modak prasadam, and garika grass.',
        keywords: ['ganesh chaturthi combo', 'vinayaka chaturthi pack', 'eco ganesha combo'],
        tags: ['ganesh-chaturthi', 'festival-combo'],
        supportedUnits: ['pack', 'box'],
        variantDefinitions: [
            { name: 'Home Eco Combo', skuSuffix: 'HOME', attributes: { comboTier: 'Home' } },
            { name: 'Grand Festival Pack', skuSuffix: 'GRAND', attributes: { comboTier: 'Grand' } }
        ]
    },
    {
        seedKey: 'devotional:festival-combos:navratri-pooja-combo:navratri-durga-pooja-combo',
        name: 'Navratri Durga Pooja 9-Day Festival Pack',
        slug: 'navratri-durga-pooja-combo',
        subcategorySlug: 'festival-combos',
        childCategorySlug: 'navratri-pooja-combo',
        itemType: 'combo',
        productMode: 'combo',
        shortDescription: '9-day complete offerings and chunri pack for Navratri Devi Pooja.',
        keywords: ['navratri combo', 'durga pooja pack', 'navratri offerings'],
        tags: ['navratri', 'durga', 'festival-combo'],
        supportedUnits: ['pack', 'box'],
        variantDefinitions: [
            { name: 'Standard 9-Day Pack', skuSuffix: 'STD', attributes: { comboTier: 'Standard' } }
        ]
    },
    {
        seedKey: 'devotional:festival-combos:sankranti-pooja-combo:sankranti-pongal-pooja-combo',
        name: 'Makar Sankranti & Pongal Harvest Festival Combo',
        slug: 'sankranti-pongal-pooja-combo',
        subcategorySlug: 'festival-combos',
        childCategorySlug: 'sankranti-pooja-combo',
        itemType: 'combo',
        productMode: 'combo',
        shortDescription: 'Traditional harvest festival pack with fresh sugarcane, clay pot, new rice, jaggery, and turmeric plant.',
        keywords: ['sankranti combo', 'pongal pack', 'makar sankranti pooja'],
        tags: ['sankranti', 'pongal'],
        supportedUnits: ['pack'],
        variantDefinitions: [
            { name: 'Traditional Harvest Pack', skuSuffix: 'TRAD', attributes: { comboTier: 'Traditional' } }
        ]
    }
];
