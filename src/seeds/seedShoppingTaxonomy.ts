import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category';
import CategoryProductSchema from '../models/CategoryProductSchema';

dotenv.config();

export const makeSlug = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export interface IShoppingSubcategoryDef {
  name: string;
  slug: string;
  allowedCapabilities: string[];
  productMode: 'standard' | 'fresh' | 'food' | 'customizable' | 'made_to_order' | 'combo' | 'subscription' | 'wholesale';
  supportedItemTypes: string[];
  attributes: Array<{
    key: string;
    name: string;
    type: 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'textarea';
    required: boolean;
    isVariant: boolean;
    options?: string[];
    unit?: string;
    placeholder?: string;
  }>;
  childCategories: Array<{
    name: string;
    slug?: string;
    productMode?: 'standard' | 'customizable' | 'made_to_order' | 'wholesale' | 'not_applicable';
    supportedItemTypes?: string[];
    catalogueScope?: 'customer_retail' | 'vendor_procurement' | 'service_booking' | 'bulk_project';
    inventoryMode?: string;
    extraAttributes?: Array<{
      key: string;
      name: string;
      type: 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'textarea';
      required: boolean;
      isVariant: boolean;
      options?: string[];
      unit?: string;
      placeholder?: string;
    }>;
  }>;
}

const APPAREL_ATTRIBUTES = [
  { key: 'garment_type', name: 'Garment Type', type: 'select' as const, required: true, isVariant: false, options: ['Shirt', 'T-Shirt', 'Trousers', 'Jeans', 'Saree', 'Kurta', 'Lehenga', 'Dress', 'Jacket', 'Sweater', 'Tracksuit', 'Suit', 'Blazer', 'Innerwear', 'Uniform'] },
  { key: 'brand', name: 'Brand', type: 'text' as const, required: true, isVariant: false },
  { key: 'gender', name: 'Gender', type: 'select' as const, required: true, isVariant: true, options: ['Men', 'Women', 'Boys', 'Girls', 'Unisex', 'Kids'] },
  { key: 'age_group', name: 'Age Group', type: 'select' as const, required: true, isVariant: false, options: ['Infant (0-2 Yrs)', 'Kids (2-12 Yrs)', 'Teens (13-19 Yrs)', 'Adults'] },
  { key: 'fabric_material', name: 'Fabric Material', type: 'select' as const, required: true, isVariant: true, options: ['Cotton', 'Polyester', 'Silk', 'Linen', 'Denim', 'Rayon', 'Wool', 'Velvet', 'Georgette', 'Chiffon', 'Blend', 'Nylon', 'Lycra'] },
  { key: 'fabric_composition', name: 'Fabric Composition', type: 'text' as const, required: false, isVariant: false, placeholder: '100% Cotton / 80% Cotton 20% Polyester' },
  { key: 'primary_color', name: 'Primary Color', type: 'select' as const, required: true, isVariant: true, options: ['Black', 'White', 'Blue', 'Red', 'Green', 'Yellow', 'Pink', 'Purple', 'Grey', 'Brown', 'Beige', 'Gold', 'Silver', 'Multi-color'] },
  { key: 'secondary_color', name: 'Secondary Color', type: 'text' as const, required: false, isVariant: false },
  { key: 'pattern', name: 'Pattern', type: 'select' as const, required: false, isVariant: true, options: ['Solid', 'Printed', 'Striped', 'Checked', 'Floral', 'Embroidered', 'Graphic', 'Self-Design', 'Polka Dot'] },
  { key: 'fit_type', name: 'Fit Type', type: 'select' as const, required: false, isVariant: true, options: ['Regular Fit', 'Slim Fit', 'Relaxed Fit', 'Loose Fit', 'Tailored Fit', 'Oversized', 'Skinny Fit'] },
  { key: 'sleeve_type', name: 'Sleeve Type', type: 'select' as const, required: false, isVariant: false, options: ['Full Sleeve', 'Half Sleeve', 'Short Sleeve', 'Sleeveless', '3/4th Sleeve', 'Cap Sleeve'] },
  { key: 'neck_type', name: 'Neck / Collar Type', type: 'select' as const, required: false, isVariant: false, options: ['Round Neck', 'V-Neck', 'Polo Collar', 'Mandarin Collar', 'Spread Collar', 'Hooded', 'Boat Neck', 'Square Neck'] },
  { key: 'garment_length', name: 'Garment Length', type: 'select' as const, required: false, isVariant: false, options: ['Short', 'Regular', 'Long', 'Knee Length', 'Ankle Length', 'Cropped'] },
  { key: 'occasion', name: 'Occasion', type: 'select' as const, required: true, isVariant: false, options: ['Casual', 'Formal', 'Party', 'Ethnic / Festival', 'Sports / Gym', 'Lounge / Home', 'Wedding'] },
  { key: 'season', name: 'Season', type: 'select' as const, required: false, isVariant: false, options: ['Summer', 'Winter', 'All Seasons', 'Monsoon'] },
  { key: 'wash_care', name: 'Wash Care Instructions', type: 'select' as const, required: false, isVariant: false, options: ['Machine Wash', 'Hand Wash Only', 'Dry Clean Only', 'Gentle Wash'] },
  { key: 'country_of_origin', name: 'Country of Origin', type: 'text' as const, required: true, isVariant: false, placeholder: 'India' },
  { key: 'size_chart', name: 'Size Chart Reference', type: 'text' as const, required: false, isVariant: false },
  { key: 'returnable', name: 'Returnable', type: 'boolean' as const, required: true, isVariant: false },
  { key: 'exchange_allowed', name: 'Exchange Allowed', type: 'boolean' as const, required: true, isVariant: false },
];

