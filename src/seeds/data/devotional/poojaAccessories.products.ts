import { DevotionalProductSeed } from './devotionalProductTypes';

export const poojaAccessoriesProducts: DevotionalProductSeed[] = [
  {
    seedKey: 'devotional:brass-copper-pooja-accessories:brass-diyas:traditional-brass-kuthu-vilakku-diya',
    name: 'Traditional Brass Kuthu Vilakku Stand Diya',
    slug: 'traditional-brass-kuthu-vilakku-diya',
    subcategorySlug: 'brass-copper-pooja-accessories',
    childCategorySlug: 'brass-diyas',
    itemType: 'physical_product',
    productMode: 'standard',
    shortDescription: 'Classic multi-wick heavy brass oil lamp stand for temple and home altars.',
    keywords: ['brass diya', 'kuthu vilakku', 'brass oil lamp', 'deepam stand', 'diya lamp'],
    tags: ['diya', 'brass', 'accessories'],
    supportedUnits: ['pcs', 'pair'],
    deliveryRules: { fragile: true },
    variantDefinitions: [
      { name: '12 Inch Pair (2 Lamps)', skuSuffix: '12IN-PAIR', attributes: { height: '12 inches', count: 2 } },
      { name: '18 Inch Pair (2 Lamps)', skuSuffix: '18IN-PAIR', attributes: { height: '18 inches', count: 2 } },
      { name: '24 Inch Pair (2 Lamps)', skuSuffix: '24IN-PAIR', attributes: { height: '24 inches', count: 2 } }
    ]
  },
  {
    seedKey: 'devotional:brass-copper-pooja-accessories:brass-pooja-bells:sounding-brass-pooja-hand-bell',
    name: 'Clear Resonance Brass Pooja Hand Bell (Ghanti)',
    slug: 'sounding-brass-pooja-hand-bell',
    subcategorySlug: 'brass-copper-pooja-accessories',
    childCategorySlug: 'brass-pooja-bells',
    itemType: 'physical_product',
    productMode: 'standard',
    shortDescription: 'Traditional Garuda/Nandi engraved heavy brass bell for aarti and prayer sound resonance.',
    keywords: ['pooja bell', 'ghanti', 'brass bell', 'garuda bell', 'aarti bell'],
    tags: ['bell', 'ghanti', 'brass'],
    supportedUnits: ['pcs', 'piece'],
    variantDefinitions: [
      { name: 'Small (4 Inch)', skuSuffix: 'SML', attributes: { height: '4 inches', weight: 200 } },
      { name: 'Medium (6 Inch)', skuSuffix: 'MED', attributes: { height: '6 inches', weight: 450 } },
      { name: 'Large (8 Inch)', skuSuffix: 'LRG', attributes: { height: '8 inches', weight: 800 } }
    ]
  },
  {
    seedKey: 'devotional:brass-copper-pooja-accessories:brass-pooja-thalis:complete-brass-pooja-thali-set',
    name: 'Complete Brass Engraved Pooja Thali Set',
    slug: 'complete-brass-pooja-thali-set',
    subcategorySlug: 'brass-copper-pooja-accessories',
    childCategorySlug: 'brass-pooja-thalis',
    itemType: 'physical_product',
    productMode: 'standard',
    shortDescription: '7-piece engraved brass thali set including plate, small diya, bell, kalash, and roli cups.',
    keywords: ['pooja thali', 'brass thali set', 'aarti thali', 'pooja plate'],
    tags: ['thali', 'pooja-set', 'brass'],
    supportedUnits: ['set'],
    variantDefinitions: [
      { name: '7 Piece Standard Set', skuSuffix: '7PCS', attributes: { pieceCount: 7 } },
      { name: '11 Piece Deluxe Set', skuSuffix: '11PCS', attributes: { pieceCount: 11 } }
    ]
  }
];
