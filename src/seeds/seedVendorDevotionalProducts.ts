import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User';
import { Vendor } from '../models/Vendor';
import Product from '../models/Product';
import Category from '../models/Category';
import VendorCategoryAccess from '../models/VendorCategoryAccess';
import { seedDevotionalProducts } from './seedDevotionalProducts';

dotenv.config();

export const seedVendorDevotionalProducts = async (email: string = 'dev@gmail.com') => {
  const targetEmail = email.toLowerCase().trim();
  console.log(`\n==================================================`);
  console.log(`[Seed Vendor Devotional Products] Target Vendor: ${targetEmail}`);
  console.log(`==================================================\n`);

  // Ensure system masters are seeded first
  await seedDevotionalProducts();

  // Find or create User
  let user = await User.findOne({ email: targetEmail });
  if (!user) {
    console.log(`[Seed Vendor Devotional Products] Creating user account for ${targetEmail}...`);
    user = new User({
      name: 'Dev Vendor',
      email: targetEmail,
      passwordHash: '$2a$10$wJ2Nq1uS.7y8b4wQ4xZ7e.x8z5u8v7w6y5x4w3v2u1t0s9r8q7p', // default hash
      phone: '9876543210',
      roles: ['vendor'],
    });
    await user.save();
  }
  console.log(`✓ User resolved: ${user.name} (${user._id})`);

  // Find or create Vendor
  let vendor = await Vendor.findOne({ $or: [{ userId: user._id }, { email: targetEmail }] });
  if (!vendor) {
    console.log(`[Seed Vendor Devotional Products] Creating vendor profile for ${targetEmail}...`);
    vendor = new Vendor({
      userId: user._id,
      businessName: 'Dev Devotional & Pooja Store',
      ownerName: user.name,
      mobile: '9876543210',
      email: targetEmail,
      address: '123 Temple Road',
      city: 'Nellore',
      state: 'Andhra Pradesh',
      pincode: '524001',
      primaryCategory: 'devotional',
      storeType: 'devotional',
      marketplaceStatus: 'Approved',
      liveStatus: 'open',
      isActive: true,
    } as any);
    await vendor.save();
  } else {
    vendor.marketplaceStatus = 'Approved';
    (vendor as any).kycStatus = 'Verified';
    vendor.liveStatus = 'open';
    await vendor.save();
  }
  console.log(`✓ Vendor profile resolved: ${vendor.businessName} (${vendor._id})`);

  // Grant Vendor Category Access for Devotional
  const devParent = await Category.findOne({ slug: 'devotional', level: 1 });
  if (devParent) {
    let access = await VendorCategoryAccess.findOne({ vendorId: vendor._id });
    if (!access) {
      access = new VendorCategoryAccess({
        vendorId: vendor._id,
        storeId: vendor._id,
        parentCategoryId: devParent._id,
        requestedCapabilities: ['pooja_store', 'flower_shop', 'sweet_shop', 'pooja_items_manufacturer'],
        approvedCapabilities: ['pooja_store', 'flower_shop', 'sweet_shop', 'pooja_items_manufacturer'],
        status: 'approved',
        restrictions: {
          canCreateProducts: true,
          canCreateServices: true,
          canJoinFestivalCombos: true,
          canAcceptBulkOrders: true,
          canSellWholesale: true,
          canOfferSubscriptions: true,
        },
      });
      await access.save();
    }
  }

  // Seed for target email vendor
  const targetVendor = vendor;
  const targetUser = user;

  // Find all active vendors to ensure complete catalogue population across vendors
  const allVendors = await Vendor.find({});
  const vendorsToSeed = [targetVendor, ...allVendors.filter(v => v._id.toString() !== targetVendor._id.toString())];

  // Fetch all system master catalogue products
  const systemMasters = await Product.find({
    $or: [{ catalogueSource: 'system' }, { isCatalogueMaster: true }, { seedKey: { $regex: /^devotional:/ } }]
  });
  console.log(`[Seed Vendor Devotional Products] Found ${systemMasters.length} system master products to seed across ${vendorsToSeed.length} vendors.`);

  let totalSeeded = 0;
  let totalUpdated = 0;

  for (const vDoc of vendorsToSeed) {
    const vUser = await User.findById(vDoc.userId) || { _id: vDoc.userId, email: vDoc.email || 'vendor@apexbee.com' };
    const vEmail = (vDoc.email || (vUser as any).email || 'vendor').toLowerCase();

    const vendorSlugClean = vEmail.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    for (const master of systemMasters) {
      const vendorSeedKey = `vendor:${vEmail}:${master.seedKey || master.slug}`;
      const vendorSku = `SKU-DEV-${vDoc._id.toString().slice(-6).toUpperCase()}-${master.slug.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
      const vendorSlug = `store-${vendorSlugClean}-${master.slug}`;

      let baseMrp = 199;
      let baseSellingPrice = 149;
      if (master.productMode === 'wholesale') {
        baseMrp = 2499;
        baseSellingPrice = 1999;
      } else if (master.productMode === 'fresh' || master.productMode === 'food') {
        baseMrp = 120;
        baseSellingPrice = 99;
      } else if (master.productMode === 'combo') {
        baseMrp = 599;
        baseSellingPrice = 449;
      }

      const existingVendorProduct = await Product.findOne({
        $or: [
          { seedKey: vendorSeedKey },
          { slug: vendorSlug },
          { sellerId: vUser._id, slug: `dev-store-${master.slug}` },
          { sellerId: vDoc._id, slug: `dev-store-${master.slug}` },
        ],
      });

      const productFields = {
        name: master.name,
        slug: vendorSlug,
        description: master.description,
        categoryId: master.categoryId,
        subcategoryId: master.subcategoryId,
        subCategoryId: master.subCategoryId,
        childCategoryId: master.childCategoryId,
        productType: 'physical',
        itemType: master.itemType,
        productMode: master.productMode,
        sku: vendorSku,
        status: 'Live',
        moderationStatus: 'approved',
        isActive: true,
        isStoreProduct: true,
        sellerId: vUser._id,
        createdBy: vUser._id,
        sellerType: 'vendor',
        catalogueSource: 'vendor',
        isCatalogueMaster: false,
        seedKey: vendorSeedKey,
        baseMrp,
        baseSellingPrice,
        stock: 100,
        keywords: master.keywords,
        tags: master.tags,
        supportedUnits: master.supportedUnits,
        attributes: master.attributes || {},
        inventoryRules: master.inventoryRules || {},
        deliveryRules: master.deliveryRules || {},
        complianceRules: master.complianceRules || {},
        customizationRules: master.customizationRules || {},
        mediaRules: master.mediaRules || {},
        wholesaleRules: master.wholesaleRules || {},
        serviceRules: master.serviceRules || {},
      };

      if (existingVendorProduct) {
        Object.assign(existingVendorProduct, productFields);
        await existingVendorProduct.save();
        totalUpdated++;
      } else {
        await Product.create(productFields);
        totalSeeded++;
      }
    }
  }

  console.log(`\n==================================================`);
  console.log(`[Seed Vendor Devotional Products] Complete!`);
  console.log(`  Target Vendor: ${targetEmail}`);
  console.log(`  Vendors Seeded: ${vendorsToSeed.length}`);
  console.log(`  Inserted Products: ${totalSeeded}`);
  console.log(`  Updated Products: ${totalUpdated}`);
  console.log(`==================================================\n`);

  return { email: targetEmail, inserted: totalSeeded, updated: totalUpdated, total: totalSeeded + totalUpdated };
};

const runDirect = async () => {
  if (require.main === module) {
    try {
      const email = process.argv[2] || 'dev@gmail.com';
      const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
      await mongoose.connect(mongoURI);
      console.log('Connected to MongoDB.');
      await seedVendorDevotionalProducts(email);
      process.exit(0);
    } catch (err) {
      console.error('Execution error:', err);
      process.exit(1);
    }
  }
};

runDirect();