export const SHOPPING_TAXONOMY: IShoppingSubcategoryDef[] = [
  {
    name: 'Fashion & Lifestyle',
    slug: 'shopping-fashion-lifestyle',
    allowedCapabilities: [
      'mens_fashion_store', 'womens_fashion_store', 'kids_wear_store', 'boutique',
      'tailor_custom_stitching', 'footwear_store', 'bags_wallets_store', 'watches_store',
      'fashion_accessories_store', 'ethnic_wear_store', 'sports_wear_store', 'lingerie_store',
      'fashion_jewelry_store', 'uniform_supplier', 'fashion_wholesaler'
    ],
    productMode: 'standard',
    supportedItemTypes: ['product', 'service'],
    attributes: APPAREL_ATTRIBUTES,
    childCategories: [
      { name: "Men's Fashion Store" },
      { name: "Women's Fashion Store" },
      { name: "Kids Wear Store" },
      { name: "Boutique", productMode: 'customizable' },
      {
        name: "Tailor and Custom Stitching",
        productMode: 'customizable',
        supportedItemTypes: ['service'],
        catalogueScope: 'service_booking',
        extraAttributes: [
          { key: 'service_name', name: 'Service Name', type: 'text', required: true, isVariant: false, placeholder: 'Blouse Stitching / Suit Tailoring' },
          { key: 'customer_fabric_allowed', name: 'Customer Provides Fabric', type: 'boolean', required: true, isVariant: false },
          { key: 'fabric_selection_available', name: 'In-House Fabric Selection Available', type: 'boolean', required: false, isVariant: false },
          { key: 'design_upload_supported', name: 'Design Photo Upload Supported', type: 'boolean', required: true, isVariant: false },
          { key: 'measurement_type', name: 'Measurement Option', type: 'select', required: true, isVariant: false, options: ['Doorstep Measurement', 'Self Measurements Upload', 'Send Sample Garment'] },
          { key: 'home_measurement_available', name: 'Home Measurement Available', type: 'boolean', required: false, isVariant: false },
          { key: 'trial_required', name: 'Fitting Trial Required', type: 'boolean', required: false, isVariant: false },
          { key: 'alteration_included', name: 'Free Alteration Included', type: 'boolean', required: true, isVariant: false },
          { key: 'number_of_trials', name: 'Number of Trials', type: 'number', required: false, isVariant: false, unit: 'trials' },
          { key: 'stitching_time_days', name: 'Stitching Lead Time (Days)', type: 'number', required: true, isVariant: false, unit: 'days' },
          { key: 'urgent_stitching_available', name: 'Express / Urgent Stitching Available', type: 'boolean', required: false, isVariant: false },
          { key: 'base_stitching_price', name: 'Base Stitching Price (INR)', type: 'number', required: true, isVariant: false, unit: 'INR' },
          { key: 'delivery_date_required', name: 'Promised Delivery Date Required', type: 'boolean', required: false, isVariant: false },
          { key: 'service_radius', name: 'Service Radius (KM)', type: 'number', required: false, isVariant: false, unit: 'km' },
        ],
      },
      {
        name: "Footwear Store",
        extraAttributes: [
          { key: 'footwear_type', name: 'Footwear Type', type: 'select', required: true, isVariant: false, options: ['Formal Shoes', 'Casual Shoes', 'Sneakers', 'Running / Sports Shoes', 'Sandals & Floaters', 'Slippers & Flip Flops', 'Heels & Pumps', 'Flats & Juttis', 'Boots', 'School Shoes'] },
          { key: 'upper_material', name: 'Upper Material', type: 'select', required: true, isVariant: true, options: ['Leather', 'Synthetic Leather', 'Canvas', 'Mesh / Textile', 'Suede', 'Rubber', 'Velvet'] },
          { key: 'sole_material', name: 'Sole Material', type: 'select', required: true, isVariant: false, options: ['TPR', 'Rubber', 'EVA', 'PU', 'Leather', 'Phylon', 'PVC'] },
          { key: 'closure_type', name: 'Closure Type', type: 'select', required: false, isVariant: false, options: ['Lace-Up', 'Slip-On', 'Velcro', 'Buckle', 'Zipper'] },
          { key: 'heel_type', name: 'Heel Type', type: 'select', required: false, isVariant: false, options: ['Flat', 'Block Heel', 'Stiletto', 'Wedge', 'Pencil Heel'] },
          { key: 'heel_height', name: 'Heel Height', type: 'select', required: false, isVariant: false, options: ['Flat (<1 inch)', 'Low (1-2 inch)', 'Medium (2-3 inch)', 'High (3+ inch)'] },
          { key: 'water_resistant', name: 'Water Resistant', type: 'boolean', required: false, isVariant: false },
          { key: 'sports_category', name: 'Sports Category', type: 'select', required: false, isVariant: false, options: ['Running', 'Walking', 'Cricket', 'Football', 'Badminton', 'Tennis', 'Gym / Training'] },
          { key: 'usage_type', name: 'Usage Type', type: 'select', required: false, isVariant: false, options: ['Daily Wear', 'Party Wear', 'Office Wear', 'Sports'] },
          { key: 'warranty', name: 'Manufacturer Warranty', type: 'text', required: false, isVariant: false, placeholder: '6 Months Manufacturer Warranty' },
        ],
      },
      {
        name: "Bags and Wallets Store",
        extraAttributes: [
          { key: 'product_type', name: 'Bag Type', type: 'select', required: true, isVariant: false, options: ['Backpack', 'Handbag', 'Tote Bag', 'Sling Bag', 'Clutch', 'Wallet', 'Laptop Bag', 'Travel Duffel', 'Trolley Suitcase', 'School Bag', 'Messenger Bag'] },
          { key: 'material', name: 'Material', type: 'select', required: true, isVariant: true, options: ['Genuine Leather', 'PU / Faux Leather', 'Polyester', 'Nylon', 'Canvas', 'Jute', 'Hard Shell Polycarbonate'] },
          { key: 'capacity', name: 'Capacity (Liters)', type: 'number', required: false, isVariant: true, unit: 'liters' },
          { key: 'number_of_compartments', name: 'Number of Compartments', type: 'number', required: false, isVariant: false },
          { key: 'laptop_size_support', name: 'Laptop Display Compatibility', type: 'select', required: false, isVariant: false, options: ['Up to 13.3 inch', 'Up to 15.6 inch', 'Up to 17 inch', 'No Laptop Pocket'] },
          { key: 'strap_type', name: 'Strap Type', type: 'select', required: false, isVariant: false, options: ['Adjustable Shoulder Strap', 'Double Handle', 'Padded Backpack Straps', 'Detachable Strap'] },
          { key: 'length', name: 'Length (cm)', type: 'number', required: false, isVariant: false, unit: 'cm' },
          { key: 'width', name: 'Width (cm)', type: 'number', required: false, isVariant: false, unit: 'cm' },
          { key: 'height', name: 'Height (cm)', type: 'number', required: false, isVariant: false, unit: 'cm' },
          { key: 'weight', name: 'Weight (g)', type: 'number', required: false, isVariant: false, unit: 'g' },
        ],
      },
      {
        name: "Watches Store",
        extraAttributes: [
          { key: 'watch_type', name: 'Watch Type', type: 'select', required: true, isVariant: false, options: ['Analog', 'Digital', 'Analog-Digital', 'Smartwatch', 'Chronograph', 'Luxury Watch'] },
          { key: 'movement_type', name: 'Movement Mechanism', type: 'select', required: true, isVariant: false, options: ['Quartz', 'Automatic / Mechanical', 'Solar Powered', 'Digital / Smart'] },
          { key: 'display_type', name: 'Display Type', type: 'select', required: false, isVariant: false, options: ['Analog', 'OLED / AMOLED', 'LCD', 'E-Ink'] },
          { key: 'dial_shape', name: 'Dial Shape', type: 'select', required: false, isVariant: false, options: ['Round', 'Square', 'Rectangular', 'Tonnea', 'Oval'] },
          { key: 'dial_color', name: 'Dial Color', type: 'select', required: true, isVariant: true, options: ['Black', 'White', 'Blue', 'Silver', 'Gold', 'Rose Gold', 'Green', 'Brown'] },
          { key: 'strap_material', name: 'Strap Material', type: 'select', required: true, isVariant: true, options: ['Stainless Steel', 'Genuine Leather', 'Silicone / Rubber', 'Nylon / Fabric', 'Ceramic', 'Titanium'] },
          { key: 'strap_color', name: 'Strap Color', type: 'select', required: true, isVariant: true, options: ['Black', 'Brown', 'Silver', 'Gold', 'Rose Gold', 'Blue', 'Grey'] },
          { key: 'water_resistance', name: 'Water Resistance Depth', type: 'select', required: false, isVariant: false, options: ['30m (3 ATM)', '50m (5 ATM)', '100m (10 ATM)', 'Water Resistant Splash Proof', 'No Water Resistance'] },
          { key: 'battery_type', name: 'Battery / Power Reserve', type: 'text', required: false, isVariant: false },
          { key: 'smart_features', name: 'Smart Features', type: 'multiselect', required: false, isVariant: false, options: ['Heart Rate Monitor', 'SpO2 Sensor', 'GPS Tracking', 'Bluetooth Calling', 'Step Counter', 'Sleep Monitor', 'Notifications'] },
        ],
      },
      { name: "Fashion Accessories Store" },
      { name: "Ethnic Wear Store" },
      { name: "Sports Wear Store" },
      { name: "Lingerie Store" },
      {
        name: "Fashion Jewelry Store",
        extraAttributes: [
          { key: 'jewelry_type', name: 'Jewelry Category', type: 'select', required: true, isVariant: false, options: ['Necklace & Pendant', 'Earrings', 'Bangles & Bracelets', 'Rings', 'Anklets (Payal)', 'Nose Ring', 'Mangalsutra', 'Jewelry Set'] },
          { key: 'material', name: 'Base Material', type: 'select', required: true, isVariant: true, options: ['Brass / Alloy', 'Copper', 'Silver 925', 'Gold Plated', 'Stainless Steel', 'Wood / Terracotta', 'Thread / Fabric'] },
          { key: 'plating', name: 'Plating Finish', type: 'select', required: false, isVariant: true, options: ['Gold Plated', 'Silver Plated', 'Rose Gold Plated', 'Rhodium', 'Antique / Oxidized', 'Two-Tone'] },
          { key: 'stone_type', name: 'Stone / Gemstone Type', type: 'select', required: false, isVariant: true, options: ['American Diamond (CZ)', 'Kundan', 'Meenakari', 'Pearl', 'Crystal / Glass', 'Beads', 'No Stone'] },
          { key: 'adjustable', name: 'Adjustable Size', type: 'boolean', required: false, isVariant: false },
          { key: 'care_instructions', name: 'Care Instructions', type: 'text', required: false, isVariant: false, placeholder: 'Keep away from moisture and perfume' },
          { key: 'certificate_available', name: 'Authenticity Certificate Included', type: 'boolean', required: false, isVariant: false },
          { key: 'hypoallergenic', name: 'Hypoallergenic (Skin Friendly)', type: 'boolean', required: false, isVariant: false },
        ],
      },
      {
        name: "School and Corporate Uniform Store",
        productMode: 'made_to_order',
        supportedItemTypes: ['service'],
        catalogueScope: 'bulk_project',
        extraAttributes: [
          { key: 'uniform_type', name: 'Uniform Category', type: 'select', required: true, isVariant: false, options: ['School Shirt & Blazer', 'Corporate Formal Suit', 'Industrial Safety Overalls', 'Hospital Scrub & Coat', 'Security Guard Uniform', 'Hotel & Chef Coat', 'Sports Tracksuit'] },
          { key: 'organization_type', name: 'Target Organization', type: 'select', required: true, isVariant: false, options: ['School / College', 'Corporate Office', 'Hospital / Clinic', 'Factory / Industrial', 'Hotel / Restaurant', 'Security Firm'] },
          { key: 'minimum_order_quantity', name: 'Minimum Order Quantity (MOQ)', type: 'number', required: true, isVariant: false, unit: 'sets' },
          { key: 'maximum_order_quantity', name: 'Maximum Capacity (MOQ)', type: 'number', required: false, isVariant: false, unit: 'sets' },
          { key: 'size_collection_required', name: 'On-Site Size Measurement Collection', type: 'boolean', required: false, isVariant: false },
          { key: 'sample_approval_required', name: 'Physical Sample Approval Required', type: 'boolean', required: true, isVariant: false },
          { key: 'logo_embroidery_supported', name: 'Custom Logo Embroidery Supported', type: 'boolean', required: true, isVariant: false },
          { key: 'name_printing_supported', name: 'Name Tag Printing Supported', type: 'boolean', required: false, isVariant: false },
          { key: 'fabric_options', name: 'Available Fabric Options', type: 'multiselect', required: true, isVariant: false, options: ['Polyester Cotton Blend', '100% Super Fine Cotton', 'Twill Industrial Fabric', 'Suiting / Rayon Blend', 'Matty Polo Fabric'] },
          { key: 'quotation_required', name: 'Admin / Vendor Quotation Required', type: 'boolean', required: true, isVariant: false },
          { key: 'delivery_schedule_required', name: 'Batch Delivery Schedule', type: 'boolean', required: false, isVariant: false },
          { key: 'multiple_delivery_locations', name: 'Multi-Branch Shipping Supported', type: 'boolean', required: false, isVariant: false },
          { key: 'production_lead_time', name: 'Production Lead Time (Days)', type: 'number', required: true, isVariant: false, unit: 'days' },
          { key: 'advance_percentage', name: 'Advance Payment Required (%)', type: 'number', required: true, isVariant: false, unit: '%' },
        ],
      },
    ],
  },
  {
    name: 'Home & Living',
    slug: 'shopping-home-living',
    allowedCapabilities: [
      'furniture_store', 'home_decor_store', 'kitchenware_store', 'mattress_bedding_store',
      'lighting_store', 'interior_decor_store', 'hardware_store', 'home_utility_store',
      'modular_kitchen_dealer', 'curtains_furnishings_store', 'office_furniture_store',
      'storage_organization_store', 'home_living_wholesaler', 'installation_service_provider'
    ],
    productMode: 'standard',
    supportedItemTypes: ['product', 'service'],
    attributes: [
      { key: 'decor_type', name: 'Item Type', type: 'select', required: true, isVariant: false, options: ['Furniture', 'Home Decor', 'Kitchenware', 'Bedding', 'Lighting', 'Hardware', 'Curtain'] },
      { key: 'brand', name: 'Brand / Manufacturer', type: 'text', required: false, isVariant: false },
      { key: 'material', name: 'Primary Material', type: 'select', required: true, isVariant: true, options: ['Teak Wood', 'Sheesham Wood', 'Engineered Wood (MDF/HDF)', 'Plywood', 'Metal / Steel', 'Plastic / Polypropylene', 'Glass', 'Ceramic', 'Fabric / Upholstery', 'Leatherette', 'Brass / Bronze'] },
      { key: 'primary_color', name: 'Color / Finish', type: 'select', required: true, isVariant: true, options: ['Walnut', 'Teak', 'Honey Oak', 'White', 'Black', 'Grey', 'Brown', 'Beige', 'Natural Wood', 'Multicolor'] },
      { key: 'length', name: 'Length (cm)', type: 'number', required: false, isVariant: false, unit: 'cm' },
      { key: 'width', name: 'Width (cm)', type: 'number', required: false, isVariant: false, unit: 'cm' },
      { key: 'height', name: 'Height (cm)', type: 'number', required: false, isVariant: false, unit: 'cm' },
      { key: 'weight', name: 'Weight (kg)', type: 'number', required: false, isVariant: false, unit: 'kg' },
      { key: 'warranty', name: 'Warranty Period', type: 'select', required: false, isVariant: false, options: ['No Warranty', '6 Months Warranty', '1 Year Warranty', '3 Years Warranty', '5 Years Warranty', '10+ Years Warranty'] },
    ],
    childCategories: [
      {
        name: "Furniture Store",
        extraAttributes: [
          { key: 'furniture_type', name: 'Furniture Category', type: 'select', required: true, isVariant: false, options: ['Sofa Set', 'Bed & Cot', 'Dining Table Set', 'Study Table & Desk', 'Wardrobe & Almirah', 'TV Unit', 'Bookshelf', 'Shoe Rack', 'Recliner', 'Outdoor / Garden Furniture'] },
          { key: 'seating_capacity', name: 'Seating Capacity', type: 'select', required: false, isVariant: true, options: ['1 Seater', '2 Seater', '3 Seater', '4 Seater', '5 Seater (3+1+1)', '6 Seater', 'L-Shape 5 Seater', '8 Seater'] },
          { key: 'storage_available', name: 'Storage Space Included', type: 'boolean', required: false, isVariant: false },
          { key: 'storage_type', name: 'Storage Mechanism', type: 'select', required: false, isVariant: true, options: ['Box Storage', 'Hydraulic Lift', 'Drawer Storage', 'No Storage'] },
          { key: 'assembly_required', name: 'Assembly Required', type: 'boolean', required: true, isVariant: false },
          { key: 'installation_required', name: 'Professional Carpentry Installation Required', type: 'boolean', required: true, isVariant: false },
          { key: 'room_type', name: 'Intended Room Type', type: 'select', required: false, isVariant: false, options: ['Living Room', 'Bedroom', 'Dining Room', 'Study / Home Office', 'Balcony / Outdoor'] },
          { key: 'finish', name: 'Surface Finish', type: 'select', required: false, isVariant: true, options: ['Matte', 'Glossy', 'Melamine', 'Veneer', 'Laminate', 'Natural Polish'] },
          { key: 'maximum_load', name: 'Maximum Weight Load Capacity (kg)', type: 'number', required: false, isVariant: false, unit: 'kg' },
          { key: 'made_to_order', name: 'Made to Order / Custom Manufacturing', type: 'boolean', required: false, isVariant: false },
          { key: 'production_time_days', name: 'Manufacturing Time (Days)', type: 'number', required: false, isVariant: false, unit: 'days' },
          { key: 'fragile', name: 'Fragile Glass / Mirror Component', type: 'boolean', required: false, isVariant: false },
          { key: 'large_item_delivery_required', name: 'Requires 2-Person Heavy Item Freight Delivery', type: 'boolean', required: true, isVariant: false },
        ],
      },
      { name: "Home Decor Store" },
      {
        name: "Kitchenware Store",
        extraAttributes: [
          { key: 'kitchen_product_type', name: 'Kitchenware Category', type: 'select', required: true, isVariant: false, options: ['Pressure Cooker', 'Cookware Set (Kadais/Pans)', 'Non-Stick Tawa', 'Stainless Steel Utensils', 'Dinnerware & Crockery', 'Cutlery & Knives', 'Water Bottles & Flasks', 'Storage Containers & Jars', 'Spice Boxes (Masala Dabba)'] },
          { key: 'capacity', name: 'Volume Capacity', type: 'select', required: false, isVariant: true, options: ['1 Litre', '2 Litre', '3 Litre', '5 Litre', '7 Litre', '10 Litre', '500 ml', '750 ml'] },
          { key: 'number_of_pieces', name: 'Number of Pieces in Pack', type: 'number', required: false, isVariant: true, unit: 'pcs' },
          { key: 'food_grade', name: 'Food Grade Certified Safe', type: 'boolean', required: true, isVariant: false },
          { key: 'dishwasher_safe', name: 'Dishwasher Safe', type: 'boolean', required: false, isVariant: false },
          { key: 'microwave_safe', name: 'Microwave Safe', type: 'boolean', required: false, isVariant: false },
          { key: 'induction_compatible', name: 'Induction Base Compatible', type: 'boolean', required: true, isVariant: false },
          { key: 'non_stick', name: 'Non-Stick Coating', type: 'boolean', required: false, isVariant: false },
        ],
      },
      {
        name: "Mattress and Bedding Store",
        extraAttributes: [
          { key: 'product_type', name: 'Bedding Product Category', type: 'select', required: true, isVariant: false, options: ['Mattress', 'Pillow', 'Bedsheet Set', 'Blanket / Comforter', 'Mattress Protector', 'Duvet Cover'] },
          { key: 'mattress_type', name: 'Mattress Core Material', type: 'select', required: false, isVariant: true, options: ['Memory Foam', 'Coir & Foam', 'Pocket Spring', 'Bonnell Spring', 'Natural Latex', 'High Resilience (HR) Foam'] },
          { key: 'bed_size', name: 'Standard Bed Size', type: 'select', required: true, isVariant: true, options: ['Single Bed (72x36 in)', 'Double Bed (72x48 in)', 'Queen Size (72x60 in)', 'King Size (72x72 in)', 'Custom Dimensions'] },
          { key: 'thickness', name: 'Mattress Thickness (Inches)', type: 'select', required: false, isVariant: true, options: ['4 Inches', '5 Inches', '6 Inches', '8 Inches', '10 Inches', '12 Inches'] },
          { key: 'firmness', name: 'Firmness Level', type: 'select', required: false, isVariant: true, options: ['Soft', 'Medium Firm', 'Firm / Orthopedic', 'Extra Firm'] },
          { key: 'reversible', name: 'Dual Sided / Reversible Use', type: 'boolean', required: false, isVariant: false },
          { key: 'trial_period_days', name: 'Risk-Free Trial Days', type: 'number', required: false, isVariant: false, unit: 'days' },
          { key: 'washable_cover', name: 'Removable Washable Cover', type: 'boolean', required: false, isVariant: false },
          { key: 'hypoallergenic', name: 'Anti-Dust Mite & Hypoallergenic', type: 'boolean', required: false, isVariant: false },
          { key: 'orthopedic', name: 'Orthopedic Spine Support Certified', type: 'boolean', required: false, isVariant: false },
          { key: 'custom_size_available', name: 'Custom Dimension Manufacturing Supported', type: 'boolean', required: false, isVariant: false },
        ],
      },
      {
        name: "Lighting Store",
        extraAttributes: [
          { key: 'lighting_type', name: 'Luminaire Type', type: 'select', required: true, isVariant: false, options: ['LED Bulb', 'Ceiling Chandelier', 'Pendant Light', 'Wall Sconce / Light', 'Table Lamp', 'Floor Lamp', 'Decorative Strip Lights', 'Outdoor Gate Light', 'Panel Downlight'] },
          { key: 'power_watts', name: 'Power Consumption (Watts)', type: 'select', required: true, isVariant: true, options: ['5W', '9W', '12W', '15W', '20W', '36W', '50W', '100W'] },
          { key: 'voltage', name: 'Operating Voltage', type: 'text', required: false, isVariant: false, placeholder: '220V - 240V AC' },
          { key: 'color_temperature', name: 'Light Shade / Color', type: 'select', required: true, isVariant: true, options: ['Cool Daylight (6500K)', 'Warm White (3000K)', 'Neutral Daylight (4000K)', 'RGB Multicolor Smart'] },
          { key: 'brightness_lumens', name: 'Lumen Output', type: 'number', required: false, isVariant: false, unit: 'lumens' },
          { key: 'bulb_included', name: 'Light Source Bulb Included', type: 'boolean', required: false, isVariant: false },
          { key: 'dimmable', name: 'Dimmable Brightness', type: 'boolean', required: false, isVariant: false },
          { key: 'smart_enabled', name: 'Smart App / Voice Assistant Compatible', type: 'boolean', required: false, isVariant: false },
          { key: 'energy_rating', name: 'BEE Star Energy Rating', type: 'select', required: false, isVariant: false, options: ['5 Star', '4 Star', '3 Star', 'Not Applicable'] },
        ],
      },
      { name: "Interior Decor Store" },
      {
        name: "Hardware Store",
        extraAttributes: [
          { key: 'product_type', name: 'Hardware & Fittings Category', type: 'select', required: true, isVariant: false, options: ['Door Locks & Handles', 'Cabinet Hinges & Slides', 'Curtain Rods & Brackets', 'Screws & Fasteners', 'Hand Tools', 'Power Tools', 'Plumbing Fittings', 'Bathroom Accessories'] },
          { key: 'load_capacity', name: 'Max Weight Load (kg)', type: 'number', required: false, isVariant: false, unit: 'kg' },
          { key: 'indoor_or_outdoor', name: 'Indoor or Outdoor Use', type: 'select', required: false, isVariant: false, options: ['Indoor Only', 'Outdoor Weatherproof', 'Both'] },
          { key: 'weather_resistant', name: 'Rust & Weather Resistant Coating', type: 'boolean', required: false, isVariant: false },
          { key: 'pack_quantity', name: 'Pack Quantity / Count', type: 'number', required: false, isVariant: true, unit: 'pcs' },
        ],
      },
      { name: "Home Utility Store" },
      {
        name: "Modular Kitchen Dealer",
        productMode: 'made_to_order',
        supportedItemTypes: ['service'],
        catalogueScope: 'bulk_project',
        extraAttributes: [
          { key: 'project_type', name: 'Kitchen Layout Model', type: 'select', required: true, isVariant: false, options: ['L-Shaped Modular Kitchen', 'U-Shaped Modular Kitchen', 'Straight Kitchen', 'Parallel / Galley Kitchen', 'Island Kitchen Layout'] },
          { key: 'measurement_visit_required', name: 'Free Site Measurement Visit Required', type: 'boolean', required: true, isVariant: false },
          { key: 'customer_dimensions_supported', name: 'Custom Floorplan Design Supported', type: 'boolean', required: true, isVariant: false },
          { key: 'design_consultation', name: '3D CAD Design Consultation Included', type: 'boolean', required: true, isVariant: false },
          { key: 'material_options', name: 'Cabinet Core Materials', type: 'multiselect', required: true, isVariant: false, options: ['BWP Grade Marine Plywood', 'HDF Action Tesa', 'Boiling Water Resistant Plywood', 'Stainless Steel 304'] },
          { key: 'finish_options', name: 'Shutter Finishes Available', type: 'multiselect', required: true, isVariant: false, options: ['Acrylic High Gloss', 'Polyurethane (PU) Paint', 'Laminate Finish', 'Glass Shutters', 'Veneer Finish'] },
          { key: 'quotation_required', name: 'Requires Official Admin / Vendor Quotation', type: 'boolean', required: true, isVariant: false },
          { key: 'estimated_production_time_days', name: 'Factory Production Days', type: 'number', required: true, isVariant: false, unit: 'days' },
          { key: 'installation_included', name: 'On-Site Installation Included', type: 'boolean', required: true, isVariant: false },
          { key: 'site_location_required', name: 'Property Site Address Required', type: 'boolean', required: true, isVariant: false },
          { key: 'advance_percentage', name: 'Advance Payment Required (%)', type: 'number', required: true, isVariant: false, unit: '%' },
          { key: 'multiple_site_visits', name: 'Includes Pre-delivery Site Inspection Visits', type: 'boolean', required: false, isVariant: false },
        ],
      },
      { name: "Curtains and Furnishings Store" },
      { name: "Office Furniture Store" },
      { name: "Storage and Organization Store" },
    ],
  },
  {
    name: 'Agriculture & Garden',
    slug: 'shopping-agriculture-garden',
    allowedCapabilities: [
      'seed_dealer', 'fertilizer_dealer', 'crop_protection_dealer', 'plant_nursery',
      'garden_store', 'farm_equipment_dealer', 'irrigation_supplier', 'organic_farming_store',
      'agriculture_input_wholesaler', 'farm_equipment_rental_provider',
      'plantation_service_provider', 'irrigation_installation_provider'
    ],
    productMode: 'standard',
    supportedItemTypes: ['product', 'service'],
    attributes: [
      { key: 'crop_type', name: 'Target Crop / Plant Group', type: 'select', required: false, isVariant: false, options: ['Paddy / Rice', 'Cotton', 'Chilli', 'Vegetables', 'Fruits', 'Pulses', 'Sugarcane', 'Flowering Plants', 'General Garden'] },
      { key: 'brand', name: 'Manufacturer / Brand', type: 'text', required: true, isVariant: false },
      { key: 'pack_size', name: 'Pack Size / Volume', type: 'select', required: true, isVariant: true, options: ['100 g', '250 g', '500 g', '1 kg', '5 kg', '10 kg', '25 kg', '50 kg', '100 ml', '250 ml', '500 ml', '1 Litre', '5 Litres'] },
      { key: 'weight', name: 'Net Weight / Volume Value', type: 'text', required: false, isVariant: false, placeholder: 'e.g. 1 kg Pouch / 500 ml Bottle' },
    ],
    childCategories: [
      {
        name: "Seed Dealer",
        inventoryMode: 'batch_expiry',
        extraAttributes: [
          { key: 'seed_type', name: 'Seed Category', type: 'select', required: true, isVariant: false, options: ['Grain & Cereal Seeds', 'Vegetable Seeds', 'Fruit Seeds', 'Flower Seeds', 'Fodder Seeds', 'Oilseed Seeds'] },
          { key: 'variety', name: 'Seed Variety / Name', type: 'text', required: true, isVariant: true, placeholder: 'BMT-21 / Sonalika / Hybrid 44' },
          { key: 'hybrid_or_open_pollinated', name: 'Breeding Type', type: 'select', required: true, isVariant: false, options: ['F1 Hybrid', 'Open Pollinated (OP)', 'Research Variety', 'Desi / Traditional'] },
          { key: 'suitable_season', name: 'Sowing Season', type: 'multiselect', required: true, isVariant: false, options: ['Kharif (Monsoon)', 'Rabi (Winter)', 'Zaid (Summer)', 'All Seasons'] },
          { key: 'suitable_soil', name: 'Suitable Soil Type', type: 'multiselect', required: false, isVariant: false, options: ['Black Cotton Soil', 'Red Soil', 'Loamy Soil', 'Sandy Soil', 'All Soil Types'] },
          { key: 'germination_percentage', name: 'Minimum Germination (%)', type: 'number', required: true, isVariant: false, unit: '%' },
          { key: 'purity_percentage', name: 'Physical Purity (%)', type: 'number', required: true, isVariant: false, unit: '%' },
          { key: 'lot_number', name: 'Seed Inspection Lot Number', type: 'text', required: true, isVariant: false },
          { key: 'batch_number', name: 'Batch Number', type: 'text', required: true, isVariant: false },
          { key: 'packing_date', name: 'Date of Packing', type: 'text', required: true, isVariant: false, placeholder: 'YYYY-MM-DD' },
          { key: 'expiry_date', name: 'Date of Expiry / Valid Up To', type: 'text', required: true, isVariant: false, placeholder: 'YYYY-MM-DD' },
          { key: 'treatment_applied', name: 'Chemical / Biological Seed Coating Treatment', type: 'text', required: false, isVariant: false, placeholder: 'Thiram / Trichoderma Treated' },
          { key: 'usage_instructions', name: 'Sowing Spacing & Method', type: 'textarea', required: false, isVariant: false },
          { key: 'storage_instructions', name: 'Storage Guidelines', type: 'text', required: false, isVariant: false, placeholder: 'Store in cool dry place below 25°C' },
          { key: 'seed_dealer_licence_required', name: 'Requires Valid Agriculture Seed Licence Verification', type: 'boolean', required: true, isVariant: false },
        ],
      },
      {
        name: "Fertilizer Dealer",
        inventoryMode: 'batch_expiry',
        extraAttributes: [
          { key: 'fertilizer_type', name: 'Fertilizer Classification', type: 'select', required: true, isVariant: false, options: ['Chemical / NPK Fertilizer', 'Organic Manure / Vermicompost', 'Bio-Fertilizer', 'Micronutrient Mix', 'Water Soluble Fertilizer', 'Soil Conditioner / Gypsum'] },
          { key: 'npk_ratio', name: 'NPK Ratio Formula', type: 'text', required: false, isVariant: true, placeholder: '19:19:19 / 20:20:0:13 / 46% N (Urea)' },
          { key: 'nutrient_composition', name: 'Nutrient Percentage Specs', type: 'text', required: false, isVariant: false },
          { key: 'crop_compatibility', name: 'Crop Compatibility', type: 'multiselect', required: false, isVariant: false, options: ['All Field Crops', 'Paddy', 'Cotton', 'Chilli & Spices', 'Horticulture & Fruits', 'Vegetables'] },
          { key: 'application_method', name: 'Application Mode', type: 'select', required: true, isVariant: false, options: ['Basal Soil Application', 'Foliar Spray', 'Drip Irrigation / Fertigation', 'Top Dressing Broad-casting'] },
          { key: 'dosage', name: 'Recommended Acre Dosage', type: 'text', required: false, isVariant: false, placeholder: '5 kg per Acre' },
          { key: 'batch_number', name: 'Batch Number', type: 'text', required: true, isVariant: false },
          { key: 'manufacturing_date', name: 'Manufacturing Date', type: 'text', required: true, isVariant: false, placeholder: 'YYYY-MM-DD' },
          { key: 'expiry_date', name: 'Expiry Date', type: 'text', required: false, isVariant: false, placeholder: 'YYYY-MM-DD' },
          { key: 'safety_instructions', name: 'Precautionary Warnings', type: 'textarea', required: false, isVariant: false },
          { key: 'licence_required', name: 'Fertilizer Control Order (FCO) Licence Required', type: 'boolean', required: true, isVariant: false },
          { key: 'organic_certified', name: 'NPOP / Jaivik Bharat Organic Certified', type: 'boolean', required: false, isVariant: false },
        ],
      },
      {
        name: "Crop Protection Dealer",
        inventoryMode: 'batch_expiry',
        extraAttributes: [
          { key: 'product_type', name: 'Pesticide Category', type: 'select', required: true, isVariant: false, options: ['Insecticide', 'Fungicide', 'Herbicide / Weedicide', 'Bactericide', 'Nematicide', 'Plant Growth Regulator (PGR)', 'Bio-Pesticide'] },
          { key: 'active_ingredient', name: 'Active Ingredient & Technical Name', type: 'text', required: true, isVariant: false, placeholder: 'Chlorpyrifos 50% + Cypermethrin 5% EC' },
          { key: 'concentration', name: 'Concentration / Strength', type: 'text', required: true, isVariant: true, placeholder: '50% EC / 75% WP / 10% SL' },
          { key: 'formulation', name: 'Formulation State', type: 'select', required: false, isVariant: false, options: ['Emulsifiable Concentrate (EC)', 'Wettable Powder (WP)', 'Soluble Liquid (SL)', 'Granules (G)', 'Suspension Concentrate (SC)'] },
          { key: 'target_pest_or_disease', name: 'Target Pests / Diseases', type: 'text', required: true, isVariant: false, placeholder: 'Stem borer, Aphids, Blight, Caterpillars' },
          { key: 'dosage', name: 'Recommended Dilution Dosage', type: 'text', required: true, isVariant: false, placeholder: '2 ml per Litre of Water' },
          { key: 'application_method', name: 'Application Method', type: 'select', required: true, isVariant: false, options: ['Foliar Spraying', 'Soil Drenching', 'Seed Dressing'] },
          { key: 'waiting_period_days', name: 'Pre-Harvest Interval (PHI Days)', type: 'number', required: true, isVariant: false, unit: 'days' },
          { key: 'safety_equipment_required', name: 'Protective Safety Wear Required', type: 'boolean', required: true, isVariant: false },
          { key: 'toxicity_classification', name: 'CIBRC Toxicity Label Color', type: 'select', required: true, isVariant: false, options: ['Green (Slightly Toxic)', 'Blue (Moderately Toxic)', 'Yellow (Highly Toxic)', 'Red (Extremely Toxic)'] },
          { key: 'batch_number', name: 'CIBRC Batch Number', type: 'text', required: true, isVariant: false },
          { key: 'manufacturing_date', name: 'Manufacturing Date', type: 'text', required: true, isVariant: false, placeholder: 'YYYY-MM-DD' },
          { key: 'expiry_date', name: 'Expiration Date', type: 'text', required: true, isVariant: false, placeholder: 'YYYY-MM-DD' },
          { key: 'licence_verification_required', name: 'Requires Valid Insecticide Licence Verification', type: 'boolean', required: true, isVariant: false },
          { key: 'emergency_instructions', name: 'Antidote & First Aid Instructions', type: 'textarea', required: true, isVariant: false },
          { key: 'restricted_product', name: 'Restricted Chemical (Requires Admin Approval)', type: 'boolean', required: true, isVariant: false },
        ],
      },
      {
        name: "Plant Nursery",
        inventoryMode: 'fresh',
        extraAttributes: [
          { key: 'plant_name', name: 'Common Plant Name', type: 'text', required: true, isVariant: false, placeholder: 'Mango Graft / Mango Ginger / Rose' },
          { key: 'botanical_name', name: 'Botanical / Scientific Name', type: 'text', required: false, isVariant: false, placeholder: 'Mangifera indica' },
          { key: 'plant_type', name: 'Plant Category', type: 'select', required: true, isVariant: false, options: ['Fruit Tree Plant', 'Flowering Plant', 'Indoor Foliage Plant', 'Medicinal & Herbal Plant', 'Bonsai & Exotic', 'Vegetable Sapling', 'Ornamental Shrub'] },
          { key: 'indoor_or_outdoor', name: 'Light Compatibility', type: 'select', required: true, isVariant: false, options: ['Indoor Low Light', 'Indoor Bright Indirect Light', 'Full Outdoor Direct Sun', 'Partial Shade Outdoor'] },
          { key: 'plant_age_months', name: 'Sapling Age (Months)', type: 'number', required: false, isVariant: true, unit: 'months' },
          { key: 'plant_height', name: 'Plant Height (Feet / Inches)', type: 'select', required: false, isVariant: true, options: ['Small (6-12 inches)', 'Medium (1-2 feet)', 'Large (3-4 feet)', 'Extra Large (5+ feet)'] },
          { key: 'pot_size', name: 'Nursery Bag / Pot Diameter', type: 'select', required: false, isVariant: true, options: ['4 inch Polybag', '6 inch Plastic Pot', '8 inch Grow Bag', '10 inch Clay Pot', '12+ inch Container'] },
          { key: 'pot_included', name: 'Container Pot Included', type: 'boolean', required: true, isVariant: false },
          { key: 'flowering_season', name: 'Flowering / Fruiting Season', type: 'text', required: false, isVariant: false },
          { key: 'sunlight_requirement', name: 'Daily Sun Exposure Needed', type: 'text', required: false, isVariant: false, placeholder: '4-6 hours direct sun' },
          { key: 'water_requirement', name: 'Watering Frequency', type: 'select', required: true, isVariant: false, options: ['Daily Watering', 'Alternate Days', 'Once a Week (Low Water)', 'Soil Drying Interval'] },
          { key: 'soil_type', name: 'Recommended Potting Mix', type: 'text', required: false, isVariant: false, placeholder: 'Coco peat + Vermicompost + Red soil' },
          { key: 'maintenance_level', name: 'Care Difficulty', type: 'select', required: true, isVariant: false, options: ['Low Maintenance (Beginner Friendly)', 'Moderate Care', 'High Attention Needed'] },
          { key: 'pet_safe', name: 'Pet Non-Toxic Safe', type: 'boolean', required: false, isVariant: false },
          { key: 'medicinal_use', name: 'Ayurvedic / Herbal Use', type: 'boolean', required: false, isVariant: false },
          { key: 'fruit_bearing', name: 'Grafted Early Fruit Bearing Sapling', type: 'boolean', required: false, isVariant: false },
          { key: 'plant_health_status', name: 'Plant Health Condition', type: 'select', required: true, isVariant: false, options: ['Healthy Grafted Sapling', 'Rooted Layering', 'Tissue Culture Plant'] },
          { key: 'plantation_service_available', name: 'On-Site Landscape Plantation Service Available', type: 'boolean', required: false, isVariant: false },
        ],
      },
      { name: "Garden Store" },
      {
        name: "Farm Equipment Dealer",
        extraAttributes: [
          { key: 'equipment_type', name: 'Equipment Classification', type: 'select', required: true, isVariant: false, options: ['Tractor Attachment / Implement', 'Power Weeder & Tiller', 'Battery Sprayer Pump', 'Brush Cutter', 'Chaff Cutter', 'Engine Water Pump', 'Harvester Machine', 'Solar Insect Trap'] },
          { key: 'model', name: 'Model Name / Number', type: 'text', required: true, isVariant: true },
          { key: 'power_source', name: 'Engine / Power Type', type: 'select', required: true, isVariant: false, options: ['Diesel Engine', 'Petrol Engine', 'Rechargeable Lithium Battery', 'Manual Hand Operated', 'PTO Driven'] },
          { key: 'engine_capacity', name: 'Engine Horsepower (HP) / Capacity', type: 'text', required: false, isVariant: true, placeholder: '2 HP / 7.5 HP / 52cc' },
          { key: 'fuel_type', name: 'Fuel Type', type: 'select', required: false, isVariant: false, options: ['Diesel', 'Petrol', 'Electric / Battery', 'None'] },
          { key: 'working_width', name: 'Tilling / Spraying Width', type: 'text', required: false, isVariant: false },
          { key: 'warranty', name: 'Manufacturer Warranty', type: 'text', required: true, isVariant: false, placeholder: '1 Year Doorstep Warranty' },
          { key: 'service_support', name: 'Local Spare Parts & Repair Service Available', type: 'boolean', required: true, isVariant: false },
          { key: 'spare_parts_available', name: 'Genuine Spare Parts Availability Guarantee', type: 'boolean', required: false, isVariant: false },
          { key: 'installation_or_demo_required', name: 'On-Farm Demonstration & Training Included', type: 'boolean', required: false, isVariant: false },
        ],
      },
      {
        name: "Irrigation Supplier",
        extraAttributes: [
          { key: 'product_type', name: 'Irrigation Category', type: 'select', required: true, isVariant: false, options: ['Drip Irrigation Kit', 'Rain Pipe Spray Line', 'Sprinkler System', 'HDPE Water Pipe', 'Submersible Pump Controller', 'Venturi Fertilizer Injector', 'Filters & Valves'] },
          { key: 'pipe_diameter', name: 'Pipe Diameter (mm / inch)', type: 'select', required: false, isVariant: true, options: ['12 mm', '16 mm', '20 mm', '2.5 inch', '3 inch', '4 inch'] },
          { key: 'pipe_length', name: 'Roll / Pipe Length', type: 'select', required: false, isVariant: true, options: ['100 Meters', '200 Meters', '400 Meters', '6 Meters Piece'] },
          { key: 'flow_rate', name: 'Dripper Discharge Flow Rate (LPH)', type: 'select', required: false, isVariant: false, options: ['2 LPH', '4 LPH', '8 LPH', '16 LPH'] },
          { key: 'pressure_rating', name: 'Pressure Rating (Kg/cm²)', type: 'text', required: false, isVariant: false, placeholder: '2.5 Kg/cm²' },
          { key: 'coverage_area', name: 'Coverage Area / Acreage Support', type: 'text', required: false, isVariant: false, placeholder: '1 Acre Drip Kit' },
          { key: 'installation_required', name: 'Field Layout & Pipe Fitting Service', type: 'boolean', required: false, isVariant: false },
        ],
      },
      { name: "Organic Farming Store" },
      {
        name: "Agriculture Input Wholesaler",
        productMode: 'wholesale',
        catalogueScope: 'vendor_procurement',
        extraAttributes: [
          { key: 'product_name', name: 'Wholesale Commodity / Item Name', type: 'text', required: true, isVariant: false },
          { key: 'input_category', name: 'Input Category', type: 'select', required: true, isVariant: false, options: ['Bulk Seeds', 'Commercial Fertilizers', 'Agro Chemicals', 'Shade Nets & Tarpaulins', 'Mulching Sheets', 'Nursery Polybags'] },
          { key: 'manufacturer', name: 'Company Manufacturer', type: 'text', required: true, isVariant: false },
          { key: 'selling_unit', name: 'Bulk Selling Unit', type: 'select', required: true, isVariant: false, options: ['Bag (50kg)', 'Box of 20 Pcs', 'Drum (200L)', 'Metric Tonne', 'Bundle (100m)'] },
          { key: 'minimum_order_quantity', name: 'Minimum Order Quantity (MOQ)', type: 'number', required: true, isVariant: false, unit: 'units' },
          { key: 'maximum_order_quantity', name: 'Max Order Quantity', type: 'number', required: false, isVariant: false, unit: 'units' },
          { key: 'tier_pricing', name: 'Tiered Quantity Discount Table Available', type: 'boolean', required: false, isVariant: false },
          { key: 'batch_number', name: 'Wholesale Batch Number', type: 'text', required: true, isVariant: false },
          { key: 'manufacturing_date', name: 'Manufacturing Date', type: 'text', required: false, isVariant: false, placeholder: 'YYYY-MM-DD' },
          { key: 'expiry_date', name: 'Expiry Date', type: 'text', required: false, isVariant: false, placeholder: 'YYYY-MM-DD' },
          { key: 'dispatch_time', name: 'Dispatch Lead Time (Days)', type: 'number', required: true, isVariant: false, unit: 'days' },
          { key: 'delivery_areas', name: 'Supported Transport Delivery Districts', type: 'textarea', required: false, isVariant: false },
          { key: 'sample_available', name: 'Paid Sample Kit Available', type: 'boolean', required: false, isVariant: false },
          { key: 'return_policy', name: 'Wholesale Return Policy Terms', type: 'text', required: false, isVariant: false },
        ],
      },
      {
        name: "Farm Equipment Rental Provider",
        productMode: 'not_applicable',
        supportedItemTypes: ['service'],
        catalogueScope: 'service_booking',
        extraAttributes: [
          { key: 'equipment_reference', name: 'Rental Machinery Name', type: 'text', required: true, isVariant: false, placeholder: 'Mahindra 45HP Tractor / Combine Harvester' },
          { key: 'rental_unit', name: 'Rental Charge Unit', type: 'select', required: true, isVariant: true, options: ['Per Hour', 'Per Acre', 'Per Day', 'Per Week'] },
          { key: 'hourly_rate', name: 'Hourly Rental Rate (INR)', type: 'number', required: false, isVariant: true, unit: 'INR' },
          { key: 'daily_rate', name: 'Daily Rental Rate (INR)', type: 'number', required: false, isVariant: true, unit: 'INR' },
          { key: 'weekly_rate', name: 'Weekly Rate (INR)', type: 'number', required: false, isVariant: false, unit: 'INR' },
          { key: 'security_deposit', name: 'Refundable Security Deposit (INR)', type: 'number', required: false, isVariant: false, unit: 'INR' },
          { key: 'operator_included', name: 'Tractor Driver / Operator Included', type: 'boolean', required: true, isVariant: false },
          { key: 'fuel_included', name: 'Diesel / Fuel Included in Rate', type: 'boolean', required: true, isVariant: false },
          { key: 'delivery_available', name: 'On-Farm Machinery Transport Included', type: 'boolean', required: true, isVariant: false },
          { key: 'service_radius', name: 'Service Travel Radius (KM)', type: 'number', required: true, isVariant: false, unit: 'km' },
          { key: 'minimum_rental_period', name: 'Minimum Rental Hours / Days', type: 'number', required: true, isVariant: false, unit: 'hours' },
          { key: 'available_dates_supported', name: 'Booking Calendar Dates Enabled', type: 'boolean', required: false, isVariant: false },
          { key: 'damage_policy', name: 'Breakdown / Damage Terms', type: 'textarea', required: false, isVariant: false },
          { key: 'late_return_charge', name: 'Overtime Hourly Penalty Rate (INR)', type: 'number', required: false, isVariant: false, unit: 'INR' },
        ],
      },
    ],
  },
];

