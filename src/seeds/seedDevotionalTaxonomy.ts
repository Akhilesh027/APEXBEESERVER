import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category';
import CategoryProductSchema from '../models/CategoryProductSchema';

dotenv.config();

const makeSlug = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export interface IDevotionalTaxonomySubcategory {
  name: string;
  slug: string;
  allowedCapabilities: string[];
  productMode: 'standard' | 'fresh' | 'food' | 'customizable' | 'made_to_order' | 'combo' | 'subscription' | 'wholesale' | 'digital' | 'not_applicable';
  supportedItemTypes: ('product' | 'service' | 'event')[];
  attributes: Array<{
    key: string;
    name: string;
    type: 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'textarea';
    required: boolean;
    isVariant: boolean;
    options?: string[];
    unit?: string;
  }>;
  childCategories: string[];
}

export const DEVOTIONAL_TAXONOMY: IDevotionalTaxonomySubcategory[] = [
  {
    name: 'Pooja Essentials',
    slug: 'pooja-essentials',
    allowedCapabilities: ['pooja_store', 'pooja_items_manufacturer', 'devotional_wholesaler'],
    productMode: 'standard',
    supportedItemTypes: ['product'],
    attributes: [
      { key: 'fragrance', name: 'Fragrance', type: 'select', required: true, isVariant: true, options: ['Sandalwood', 'Jasmine', 'Rose', 'Camphor', 'Natural Herb', 'Unscented'] },
      { key: 'pack_count', name: 'Pack Count / Quantity', type: 'number', required: true, isVariant: false, unit: 'pcs' },
      { key: 'purity_grade', name: 'Purity Grade', type: 'select', required: false, isVariant: false, options: ['Grade A Premium', 'Standard', 'Organic'] },
    ],
    childCategories: [
      'Agarbatti', 'Dhoop', 'Camphor', 'Cotton Wicks', 'Kumkum', 'Turmeric',
      'Sandal Powder', 'Deepam Oil', 'Ghee for Pooja', 'Matchboxes and Lighters',
      'Pooja Powders', 'Akshinthalu and Rice', 'Betel Leaves', 'Betel Nuts',
      'Sacred Threads', 'Vibhuti', 'Sindoor', 'Daily Pooja Packs',
    ],
  },
  {
    name: 'Pooja Kits and Ritual Kits',
    slug: 'pooja-kits-ritual-kits',
    allowedCapabilities: ['pooja_store', 'pooja_items_manufacturer', 'temple_service_partner', 'priest_pandit'],
    productMode: 'standard',
    supportedItemTypes: ['product'],
    attributes: [
      { key: 'kit_type', name: 'Kit Type', type: 'select', required: true, isVariant: false, options: ['Complete Kit', 'Mini Kit', 'Custom Kit'] },
      { key: 'people_supported', name: 'People Supported', type: 'number', required: false, isVariant: false, unit: 'persons' },
      { key: 'instructions_included', name: 'Book / Instructions Included', type: 'boolean', required: false, isVariant: false },
    ],
    childCategories: [
      'Daily Pooja Kit', 'Archana Kit', 'Abhishekam Kit', 'Homam Kit',
      'Satyanarayana Vratham Kit', 'Varalakshmi Vratham Kit', 'Gruhapravesam Kit',
      'Wedding Pooja Kit', 'Naming Ceremony Kit', 'Upanayanam Kit', 'Ayudha Pooja Kit',
      'Vehicle Pooja Kit', 'Office Opening Pooja Kit', 'Bhoomi Pooja Kit',
      'Navagraha Pooja Kit', 'Custom Pooja Kit',
    ],
  },
  {
    name: 'Festival Combos',
    slug: 'festival-combos',
    allowedCapabilities: ['pooja_store', 'flower_shop', 'coconut_shop', 'fruit_shop', 'sweet_shop', 'prasadam_partner', 'temple_service_partner'],
    productMode: 'combo',
    supportedItemTypes: ['product'],
    attributes: [
      { key: 'combo_tier', name: 'Combo Tier', type: 'select', required: true, isVariant: false, options: ['Basic', 'Standard', 'Family', 'Premium', 'Temple', 'Custom'] },
      { key: 'festival_name', name: 'Associated Festival', type: 'text', required: true, isVariant: false },
      { key: 'booking_cutoff_hours', name: 'Cutoff Hours Before Festival', type: 'number', required: false, isVariant: false, unit: 'hours' },
    ],
    childCategories: [
      'Vinayaka Chavithi Combo', 'Varalakshmi Vratham Combo', 'Navaratri Combo',
      'Dasara Combo', 'Diwali Combo', 'Sankranti Combo', 'Ugadi Combo',
      'Srirama Navami Combo', 'Krishna Janmashtami Combo', 'Maha Shivaratri Combo',
      'Karthika Masam Combo', 'Hanuman Jayanti Combo', 'Guru Pournami Combo',
      'Bonalu Combo', 'Bathukamma Combo', 'Raksha Bandhan Combo', 'Holi Combo',
      'Christmas Devotional Combo', 'Ramzan and Eid Offering Combo', 'Custom Festival Combo',
    ],
  },
  {
    name: 'Flowers and Garlands',
    slug: 'flowers-garlands',
    allowedCapabilities: ['flower_shop', 'decoration_shop', 'temple_service_partner', 'devotional_wholesaler'],
    productMode: 'fresh',
    supportedItemTypes: ['product'],
    attributes: [
      { key: 'flower_type', name: 'Flower Type / Specie', type: 'select', required: true, isVariant: true, options: ['Jasmine', 'Rose', 'Marigold', 'Lotus', 'Chrysanthemum', 'Kanakambaram', 'Mixed Loose'] },
      { key: 'selling_unit', name: 'Selling Unit', type: 'select', required: true, isVariant: false, options: ['Grams', 'Kg', 'Garland Length (Meters)', 'Strings', 'Pieces'] },
      { key: 'freshness_hours', name: 'Freshness Duration (Hours)', type: 'number', required: true, isVariant: false, unit: 'hours' },
      { key: 'same_day_delivery', name: 'Same Day Delivery Available', type: 'boolean', required: false, isVariant: false },
    ],
    childCategories: [
      'Jasmine', 'Rose', 'Marigold', 'Lotus', 'Chrysanthemum', 'Kanakambaram',
      'Mixed Loose Flowers', 'Tulasi Leaves', 'Bilva Leaves', 'Mango Leaves',
      'Banana Leaves', 'Small Garlands', 'Deity Garlands', 'Door Garlands',
      'Wedding Garlands', 'Temple Garlands', 'Custom Garlands',
    ],
  },
  {
    name: 'Fruits and Coconuts',
    slug: 'fruits-coconuts',
    allowedCapabilities: ['coconut_shop', 'fruit_shop', 'pooja_store', 'devotional_wholesaler'],
    productMode: 'fresh',
    supportedItemTypes: ['product'],
    attributes: [
      { key: 'variety', name: 'Variety / Grade', type: 'select', required: true, isVariant: true, options: ['Grade A Fresh', 'Standard', 'Organic', 'Decorated Special'] },
      { key: 'selling_unit', name: 'Selling Unit', type: 'select', required: true, isVariant: false, options: ['Pieces', 'Kg', 'Pack of 5', 'Pack of 10', 'Basket'] },
      { key: 'pooja_suitable', name: 'Pooja Sanctified / Suitable', type: 'boolean', required: true, isVariant: false },
    ],
    childCategories: [
      'Pooja Coconut', 'Husked Coconut', 'Decorated Coconut', 'Banana', 'Apple',
      'Pomegranate', 'Orange', 'Sweet Lime', 'Grapes', 'Mango', 'Seasonal Fruits',
      'Mixed Fruit Pack', 'Pooja Fruit Basket', 'Bulk Temple Fruit Pack',
    ],
  },
  {
    name: 'Sweets, Prasadam and Offerings',
    slug: 'sweets-prasadam-offerings',
    allowedCapabilities: ['sweet_shop', 'prasadam_partner', 'temple_service_partner'],
    productMode: 'food',
    supportedItemTypes: ['product'],
    attributes: [
      { key: 'prasadam_type', name: 'Prasadam / Sweet Type', type: 'select', required: true, isVariant: true, options: ['Laddu', 'Modak', 'Pulihora', 'Pongal', 'Payasam', 'Vada', 'Sweet Box'] },
      { key: 'pack_weight', name: 'Pack Weight', type: 'select', required: true, isVariant: true, options: ['250g', '500g', '1kg', '2kg', 'Bulk'] },
      { key: 'shelf_life_days', name: 'Shelf Life (Days)', type: 'number', required: true, isVariant: false, unit: 'days' },
      { key: 'fssai_number', name: 'FSSAI License Number', type: 'text', required: true, isVariant: false },
    ],
    childCategories: [
      'Laddu', 'Boondi Laddu', 'Modak', 'Pulihora', 'Curd Rice', 'Pongal',
      'Sweet Pongal', 'Payasam', 'Panakam', 'Vada', 'Prasadam Packs',
      'Temple Prasadam', 'Festival Sweet Boxes', 'Dry Fruit Offering Boxes',
      'Custom Prasadam Order', 'Bulk Temple Prasadam',
    ],
  },
  {
    name: 'Idols, Frames and Spiritual Decor',
    slug: 'idols-frames-spiritual-decor',
    allowedCapabilities: ['idol_statue_shop', 'photo_frame_shop', 'digital_printing_shop', 'pooja_store', 'devotional_wholesaler'],
    productMode: 'customizable',
    supportedItemTypes: ['product'],
    attributes: [
      { key: 'deity_name', name: 'Deity / Subject', type: 'select', required: true, isVariant: true, options: ['Lord Ganesha', 'Lord Shiva', 'Lord Venkateswara', 'Goddess Lakshmi', 'Goddess Durga', 'Lord Krishna', 'Sai Baba', 'Hanuman', 'Ayyappa', 'Other'] },
      { key: 'material', name: 'Material', type: 'select', required: true, isVariant: true, options: ['Brass', 'Marble', 'Clay / Eco-Friendly', 'Wood', 'Silver', 'Gold Plated', 'Acrylic', 'Canvas Frame'] },
      { key: 'height_inches', name: 'Height (Inches)', type: 'number', required: true, isVariant: true, unit: 'inches' },
      { key: 'eco_friendly', name: 'Eco-Friendly / Water Soluble', type: 'boolean', required: false, isVariant: false },
    ],
    childCategories: [
      'Lord Ganesha Idols', 'Lord Shiva Idols', 'Lord Venkateswara Idols',
      'Goddess Lakshmi Idols', 'Goddess Durga Idols', 'Lord Krishna Idols',
      'Sai Baba Idols', 'Hanuman Idols', 'Ayyappa Idols', 'Other Deity Idols',
      'Deity Statues', 'Hindu God Photo Frames', 'Jesus and Mother Mary Frames',
      'Islamic Calligraphy Frames', 'Sikh Guru Frames', 'Buddha Frames',
      'Jain Tirthankara Frames', 'Custom Photo Frames', 'Canvas Frames', 'LED Frames',
      'Acrylic Frames', 'Yantras', 'Rudraksha and Malas', 'Spiritual Wall Decor',
      'Custom Spiritual Decor',
    ],
  },
  {
    name: 'Brass, Copper and Pooja Accessories',
    slug: 'brass-copper-pooja-accessories',
    allowedCapabilities: ['brass_copper_shop', 'pooja_store', 'pooja_items_manufacturer', 'devotional_wholesaler'],
    productMode: 'standard',
    supportedItemTypes: ['product'],
    attributes: [
      { key: 'metal_type', name: 'Metal / Material', type: 'select', required: true, isVariant: true, options: ['Brass', 'Copper', 'Bronze', 'German Silver', 'Silver Plated'] },
      { key: 'finish', name: 'Finish Style', type: 'select', required: false, isVariant: true, options: ['Polished Shiny', 'Antique Finish', 'Matte', 'Handcrafted'] },
      { key: 'size_cm', name: 'Size / Height (cm)', type: 'number', required: false, isVariant: true, unit: 'cm' },
    ],
    childCategories: [
      'Diyas', 'Brass Lamps', 'Copper Lamps', 'Hanging Lamps', 'Pooja Bells',
      'Kalash', 'Pooja Plates', 'Panchapatra', 'Incense Holders', 'Camphor Holders',
      'Kumkum Boxes', 'Aarti Stands', 'Temple Accessories', 'Pooja Spoons',
      'Water Pots', 'Decorative Urli', 'Brass and Copper Gift Sets',
    ],
  },
  {
    name: 'Spiritual Books, Astrology and Media',
    slug: 'spiritual-books-astrology-media',
    allowedCapabilities: ['spiritual_book_shop', 'pooja_store', 'devotional_wholesaler'],
    productMode: 'standard',
    supportedItemTypes: ['product'],
    attributes: [
      { key: 'language', name: 'Language', type: 'select', required: true, isVariant: true, options: ['Telugu', 'Hindi', 'English', 'Sanskrit', 'Tamil', 'Kannada'] },
      { key: 'binding_type', name: 'Binding Type', type: 'select', required: false, isVariant: false, options: ['Hardcover', 'Paperback', 'Pocket Size'] },
      { key: 'author_publisher', name: 'Author / Publisher', type: 'text', required: false, isVariant: false },
    ],
    childCategories: [
      'Bhagavad Gita', 'Ramayana', 'Mahabharata', 'Pooja Books', 'Vratham Books',
      'Sloka Books', 'Panchangam', 'Astrology Books', 'Vastu Books',
      'Children’s Devotional Books', 'Regional Language Devotional Books',
      'Devotional Audio', 'Devotional Video', 'Bhajan Collections', 'Spiritual Calendars',
    ],
  },
  {
    name: 'Temple, Priest and Devotional Services',
    slug: 'temple-priest-devotional-services',
    allowedCapabilities: ['temple_service_partner', 'priest_pandit', 'decoration_shop', 'flower_shop'],
    productMode: 'not_applicable',
    supportedItemTypes: ['service', 'event'],
    attributes: [
      { key: 'languages_supported', name: 'Languages Supported', type: 'multiselect', required: true, isVariant: false, options: ['Telugu', 'Hindi', 'Sanskrit', 'English', 'Tamil'] },
      { key: 'service_location', name: 'Service Location', type: 'select', required: true, isVariant: false, options: ['At Customer Home', 'At Temple', 'Online Consultation'] },
      { key: 'duration_hours', name: 'Pooja Duration (Hours)', type: 'number', required: true, isVariant: false, unit: 'hours' },
      { key: 'materials_included', name: 'Materials Included by Priest', type: 'boolean', required: true, isVariant: false },
    ],
    childCategories: [
      'Archana Booking', 'Abhishekam Booking', 'Homam Booking', 'Satyanarayana Vratham',
      'Gruhapravesam Pooja', 'Wedding Pooja', 'Naming Ceremony Pooja', 'Bhoomi Pooja',
      'Office Opening Pooja', 'Vehicle Pooja', 'Pandit Booking', 'Temple Prasadam Booking',
      'Temple Seva Booking', 'Temple Donation Assistance', 'Festival Decoration Service',
      'Mandap Decoration', 'Flower Decoration', 'Custom Religious Event Service',
    ],
  },
  {
    name: 'Devotional Wholesale Supplies',
    slug: 'devotional-wholesale-supplies',
    allowedCapabilities: ['devotional_wholesaler', 'pooja_items_manufacturer', 'brass_copper_shop', 'flower_shop', 'coconut_shop', 'fruit_shop', 'photo_frame_shop'],
    productMode: 'wholesale',
    supportedItemTypes: ['product'],
    attributes: [
      { key: 'moq', name: 'Minimum Order Quantity (MOQ)', type: 'number', required: true, isVariant: false, unit: 'units' },
      { key: 'unit', name: 'Wholesale Unit', type: 'select', required: true, isVariant: false, options: ['Boxes', 'Cartons', 'Kilograms', 'Bales', 'Pallets'] },
      { key: 'dispatch_days', name: 'Dispatch Lead Time (Days)', type: 'number', required: true, isVariant: false, unit: 'days' },
      { key: 'gst_rate', name: 'GST Percentage', type: 'select', required: true, isVariant: false, options: ['0%', '5%', '12%', '18%', '28%'] },
    ],
    childCategories: [
      'Bulk Agarbatti', 'Bulk Camphor', 'Cotton Wicks Wholesale', 'Deepam Oil Wholesale',
      'Empty Photo Frames', 'Glass and Acrylic Sheets', 'MDF Boards', 'Brass Items Wholesale',
      'Copper Items Wholesale', 'Flower Wholesale', 'Coconut Wholesale', 'Fruit Wholesale',
      'Packaging Materials', 'Temple Supply Materials',
    ],
  },
];

