import mongoose, { Schema, Document } from 'mongoose';

export type VendorAccessStatus =
  | 'draft'
  | 'pending'
  | 'changes_requested'
  | 'approved'
  | 'partially_approved'
  | 'suspended'
  | 'rejected';

export interface IVendorRestrictions {
  canCreateProducts: boolean;
  canCreateServices: boolean;
  canJoinFestivalCombos: boolean;
  canAcceptBulkOrders: boolean;
  canSellWholesale: boolean;
  canOfferSubscriptions: boolean;
}

export const RESTAURANT_VENDOR_CAPABILITIES = [
  'full_service_restaurant',
  'quick_service_restaurant',
  'family_restaurant',
  'fine_dining_restaurant',
  'casual_dining_restaurant',
  'pure_veg_restaurant',
  'non_veg_restaurant',
  'multi_cuisine_restaurant',
  'cloud_kitchen',
  'home_kitchen',
  'delivery_only_kitchen',
  'tiffin_center',
  'breakfast_center',
  'street_food_vendor',
  'food_cart',
  'food_truck',
  'tea_stall',
  'coffee_shop',
  'juice_shop',
  'cafe',
  'bakery',
  'cake_shop',
  'sweet_shop',
  'ice_cream_shop',
  'dessert_shop',
  'chaat_snacks_outlet',
  'fast_food_outlet',
  'biryani_outlet',
  'shawarma_outlet',
  'chinese_fast_food',
  'catering_service',
  'corporate_meal_provider',
  'meal_subscription_provider',
  'restaurant_raw_material_wholesaler',
  'vegetable_supplier',
  'fruit_supplier',
  'meat_supplier',
  'seafood_supplier',
  'dairy_supplier',
  'bakery_ingredient_supplier',
  'packaging_supplier',
  'restaurant_supply_vendor',
];

export const DAILY_NEEDS_VENDOR_CAPABILITIES = [
  // Fruits and Vegetables
  'vegetable_shop',
  'fruit_shop',
  'fresh_produce_store',
  'farmer',
  'farmer_producer_organization',
  'organic_farm',
  'wholesale_produce_vendor',
  'mobile_vegetable_van',
  // Milk and Dairy
  'local_milk_vendor',
  'dairy_farm',
  'milk_booth',
  'organic_dairy',
  'dairy_distributor',
  'milk_collection_center',
  // Grocery and Staples
  'kirana_store',
  'mini_mart',
  'supermarket',
  'organic_grocery_store',
  'wholesale_grocery',
  'dairy_fmcg_store',
  'fmcg_distributor',
  // Water
  'ro_water_plant',
  'mineral_water_supplier',
  'packaged_water_distributor',
  'local_water_can_supplier',
  'corporate_water_supplier',
  // Organic and Healthy Foods
  'organic_food_store',
  'organic_farmer',
  'millet_store',
  'cold_pressed_oil_store',
  'natural_honey_producer',
  'herbal_food_store',
  'healthy_snack_store',
  'farm_to_home_supplier',
  // Eggs, Meat and Seafood
  'egg_vendor',
  'chicken_shop',
  'mutton_shop',
  'fish_market',
  'seafood_store',
  'meat_processing_unit',
  'organic_meat_farm',
  'frozen_meat_store',
];

export const SHOPPING_VENDOR_CAPABILITIES = [
  // Fashion & Lifestyle
  'mens_fashion_store',
  'womens_fashion_store',
  'kids_wear_store',
  'boutique',
  'tailor_custom_stitching',
  'footwear_store',
  'bags_wallets_store',
  'watches_store',
  'fashion_accessories_store',
  'ethnic_wear_store',
  'sports_wear_store',
  'lingerie_store',
  'fashion_jewelry_store',
  'uniform_supplier',
  'fashion_wholesaler',
  // Home & Living
  'furniture_store',
  'home_decor_store',
  'kitchenware_store',
  'mattress_bedding_store',
  'lighting_store',
  'interior_decor_store',
  'hardware_store',
  'home_utility_store',
  'modular_kitchen_dealer',
  'curtains_furnishings_store',
  'office_furniture_store',
  'storage_organization_store',
  'home_living_wholesaler',
  'installation_service_provider',
  // Agriculture & Garden
  'seed_dealer',
  'fertilizer_dealer',
  'crop_protection_dealer',
  'plant_nursery',
  'garden_store',
  'farm_equipment_dealer',
  'irrigation_supplier',
  'organic_farming_store',
  'agriculture_input_wholesaler',
  'farm_equipment_rental_provider',
  'plantation_service_provider',
  'irrigation_installation_provider',
];