export const seedShoppingTaxonomy = async () => {
  console.log('[SeedShoppingTaxonomy] Starting Shopping taxonomy seeding (1 Parent, 3 Subcategories, 36 Child Categories)...');

  // 1. Upsert Shopping Parent Category (Level 1)
  const parentCategory = await Category.findOneAndUpdate(
    { slug: 'shopping' },
    {
      $set: {
        name: 'Shopping',
        slug: 'shopping',
        description: 'Complete Shopping Vertical: Fashion & Lifestyle, Home & Living, Agriculture & Garden',
        level: 1,
        parentId: null,
        supportedItemTypes: ['product', 'service'],
        displayOrder: 4,
        isActive: true,
        isFeatured: true,
        image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&auto=format&fit=crop&q=80',
        banner: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&auto=format&fit=crop&q=80',
      },
    },
    { upsert: true, new: true }
  );

  // Cleanup obsolete shopping subcategories & children
  const validSubSlugs = SHOPPING_TAXONOMY.map(s => s.slug);
  const obsoleteSubDocs = await Category.find({ parentId: parentCategory._id, level: 2, slug: { $nin: validSubSlugs } });
  for (const obsSub of obsoleteSubDocs) {
    const obsChildDocs = await Category.find({ parentId: obsSub._id, level: 3 });
    const obsChildIds = obsChildDocs.map(c => c._id);
    await CategoryProductSchema.deleteMany({ categoryId: { $in: [obsSub._id, ...obsChildIds] } });
    await Category.deleteMany({ _id: { $in: [obsSub._id, ...obsChildIds] } });
  }

  let subCount = 0;
  let childCount = 0;
  let schemaCount = 0;

  for (let sIdx = 0; sIdx < SHOPPING_TAXONOMY.length; sIdx++) {
    const subDef = SHOPPING_TAXONOMY[sIdx];
    if (!subDef) continue;

    // 2. Upsert Subcategory (Level 2)
    const subCategory = await Category.findOneAndUpdate(
      { slug: subDef.slug },
      {
        $set: {
          name: subDef.name,
          slug: subDef.slug,
          description: `${subDef.name} subcategory under Shopping`,
          level: 2,
          parentId: parentCategory._id,
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
            mode: subDef.slug.includes('agriculture') ? 'batch_expiry' : 'variant',
            requiresBatch: subDef.slug.includes('agriculture'),
            requiresExpiry: subDef.slug.includes('agriculture'),
            supportsReservedStock: true,
            supportsDamagedStock: true,
          },
          deliveryPolicy: {
            homeDelivery: true,
            storePickup: true,
            sameDay: true,
            scheduled: true,
          },
          compliancePolicy: {
            requiredDocuments: subDef.slug.includes('agriculture') ? ['Agriculture Licence', 'GST Certificate'] : ['GST Certificate'],
            optionalDocuments: [],
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
      const childDef = children[chIdx];
      const childName = childDef.name;
      const childSlug = childDef.slug || `${subDef.slug}-${makeSlug(childName)}`;

      const mergedAttributes = [
        ...subDef.attributes,
        ...(childDef.extraAttributes || []),
      ];

      const childSupportedTypes = childDef.supportedItemTypes || subDef.supportedItemTypes;
      const childProductMode = childDef.productMode || subDef.productMode;

      const childCategory = await Category.findOneAndUpdate(
        { slug: childSlug },
        {
          $set: {
            name: childName,
            slug: childSlug,
            description: `${childName} child category under ${subDef.name}`,
            level: 3,
            parentId: subCategory._id,
            supportedItemTypes: childSupportedTypes,
            displayOrder: chIdx + 1,
            isActive: true,
            attributes: mergedAttributes as any,
          },
        },
        { upsert: true, new: true }
      );
      childCount++;

      // Upsert Child Category Override Schema
      await CategoryProductSchema.findOneAndUpdate(
        { categoryId: childCategory._id },
        {
          $set: {
            categoryId: childCategory._id,
            subcategoryId: subCategory._id,
            isChildOverride: true,
            schemaVersion: 1,
            productMode: childProductMode,
            allowedVendorCapabilities: subDef.allowedCapabilities,
            allowedItemTypes: childSupportedTypes,
            attributes: mergedAttributes as any,
            variantAttributes: mergedAttributes.filter(a => a.isVariant).map(a => a.key),
            inventoryPolicy: {
              mode: childDef.inventoryMode || (subDef.slug.includes('agriculture') ? 'batch_expiry' : 'variant'),
              requiresBatch: subDef.slug.includes('agriculture'),
              requiresExpiry: subDef.slug.includes('agriculture'),
              supportsReservedStock: true,
              supportsDamagedStock: true,
            },
            customizationPolicy: {
              enabled: childProductMode === 'customizable' || childProductMode === 'made_to_order',
              fields: [],
              requiresCustomerUpload: childName.includes('Tailor') || childName.includes('Custom'),
              requiresApproval: childProductMode === 'made_to_order',
            },
            deliveryPolicy: {
              homeDelivery: true,
              storePickup: true,
              sameDay: true,
              scheduled: true,
            },
            compliancePolicy: {
              requiredDocuments: subDef.slug.includes('agriculture') ? ['Agriculture Licence', 'GST Certificate'] : ['GST Certificate'],
              optionalDocuments: [],
            },
            isPublished: true,
          },
        },
        { upsert: true, new: true }
      );
      schemaCount++;
    }
  }

  console.log(`[SeedShoppingTaxonomy] Seeding completed! 1 Parent (shopping), ${subCount} L2 Subcategories, ${childCount} L3 Child Categories, and ${schemaCount} CategoryProductSchemas upserted successfully.`);
  return { parentCount: 1, subCount, childCount, schemaCount };
};

const runDirect = async () => {
  if (require.main === module) {
    try {
      const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
      await mongoose.connect(mongoURI);
      console.log('Connected to MongoDB. Running Shopping taxonomy seed...');
      await seedShoppingTaxonomy();
      process.exit(0);
    } catch (err) {
      console.error('Seed execution error:', err);
      process.exit(1);
    }
  }
};

runDirect();