export const seedDevotionalTaxonomy = async () => {
  console.log('[SeedDevotionalTaxonomy] Starting Devotional taxonomy seeding (1 Parent, 11 Subcategories, 190 Child Categories)...');

  // 1. Ensure Devotional Parent Category (Level 1)
  const mainCategory = await Category.findOneAndUpdate(
    { slug: 'devotional' },
    {
      $set: {
        name: 'Devotional',
        slug: 'devotional',
        description: 'Complete Devotional, Pooja, Temple & Spiritual Services Vertical',
        level: 1,
        parentId: null,
        supportedItemTypes: ['product', 'service', 'event'],
        displayOrder: 1,
        isActive: true,
        isFeatured: true,
        image: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=600&auto=format&fit=crop&q=80',
        banner: 'https://images.unsplash.com/photo-1609348084684-2a62886f4528?w=1600&auto=format&fit=crop&q=80',
      },
    },
    { upsert: true, new: true }
  );

  let subCount = 0;
  let childCount = 0;
  let schemaCount = 0;

  for (let sIdx = 0; sIdx < DEVOTIONAL_TAXONOMY.length; sIdx++) {
    const subDef = DEVOTIONAL_TAXONOMY[sIdx];
    if (!subDef) continue;
    const subSlug = `devotional-${subDef.slug}`;

    // 2. Upsert Subcategory (Level 2)
    const subCategory = await Category.findOneAndUpdate(
      { slug: subSlug },
      {
        $set: {
          name: subDef.name,
          slug: subSlug,
          description: `${subDef.name} subcategory under Devotional`,
          level: 2,
          parentId: mainCategory._id,
          supportedItemTypes: subDef.supportedItemTypes,
          displayOrder: sIdx + 1,
          isActive: true,
          attributes: subDef.attributes as any,
        },
      },
      { upsert: true, new: true }
    );
    subCount++;

    // 3. Upsert Subcategory Base CategoryProductSchema
    await CategoryProductSchema.findOneAndUpdate(
      { categoryId: subCategory._id },
      {
        $set: {
          categoryId: subCategory._id,
          subcategoryId: undefined,
          isChildOverride: false,
          schemaVersion: 1,
          productMode: subDef.productMode,
          allowedVendorCapabilities: subDef.allowedCapabilities,
          allowedItemTypes: subDef.supportedItemTypes,
          attributes: subDef.attributes as any,
          variantAttributes: subDef.attributes.filter(a => a.isVariant).map(a => a.key),
          inventoryPolicy: {
            mode: subDef.productMode === 'fresh' ? 'fresh' : subDef.productMode === 'food' ? 'batch_expiry' : subDef.productMode === 'wholesale' ? 'standard' : 'standard',
            requiresBatch: subDef.productMode === 'fresh' || subDef.productMode === 'food',
            requiresExpiry: subDef.productMode === 'fresh' || subDef.productMode === 'food',
            supportsReservedStock: true,
            supportsDamagedStock: true,
            supportsRawMaterials: subDef.slug.includes('wholesale') || subDef.slug.includes('idols'),
          },
          customizationPolicy: {
            enabled: subDef.productMode === 'customizable' || subDef.productMode === 'made_to_order',
            fields: [],
            requiresCustomerUpload: subDef.slug.includes('idols') || subDef.slug.includes('frames'),
            requiresPreview: subDef.slug.includes('frames'),
            requiresApproval: subDef.slug.includes('frames'),
          },
          workflowPolicy: {
            workflowType: subDef.productMode === 'fresh' ? 'fresh' : subDef.productMode === 'food' ? 'food' : 'standard',
            stages: ['order_confirmed', 'processing', 'packed', 'ready_for_pickup', 'out_for_delivery', 'delivered'],
          },
          deliveryPolicy: {
            homeDelivery: true,
            storePickup: true,
            sameDay: subDef.productMode === 'fresh',
            scheduled: true,
            fragile: subDef.slug.includes('brass') || subDef.slug.includes('idols'),
            mergedDelivery: true,
            multiVendorDelivery: true,
          },
          compliancePolicy: {
            requiredDocuments: subDef.productMode === 'food' ? ['FSSAI License'] : [],
            optionalDocuments: ['GST Certificate'],
          },
          isPublished: true,
        },
      },
      { upsert: true, new: true }
    );
    schemaCount++;

    // 4. Upsert Child Categories (Level 3) & Child Override Schemas
    const children = subDef.childCategories || [];
    for (let chIdx = 0; chIdx < children.length; chIdx++) {
      const childName = children[chIdx];
      const childSlug = `${subSlug}-${makeSlug(childName)}`;

      const childCategory = await Category.findOneAndUpdate(
        { slug: childSlug },
        {
          $set: {
            name: childName,
            slug: childSlug,
            description: `${childName} child category under ${subDef.name}`,
            level: 3,
            parentId: subCategory._id,
            supportedItemTypes: subDef.supportedItemTypes,
            displayOrder: chIdx + 1,
            isActive: true,
            attributes: subDef.attributes as any,
          },
        },
        { upsert: true, new: true }
      );
      childCount++;

      // Upsert Child Category Override Schema (inherits base subcategory schema settings)
      await CategoryProductSchema.findOneAndUpdate(
        { categoryId: childCategory._id },
        {
          $set: {
            categoryId: childCategory._id,
            subcategoryId: subCategory._id,
            isChildOverride: true,
            schemaVersion: 1,
            productMode: subDef.productMode,
            allowedVendorCapabilities: subDef.allowedCapabilities,
            allowedItemTypes: subDef.supportedItemTypes,
            attributes: subDef.attributes as any,
            variantAttributes: subDef.attributes.filter(a => a.isVariant).map(a => a.key),
            inventoryPolicy: {
              mode: subDef.productMode === 'fresh' ? 'fresh' : subDef.productMode === 'food' ? 'batch_expiry' : 'standard',
              requiresBatch: subDef.productMode === 'fresh' || subDef.productMode === 'food',
              requiresExpiry: subDef.productMode === 'fresh' || subDef.productMode === 'food',
              supportsReservedStock: true,
              supportsDamagedStock: true,
              supportsRawMaterials: false,
            },
            deliveryPolicy: {
              homeDelivery: true,
              storePickup: true,
              sameDay: subDef.productMode === 'fresh',
              scheduled: true,
              fragile: childName.toLowerCase().includes('frame') || childName.toLowerCase().includes('brass') || childName.toLowerCase().includes('idol'),
              mergedDelivery: true,
              multiVendorDelivery: true,
            },
            isPublished: true,
          },
        },
        { upsert: true, new: true }
      );
      schemaCount++;
    }
  }

  console.log(`[SeedDevotionalTaxonomy] Seeding completed! 1 Parent (devotional), ${subCount} L2 Subcategories, ${childCount} L3 Child Categories, and ${schemaCount} CategoryProductSchemas upserted successfully.`);
  return { parentCount: 1, subCount, childCount, schemaCount };
};

const runDirect = async () => {
  if (require.main === module) {
    try {
      const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
      await mongoose.connect(mongoURI);
      console.log('Connected to MongoDB. Running Devotional taxonomy seed...');
      await seedDevotionalTaxonomy();
      process.exit(0);
    } catch (err) {
      console.error('Seed execution error:', err);
      process.exit(1);
    }
  }
};

runDirect();
