import { DevotionalProductSeed } from './devotionalProductTypes';

export const flowersAndGarlandsProducts: DevotionalProductSeed[] = [
  {
    seedKey: 'devotional:flowers-garlands:jasmine-flowers:fresh-jasmine-loose-flowers',
    name: 'Fresh Jasmine (Mallepoolu) Loose Flowers',
    slug: 'fresh-jasmine-loose-flowers',
    subcategorySlug: 'flowers-garlands',
    childCategorySlug: 'jasmine-flowers',
    itemType: 'fresh_product',
    productMode: 'fresh',
    shortDescription: 'Farm-fresh fragrant Jasmine loose flowers harvested daily for deity worship and hair adornment.',
    keywords: ['jasmine flowers', 'mallepoolu', 'gundu malli', 'fresh flowers', 'pooja flowers'],
    tags: ['fresh-flowers', 'jasmine', 'mallepoolu'],
    supportedUnits: ['gram', 'kilogram'],
    inventoryRules: { mode: 'fresh', dailyStock: true, expiryDays: 1, sameDayAvailability: true },
    deliveryRules: { sameDay: true, homeDelivery: true },
    variantDefinitions: [
      { name: '100g Pack', skuSuffix: '100G', attributes: { weight: 100 } },
      { name: '250g Pack', skuSuffix: '250G', attributes: { weight: 250 } },
      { name: '500g Pack', skuSuffix: '500G', attributes: { weight: 500 } },
      { name: '1 kg Bulk Pack', skuSuffix: '1KG', attributes: { weight: 1000 } }
    ]
  },
  {
    seedKey: 'devotional:flowers-garlands:rose-flowers:fresh-rose-petals-loose-flowers',
    name: 'Fresh Red Rose Petals & Loose Roses',
    slug: 'fresh-rose-petals-loose-flowers',
    subcategorySlug: 'flowers-garlands',
    childCategorySlug: 'rose-flowers',
    itemType: 'fresh_product',
    productMode: 'fresh',
    shortDescription: 'Fresh red rose petals for deity abhishekam and thali offering.',
    keywords: ['rose flowers', 'rose petals', 'gulab poolu', 'fresh rose'],
    tags: ['fresh-flowers', 'rose'],
    supportedUnits: ['gram', 'kilogram'],
    inventoryRules: { mode: 'fresh', dailyStock: true, expiryDays: 1 },
    deliveryRules: { sameDay: true },
    variantDefinitions: [
      { name: '250g Pack', skuSuffix: '250G', attributes: { weight: 250 } },
      { name: '500g Pack', skuSuffix: '500G', attributes: { weight: 500 } }
    ]
  },
  {
    seedKey: 'devotional:flowers-garlands:jasmine-garlands:handcrafted-jasmine-deity-garland',
    name: 'Handcrafted Jasmine Deity Garland (Mallepoolu Danda)',
    slug: 'handcrafted-jasmine-deity-garland',
    subcategorySlug: 'flowers-garlands',
    childCategorySlug: 'jasmine-garlands',
    itemType: 'fresh_product',
    productMode: 'made_to_order',
    shortDescription: 'Tightly woven fresh jasmine flower garland custom-crafted for deity statues and photo frames.',
    keywords: ['jasmine garland', 'malle poola danda', 'flower garland', 'deity garland'],
    tags: ['garland', 'jasmine'],
    supportedUnits: ['foot', 'piece'],
    customizationRules: { allowCustomLength: true },
    inventoryRules: { mode: 'fresh', dailyStock: true },
    deliveryRules: { sameDay: true, fragile: true },
    variantDefinitions: [
      { name: '1 Foot Garland', skuSuffix: '1FT', attributes: { length: '1 foot' } },
      { name: '2 Feet Garland', skuSuffix: '2FT', attributes: { length: '2 feet' } },
      { name: '3 Feet Garland', skuSuffix: '3FT', attributes: { length: '3 feet' } },
      { name: '5 Feet Temple Garland', skuSuffix: '5FT', attributes: { length: '5 feet' } }
    ]
  },
  {
    seedKey: 'devotional:flowers-garlands:marigold-garlands:yellow-marigold-garland',
    name: 'Fresh Yellow & Orange Marigold Garland (Banthipoola Danda)',
    slug: 'yellow-marigold-garland',
    subcategorySlug: 'flowers-garlands',
    childCategorySlug: 'marigold-garlands',
    itemType: 'fresh_product',
    productMode: 'fresh',
    shortDescription: 'Vibrant marigold flower garland for door entrances, vehicles, and temple altars.',
    keywords: ['marigold garland', 'genda phool garland', 'banthipoola danda', 'toran garland'],
    tags: ['garland', 'marigold'],
    supportedUnits: ['foot', 'piece'],
    variantDefinitions: [
      { name: '2 Feet Garland', skuSuffix: '2FT', attributes: { length: '2 feet' } },
      { name: '4 Feet Garland', skuSuffix: '4FT', attributes: { length: '4 feet' } }
    ]
  },
  {
    seedKey: 'devotional:flowers-garlands:tulasi-leaves:fresh-sacred-tulasi-garland-leaves',
    name: 'Fresh Sacred Tulasi Garland & Leaves',
    slug: 'fresh-sacred-tulasi-garland-leaves',
    subcategorySlug: 'flowers-garlands',
    childCategorySlug: 'tulasi-leaves',
    itemType: 'fresh_product',
    productMode: 'fresh',
    shortDescription: 'Pure holy basil (Tulasi) leaves and handcrafted Tulasi garland for Vishnu and Krishna worship.',
    keywords: ['tulasi leaves', 'tulasi garland', 'holy basil', 'vishnu tulasi'],
    tags: ['tulasi', 'sacred-leaves'],
    supportedUnits: ['gram', 'piece'],
    inventoryRules: { mode: 'fresh', dailyStock: true },
    variantDefinitions: [
      { name: '100g Loose Tulasi Leaves', skuSuffix: '100G', attributes: { weight: 100 } },
      { name: '2 Feet Sacred Tulasi Garland', skuSuffix: '2FT', attributes: { length: '2 feet' } }
    ]
  }
];
