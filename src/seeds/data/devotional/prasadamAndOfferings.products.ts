import { DevotionalProductSeed } from './devotionalProductTypes';

export const prasadamAndOfferingsProducts: DevotionalProductSeed[] = [
  {
    seedKey: 'devotional:sweets-prasadam-offerings:laddu-prasadam:traditional-boondi-laddu-prasadam',
    name: 'Traditional Temple Boondi Laddu Prasadam',
    slug: 'traditional-boondi-laddu-prasadam',
    subcategorySlug: 'sweets-prasadam-offerings',
    childCategorySlug: 'laddu-prasadam',
    itemType: 'food_product',
    productMode: 'food',
    shortDescription: 'Pure ghee temple-style boondi laddu prasadam prepared under strict hygienic and devotional standards.',
    keywords: ['laddu prasadam', 'boondi laddu', 'temple laddu', 'prasadam sweets'],
    tags: ['prasadam', 'laddu', 'sweets'],
    supportedUnits: ['gram', 'pack', 'box'],
    complianceRules: { fssaiRequired: true },
    inventoryRules: { mode: 'batch_expiry', requiresBatch: true, requiresExpiry: true, expiryDays: 7 },
    variantDefinitions: [
      { name: '250g Pack (4 Laddus)', skuSuffix: '250G', attributes: { weight: 250, count: 4 } },
      { name: '500g Pack (8 Laddus)', skuSuffix: '500G', attributes: { weight: 500, count: 8 } },
      { name: '1 kg Pack (16 Laddus)', skuSuffix: '1KG', attributes: { weight: 1000, count: 16 } }
    ]
  },
  {
    seedKey: 'devotional:sweets-prasadam-offerings:pulihora-prasadam:authentic-temple-pulihora-prasadam',
    name: 'Authentic Temple Pulihora Prasadam (Tamarind Rice)',
    slug: 'authentic-temple-pulihora-prasadam',
    subcategorySlug: 'sweets-prasadam-offerings',
    childCategorySlug: 'pulihora-prasadam',
    itemType: 'food_product',
    productMode: 'food',
    shortDescription: 'Freshly prepared traditional tamarind rice prasadam seasoned with peanuts, curry leaves, and spices.',
    keywords: ['pulihora prasadam', 'tamarind rice', 'temple pulihora', 'chinthapandu pulihora'],
    tags: ['prasadam', 'pulihora'],
    supportedUnits: ['gram', 'kg', 'pack'],
    complianceRules: { fssaiRequired: true },
    inventoryRules: { mode: 'batch_expiry', requiresBatch: true, requiresExpiry: true, expiryDays: 1 },
    deliveryRules: { sameDay: true },
    variantDefinitions: [
      { name: '250g Container', skuSuffix: '250G', attributes: { weight: 250 } },
      { name: '500g Container', skuSuffix: '500G', attributes: { weight: 500 } },
      { name: '1 kg Catering Pack', skuSuffix: '1KG', attributes: { weight: 1000 } }
    ]
  },
  {
    seedKey: 'devotional:sweets-prasadam-offerings:panchamrut:sacred-panchamrutam-prasadam',
    name: 'Sacred Panchamrutam Offering',
    slug: 'sacred-panchamrutam-prasadam',
    subcategorySlug: 'sweets-prasadam-offerings',
    childCategorySlug: 'panchamrut',
    itemType: 'food_product',
    productMode: 'food',
    shortDescription: 'Traditional 5-nectar blend of milk, curd, ghee, honey, and sugar candy for abhishekam and prasadam.',
    keywords: ['panchamrutam', 'panchamrut', 'abhishekam prasadam', 'temple panchamrut'],
    tags: ['panchamrutam', 'prasadam'],
    supportedUnits: ['ml', 'pack'],
    complianceRules: { fssaiRequired: true },
    inventoryRules: { mode: 'batch_expiry', requiresBatch: true, requiresExpiry: true, expiryDays: 2 },
    variantDefinitions: [
      { name: '100ml Container', skuSuffix: '100ML', attributes: { volume: '100ml' } },
      { name: '250ml Container', skuSuffix: '250ML', attributes: { volume: '250ml' } }
    ]
  }
];
