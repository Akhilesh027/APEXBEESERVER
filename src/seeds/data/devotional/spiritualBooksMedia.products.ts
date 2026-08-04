import { DevotionalProductSeed } from './devotionalProductTypes';

export const spiritualBooksMediaProducts: DevotionalProductSeed[] = [
  {
    seedKey: 'devotional:spiritual-books-astrology-media:bhagavad-gita:srimad-bhagavad-gita-as-it-is-hardbound',
    name: 'Srimad Bhagavad Gita (Original Sanskrit & Translation)',
    slug: 'srimad-bhagavad-gita-as-it-is-hardbound',
    subcategorySlug: 'spiritual-books-astrology-media',
    childCategorySlug: 'bhagavad-gita',
    itemType: 'physical_product',
    productMode: 'standard',
    shortDescription: 'Hardbound edition of Srimad Bhagavad Gita featuring original slokas, transliteration, and commentary.',
    keywords: ['bhagavad gita', 'gita book', 'gita sanskrit english', 'spiritual book', 'gita telugu'],
    tags: ['book', 'bhagavad-gita', 'scripture'],
    supportedUnits: ['pcs', 'book'],
    variantDefinitions: [
      { name: 'English Edition', skuSuffix: 'ENG', attributes: { language: 'English', binding: 'Hardbound' } },
      { name: 'Telugu Edition', skuSuffix: 'TEL', attributes: { language: 'Telugu', binding: 'Hardbound' } },
      { name: 'Hindi Edition', skuSuffix: 'HIN', attributes: { language: 'Hindi', binding: 'Hardbound' } }
    ]
  },
  {
    seedKey: 'devotional:spiritual-books-astrology-media:rudraksha-mala:original-5-mukhi-rudraksha-japa-mala',
    name: 'Original 5 Mukhi Rudraksha Japa Mala (108+1 Beads)',
    slug: 'original-5-mukhi-rudraksha-japa-mala',
    subcategorySlug: 'spiritual-books-astrology-media',
    childCategorySlug: 'rudraksha-mala',
    itemType: 'physical_product',
    productMode: 'standard',
    shortDescription: 'Lab-certified natural 5 Mukhi Rudraksha rosary for meditation, japa, and spiritual wellness.',
    keywords: ['rudraksha mala', '5 mukhi rudraksha', 'japa mala', '108 beads mala', 'certified rudraksha'],
    tags: ['rudraksha', 'mala', 'japa'],
    supportedUnits: ['pcs', 'piece'],
    attributeValues: { beadCount: 109, rudrakshaMukhi: '5 Mukhi', certificationAvailable: true },
    variantDefinitions: [
      { name: '6mm Bead Size', skuSuffix: '6MM', attributes: { beadSize: '6mm' } },
      { name: '8mm Bead Size', skuSuffix: '8MM', attributes: { beadSize: '8mm' } }
    ]
  },
  {
    seedKey: 'devotional:spiritual-books-astrology-media:devotional-audio-albums:sacred-mantras-devotional-audio-digital',
    name: 'Sri Venkateswara Suprabhatam & Sacred Stotrams Audio Album',
    slug: 'sacred-mantras-devotional-audio-digital',
    subcategorySlug: 'spiritual-books-astrology-media',
    childCategorySlug: 'devotional-audio-albums',
    itemType: 'digital_product',
    productMode: 'digital',
    shortDescription: 'High-quality digital audio album featuring authentic daily morning stotrams and chants.',
    keywords: ['suprabhatam audio', 'devotional album', 'stotrams mp3', 'digital audio'],
    tags: ['digital', 'audio', 'suprabhatam'],
    supportedUnits: ['digital_download'],
    mediaRules: { audioFormat: 'MP3 320kbps / FLAC' },
    variantDefinitions: [
      { name: 'Digital MP3 Album', skuSuffix: 'MP3', attributes: { format: 'MP3' } }
    ]
  }
];