export const SERVICES_VENDOR_CAPABILITIES = [
  // Home Appliances Repair
  'individual_appliance_technician',
  'appliance_service_center',
  'authorized_appliance_service_center',
  'freelancer_technician',
  'appliance_service_franchise',
  'ac_technician',
  'refrigerator_technician',
  'washing_machine_technician',
  'tv_electronics_technician',
  'ro_purifier_technician',
  'geyser_technician',
  'kitchen_appliance_technician',
  'electrician',
  'multi_appliance_technician',
  'appliance_spare_parts_supplier',
  // Home Cleaning
  'individual_cleaner',
  'cleaning_agency',
  'housekeeping_company',
  'deep_cleaning_specialist',
  'kitchen_bathroom_cleaner',
  'sofa_carpet_cleaner',
  'move_in_move_out_cleaner',
  'post_construction_cleaner',
  'office_cleaning_provider',
  'water_tank_cleaner',
  'corporate_housekeeping_provider',
  'cleaning_franchise_partner',
  'cleaning_consumables_supplier',
  // Spa, Salon & Beauty
  'mens_salon',
  'womens_salon',
  'unisex_salon',
  'spa_center',
  'beauty_parlour',
  'barber_shop',
  'nail_studio',
  'makeup_studio',
  'bridal_studio',
  'wellness_center',
  'home_beauty_provider',
  'beauty_products_supplier',
  // Laundry & Garment Care
  'laundry_shop',
  'dry_cleaning_center',
  'steam_iron_center',
  'premium_garment_care',
  'shoe_bag_cleaning_provider',
  'carpet_curtain_cleaning_provider',
  'laundry_franchise',
  'pickup_delivery_laundry',
  'corporate_laundry_provider',
  'institutional_laundry_provider',
  'laundry_consumables_supplier',
];



export interface IVendorCategoryAccess extends Document {
  vendorId: mongoose.Types.ObjectId;
  storeId?: mongoose.Types.ObjectId;

  parentCategoryId: mongoose.Types.ObjectId;

  requestedCapabilities: string[];
  approvedCapabilities: string[];

  approvedSubcategoryIds: mongoose.Types.ObjectId[];
  approvedChildCategoryIds: mongoose.Types.ObjectId[];
  approvedItemTypes: string[];

  status: VendorAccessStatus;

  restrictions: IVendorRestrictions;

  requestedAt?: Date;
  approvedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  suspensionReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

const VendorCategoryAccessSchema = new Schema<IVendorCategoryAccess>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
    },
    parentCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    requestedCapabilities: [{ type: String, trim: true }],
    approvedCapabilities: [{ type: String, trim: true }],
    approvedSubcategoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    approvedChildCategoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    approvedItemTypes: [{ type: String, default: 'product' }],

    status: {
      type: String,
      enum: [
        'draft',
        'pending',
        'changes_requested',
        'approved',
        'partially_approved',
        'suspended',
        'rejected',
      ],
      default: 'pending',
      index: true,
    },

    restrictions: {
      canCreateProducts: { type: Boolean, default: true },
      canCreateServices: { type: Boolean, default: false },
      canJoinFestivalCombos: { type: Boolean, default: true },
      canAcceptBulkOrders: { type: Boolean, default: false },
      canSellWholesale: { type: Boolean, default: false },
      canOfferSubscriptions: { type: Boolean, default: false },
    },

    requestedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, default: '' },
    suspensionReason: { type: String, default: '' },
  },
  { timestamps: true }
);

VendorCategoryAccessSchema.index({ vendorId: 1, parentCategoryId: 1 }, { unique: true });
VendorCategoryAccessSchema.index({ vendorId: 1, status: 1 });
VendorCategoryAccessSchema.index({ parentCategoryId: 1, approvedCapabilities: 1 });

export const VendorCategoryAccess = mongoose.model<IVendorCategoryAccess>(
  'VendorCategoryAccess',
  VendorCategoryAccessSchema
);
export default VendorCategoryAccess;
