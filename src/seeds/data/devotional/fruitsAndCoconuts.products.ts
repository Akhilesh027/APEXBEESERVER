import { DevotionalProductSeed } from './devotionalProductTypes';

export const fruitsAndCoconutsProducts: DevotionalProductSeed[] = [
  {
    seedKey: 'devotional:fruits-coconuts:pooja-coconuts:sacred-pooja-coconut',
    name: 'Sacred Pooja Coconut (Kobbari Kaya)',
    slug: 'sacred-pooja-coconut',
    subcategorySlug: 'fruits-coconuts',
    childCategorySlug: 'pooja-coconuts',
    itemType: 'fresh_product',
    productMode: 'fresh',
    shortDescription: 'Specially selected fresh husked coconut suitable for temple breaking and altar offerings.',
    keywords: ['pooja coconut', 'kobbari kaya', 'nariyal', 'sacred coconut', 'breaking coconut'],
    tags: ['coconut', 'pooja-essential'],
    supportedUnits: ['pcs', 'pack'],
    inventoryRules: { mode: 'fresh', dailyStock: true },
    variantDefinitions: [
      { name: 'Single Coconut', skuSuffix: '1P', attributes: { pieceCount: 1 } },
      { name: 'Pack of 5 Coconuts', skuSuffix: '5P', attributes: { pieceCount: 5 } },
      { name: 'Pack of 11 Coconuts', skuSuffix: '11P', attributes: { pieceCount: 11 } }
    ]
  },
  {
    seedKey: 'devotional:fruits-coconuts:five-fruit-pooja-combos:pancha-phala-five-fruit-offering-combo',
    name: 'Pancha Phala (5-Fruit) Sacred Offering Basket',
    slug: 'pancha-phala-five-fruit-offering-combo',
    subcategorySlug: 'fruits-coconuts',
    childCategorySlug: 'five-fruit-pooja-combos',
    itemType: 'combo',
    productMode: 'combo',
    shortDescription: 'Fresh 5-fruit basket featuring bananas, apples, pomegranates, oranges, and mangoes for deity prasadam.',
    keywords: ['5 fruit combo', 'pancha phala', 'pooja fruit basket', 'offering fruits'],
    tags: ['fruits', 'pooja-combo'],
    supportedUnits: ['basket', 'pack'],
    deliveryRules: { sameDay: true },
    variantDefinitions: [
      { name: 'Standard 5-Fruit Basket', skuSuffix: 'STD', attributes: { itemQuantity: 5 } }
    ]
  },
  {
    seedKey: 'devotional:fruits-coconuts:betel-leaf-packs:fresh-betel-leaves-pack',
    name: 'Fresh Betel Leaves (Tamalapaku) Pack',
    slug: 'fresh-betel-leaves-pack',
    subcategorySlug: 'fruits-coconuts',
    childCategorySlug: 'betel-leaf-packs',
    itemType: 'fresh_product',
    productMode: 'fresh',
    shortDescription: 'Fresh green betel leaves carefully cleaned and prepared for tamboolam and vratham offerings.',
    keywords: ['betel leaves', 'tamalapaku', 'paan leaves', 'tamboolam leaves'],
    tags: ['betel-leaves', 'fresh'],
    supportedUnits: ['pcs', 'pack'],
    variantDefinitions: [
      { name: 'Pack of 25 Leaves', skuSuffix: '25P', attributes: { pieceCount: 25 } },
      { name: 'Pack of 100 Leaves', skuSuffix: '100P', attributes: { pieceCount: 100 } }
    ]
  }
];
