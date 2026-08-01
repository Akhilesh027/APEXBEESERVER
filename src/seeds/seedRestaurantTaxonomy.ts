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

export interface IRestaurantTaxonomySubcategory {
  name: string;
  slug: string;
  catalogueScope: 'customer_menu' | 'restaurant_procurement';
  allowedCapabilities: string[];
  productMode: 'standard' | 'fresh' | 'food' | 'customizable' | 'made_to_order' | 'combo' | 'subscription' | 'wholesale' | 'digital' | 'not_applicable';
  supportedItemTypes: ('restaurant' | 'product' | 'service')[];
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
  childCategories: string[];
}

export const RESTAURANT_TAXONOMY: IRestaurantTaxonomySubcategory[] = [
  {
    name: 'Restaurants and Dining',
    slug: 'restaurants-and-dining',
    catalogueScope: 'customer_menu',
    allowedCapabilities: [
      'full_service_restaurant', 'family_restaurant', 'fine_dining_restaurant',
      'casual_dining_restaurant', 'quick_service_restaurant', 'pure_veg_restaurant',
      'non_veg_restaurant', 'multi_cuisine_restaurant', 'biryani_outlet'
    ],
    productMode: 'food',
    supportedItemTypes: ['restaurant', 'product'],
    attributes: [
      { key: 'menu_section', name: 'Menu Section', type: 'select', required: true, isVariant: false, options: ['Breakfast', 'Tiffins', 'Starters', 'Soups', 'Main Course', 'Curries', 'Rice and Biryani', 'Breads', 'Snacks', 'Chaat', 'Fast Food', 'Beverages', 'Desserts', 'Combos', 'Family Packs', 'Kids Menu', 'Specials'] },
      { key: 'food_type', name: 'Food Type', type: 'select', required: true, isVariant: true, options: ['veg', 'non_veg', 'egg', 'vegan', 'jain'] },
      { key: 'cuisine_tags', name: 'Cuisine Tags', type: 'multiselect', required: true, isVariant: false, options: ['andhra', 'telangana', 'south_indian', 'north_indian', 'hyderabadi', 'chinese', 'indo_chinese', 'arabian', 'mughlai', 'continental', 'italian', 'mexican', 'seafood', 'healthy', 'vegan', 'jain', 'regional', 'multi_cuisine'] },
      { key: 'serving_size', name: 'Serving Size / Portion', type: 'select', required: true, isVariant: true, options: ['Single', 'Regular', 'Large', 'Half', 'Full', 'Family Pack', 'Jumbo'] },
      { key: 'preparation_time_minutes', name: 'Preparation Time (Mins)', type: 'number', required: true, isVariant: false, unit: 'mins' },
      { key: 'spice_level', name: 'Spice Level', type: 'select', required: false, isVariant: true, options: ['Mild', 'Medium', 'Spicy', 'Extra Spicy'] },
      { key: 'is_bestseller', name: 'Bestseller', type: 'boolean', required: false, isVariant: false },
      { key: 'is_chef_special', name: 'Chef Special', type: 'boolean', required: false, isVariant: false },
    ],
    childCategories: [
      'Full-Service Restaurant', 'Family Restaurant', 'Fine Dining Restaurant',
      'Casual Dining Restaurant', 'Quick-Service Restaurant', 'Pure Vegetarian Restaurant',
      'Non-Vegetarian Restaurant', 'Multi-Cuisine Restaurant', 'Biryani Restaurant',
      'Seafood Restaurant', 'Dhaba', 'Buffet Restaurant', 'Rooftop Restaurant', 'Food Court Outlet'
    ],
  },
  {
    name: 'Cloud and Home Kitchens',
    slug: 'cloud-and-home-kitchens',
    catalogueScope: 'customer_menu',
    allowedCapabilities: [
      'cloud_kitchen', 'home_kitchen', 'delivery_only_kitchen', 'corporate_meal_provider'
    ],
    productMode: 'food',
    supportedItemTypes: ['restaurant', 'product'],
    attributes: [
      { key: 'menu_section', name: 'Menu Section', type: 'select', required: true, isVariant: false, options: ['Breakfast', 'Lunch Box', 'Dinner Box', 'Starters', 'Main Course', 'Biryani', 'Snacks', 'Beverages', 'Desserts', 'Combos'] },
      { key: 'food_type', name: 'Food Type', type: 'select', required: true, isVariant: true, options: ['veg', 'non_veg', 'egg', 'vegan', 'jain'] },
      { key: 'delivery_only', name: 'Delivery Only', type: 'boolean', required: true, isVariant: false },
      { key: 'packaging_type', name: 'Packaging Type', type: 'select', required: true, isVariant: false, options: ['Meal Box', 'CPET Tray', 'Aluminium Container', 'Eco Container', 'Standard Plastic'] },
      { key: 'reheating_instructions', name: 'Reheating Instructions', type: 'text', required: false, isVariant: false, placeholder: 'Microwave 2 mins or heat in pan' },
      { key: 'preparation_time_minutes', name: 'Preparation Time (Mins)', type: 'number', required: true, isVariant: false, unit: 'mins' },
    ],
    childCategories: [
      'Cloud Kitchen', 'Home Kitchen', 'Delivery-Only Kitchen', 'Biryani Cloud Kitchen',
      'Healthy Food Kitchen', 'Meal Box Kitchen', 'Corporate Lunch Kitchen',
      'Diet Food Kitchen', 'Multi-Brand Cloud Kitchen'
    ],
  },
  {
    name: 'Curry Points and Meal Providers',
    slug: 'curry-points-and-meal-providers',
    catalogueScope: 'customer_menu',
    allowedCapabilities: [
      'tiffin_center', 'home_kitchen', 'cloud_kitchen', 'corporate_meal_provider', 'meal_subscription_provider'
    ],
    productMode: 'food',
    supportedItemTypes: ['restaurant', 'product'],
    attributes: [
      { key: 'meal_type', name: 'Meal Category', type: 'select', required: true, isVariant: false, options: ['Veg Curry', 'Non-Veg Curry', 'Dal / Sambhar', 'Full Meals', 'Executive Lunch Box', 'Diet Meal', 'Combo Meals', 'Snacks & Sides'] },
      { key: 'food_type', name: 'Food Type', type: 'select', required: true, isVariant: true, options: ['veg', 'non_veg', 'egg', 'jain'] },
      { key: 'portion_size', name: 'Portion / Quantity', type: 'select', required: true, isVariant: true, options: ['Half (250ml)', 'Full (500ml)', 'Family Container (1L)', 'Single Meal Box', 'Jumbo Meal Box'] },
      { key: 'spice_level', name: 'Spice Level', type: 'select', required: false, isVariant: true, options: ['Mild', 'Medium', 'Andhra Spicy', 'Extra Hot'] },
      { key: 'daily_menu_available', name: 'Daily Changing Menu', type: 'boolean', required: false, isVariant: false },
    ],
    childCategories: [
      'Curry Point',
      'Veg Curry Center',
      'Non-Veg Curry Center',
      'Mixed Curry Point',
      'Mess Service',
      'Home Kitchen',
      'Daily Meal Provider',
      'Ready-to-Eat Food Kitchen',
      'Corporate Meal Kitchen',
      'Subscription Meal Provider'
    ],
  },
  {
    name: 'Tiffin and Breakfast Outlets',
    slug: 'tiffin-and-breakfast-outlets',
    catalogueScope: 'customer_menu',
    allowedCapabilities: [
      'tiffin_center', 'breakfast_center', 'street_food_vendor'
    ],
    productMode: 'food',
    supportedItemTypes: ['restaurant', 'product'],
    attributes: [
      { key: 'breakfast_type', name: 'Breakfast Category', type: 'select', required: true, isVariant: false, options: ['Idly', 'Dosa', 'Vada', 'Puri', 'Upma', 'Pesarattu', 'Chapati', 'Pongal', 'Paratha', 'Combo'] },
      { key: 'food_type', name: 'Food Type', type: 'select', required: true, isVariant: true, options: ['veg', 'jain'] },
      { key: 'pieces_per_plate', name: 'Pieces Per Plate / Portion', type: 'number', required: true, isVariant: true, unit: 'pieces' },
      { key: 'chutney_included', name: 'Chutney Included', type: 'boolean', required: true, isVariant: false },
      { key: 'sambar_included', name: 'Sambar Included', type: 'boolean', required: true, isVariant: false },
      { key: 'available_from', name: 'Available From Time', type: 'text', required: true, isVariant: false, placeholder: '06:00 AM' },
      { key: 'available_until', name: 'Available Until Time', type: 'text', required: true, isVariant: false, placeholder: '11:30 AM' },
    ],
    childCategories: [
      'Tiffin Center', 'South Indian Breakfast Center', 'Idly and Dosa Outlet',
      'Puri and Chapati Center', 'Breakfast Cart', 'Millet Breakfast Outlet',
      'All-Day Breakfast Outlet'
    ],
  },
  {
    name: 'Street Food and Mobile Vendors',
    slug: 'street-food-and-mobile-vendors',
    catalogueScope: 'customer_menu',
    allowedCapabilities: [
      'street_food_vendor', 'food_cart', 'food_truck', 'chaat_snacks_outlet',
      'shawarma_outlet', 'chinese_fast_food', 'fast_food_outlet'
    ],
    productMode: 'food',
    supportedItemTypes: ['restaurant', 'product'],
    attributes: [
      { key: 'street_food_type', name: 'Street Food Type', type: 'select', required: true, isVariant: false, options: ['Chaat', 'Pani Puri', 'Fast Food', 'Shawarma', 'Momos', 'Biryani Point', 'Noodles', 'Kebab / Fry'] },
      { key: 'food_type', name: 'Food Type', type: 'select', required: true, isVariant: true, options: ['veg', 'non_veg', 'egg', 'jain'] },
      { key: 'spice_level', name: 'Spice Level', type: 'select', required: false, isVariant: true, options: ['Mild', 'Medium', 'Spicy', 'Extra Spicy'] },
      { key: 'serving_method', name: 'Serving Method', type: 'select', required: true, isVariant: false, options: ['Plate', 'Parcel Container', 'Paper Cone', 'Roll Wrapper'] },
      { key: 'estimated_wait_time', name: 'Estimated Wait Time (Mins)', type: 'number', required: true, isVariant: false, unit: 'mins' },
    ],
    childCategories: [
      'Street Food Vendor', 'Food Cart or Bandi', 'Food Truck', 'Pani Puri Stall',
      'Chaat Center', 'Fast Food Stall', 'Biryani Point', 'Shawarma Stall',
      'Chinese Fast Food Stall', 'Momos Stall', 'Festival Food Stall', 'Temporary Event Stall'
    ],
  },
  {
    name: 'Cafes and Beverage Outlets',
    slug: 'cafes-and-beverage-outlets',
    catalogueScope: 'customer_menu',
    allowedCapabilities: [
      'cafe', 'tea_stall', 'coffee_shop', 'juice_shop'
    ],
    productMode: 'food',
    supportedItemTypes: ['restaurant', 'product'],
    attributes: [
      { key: 'beverage_type', name: 'Beverage Category', type: 'select', required: true, isVariant: false, options: ['Tea', 'Coffee', 'Fresh Juice', 'Milkshake', 'Lassi', 'Mocktail', 'Smoothie', 'Cooler', 'Bottled'] },
      { key: 'served_hot_or_cold', name: 'Serving Temperature', type: 'select', required: true, isVariant: true, options: ['Hot', 'Cold', 'Iced', 'Room Temp'] },
      { key: 'volume_ml', name: 'Volume / Size', type: 'select', required: true, isVariant: true, options: ['150 ml', '250 ml', '350 ml', '500 ml', '1 Litre', 'Regular', 'Large'] },
      { key: 'sugar_level', name: 'Sugar Customization', type: 'select', required: false, isVariant: true, options: ['Normal Sugar', 'Less Sugar', 'No Sugar', 'Jaggery', 'Sugar Free'] },
      { key: 'ice_level', name: 'Ice Customization', type: 'select', required: false, isVariant: true, options: ['Normal Ice', 'Less Ice', 'No Ice'] },
    ],
    childCategories: [
      'Cafe', 'Tea Stall', 'Coffee Shop', 'Juice Shop', 'Milkshake Shop',
      'Lassi Shop', 'Mocktail Bar', 'Beverage Kiosk', 'Mobile Beverage Cart'
    ],
  },
  {
    name: 'Bakery and Cake Shops',
    slug: 'bakery-and-cake-shops',
    catalogueScope: 'customer_menu',
    allowedCapabilities: [
      'bakery', 'cake_shop', 'sweet_shop'
    ],
    productMode: 'customizable',
    supportedItemTypes: ['restaurant', 'product'],
    attributes: [
      { key: 'bakery_category', name: 'Bakery Category', type: 'select', required: true, isVariant: false, options: ['Fresh Cake', 'Custom Birthday Cake', 'Pastry', 'Bread & Buns', 'Puffs & Savouries', 'Cookies & Biscuits', 'Donuts & Muffins', 'Artisan Bread'] },
      { key: 'egg_or_eggless', name: 'Egg Preference', type: 'select', required: true, isVariant: true, options: ['Eggless', 'Contains Egg'] },
      { key: 'weight_pack', name: 'Weight / Pack Size', type: 'select', required: true, isVariant: true, options: ['250g', '500g', '1 kg', '2 kg', '3 kg', 'Pack of 2', 'Pack of 6', 'Pack of 12'] },
      { key: 'flavor', name: 'Flavor', type: 'select', required: true, isVariant: true, options: ['Chocolate', 'Vanilla', 'Butterscotch', 'Black Forest', 'Red Velvet', 'Pineapple', 'Mango', 'Strawberry', 'Fruit & Nut', 'Truffle'] },
      { key: 'custom_message_allowed', name: 'Custom Message Allowed', type: 'boolean', required: false, isVariant: false },
      { key: 'shelf_life_days', name: 'Shelf Life (Days)', type: 'number', required: true, isVariant: false, unit: 'days' },
    ],
    childCategories: [
      'Bakery Shop',
      'Cake Shop',
      'Home Bakery',
      'Pastry Shop',
      'Biscuit Bakery',
      'Artisan Bakery',
      'Sweet Bakery',
      'Wholesale Bakery',
      'Custom Cake Studio',
      'Dessert Bakery'
    ],
  },
  {
    name: 'Sweets, Mithai and Desserts',
    slug: 'sweets-mithai-and-desserts',
    catalogueScope: 'customer_menu',
    allowedCapabilities: [
      'sweet_shop', 'ice_cream_shop', 'dessert_shop', 'prasadam_partner'
    ],
    productMode: 'food',
    supportedItemTypes: ['restaurant', 'product'],
    attributes: [
      { key: 'sweet_category', name: 'Sweet Category', type: 'select', required: true, isVariant: false, options: ['Traditional Indian Sweets', 'Ghee Sweets', 'Dry Fruit Sweets', 'Bengali Sweets', 'Milk Sweets', 'Halwa', 'Namkeen & Snacks', 'Festival Gift Boxes', 'Prasadam'] },
      { key: 'pack_weight', name: 'Pack Weight', type: 'select', required: true, isVariant: true, options: ['250g', '500g', '1 kg', '2 kg', 'Assorted Gift Box (500g)', 'Assorted Gift Box (1kg)'] },
      { key: 'sweetness_level', name: 'Sweetness Level', type: 'select', required: false, isVariant: true, options: ['Normal Sweet', 'Less Sugar', 'Sugar-Free (Jaggery/Stevia)'] },
      { key: 'shelf_life_days', name: 'Shelf Life (Days)', type: 'number', required: true, isVariant: false, unit: 'days' },
      { key: 'fssai_number', name: 'FSSAI License Number', type: 'text', required: true, isVariant: false },
    ],
    childCategories: [
      'Traditional Sweet Shop',
      'Halwai Shop',
      'Dry Fruit Sweet Shop',
      'Bengali Sweet Shop',
      'Home Sweet Maker',
      'Premium Sweet Boutique',
      'Festival Sweet and Gift Shop',
      'Corporate Sweet Supplier',
      'Temple Prasadam Sweet Supplier',
      'Namkeen and Traditional Snacks Shop'
    ],
  },
  {
    name: 'Fast Food and Snacks',
    slug: 'fast-food-and-snacks',
    catalogueScope: 'customer_menu',
    allowedCapabilities: [
      'fast_food_outlet', 'chaat_snacks_outlet', 'chinese_fast_food'
    ],
    productMode: 'food',
    supportedItemTypes: ['restaurant', 'product'],
    attributes: [
      { key: 'fast_food_type', name: 'Fast Food Type', type: 'select', required: true, isVariant: false, options: ['Burger', 'Pizza', 'Sandwich', 'Rolls & Wraps', 'Fried Chicken', 'Momos', 'Chaat', 'Samosa / Pakoda', 'Noodles / Manchurian'] },
      { key: 'food_type', name: 'Food Type', type: 'select', required: true, isVariant: true, options: ['veg', 'non_veg', 'egg', 'vegan', 'jain'] },
      { key: 'portion', name: 'Portion / Size', type: 'select', required: true, isVariant: true, options: ['Single', 'Double', 'Regular', 'Medium', 'Large', 'Pack of 2', 'Family Combo'] },
      { key: 'preparation_time', name: 'Preparation Time (Mins)', type: 'number', required: true, isVariant: false, unit: 'mins' },
    ],
    childCategories: [
      'Fast Food Outlet', 'Burger Outlet', 'Pizza Outlet', 'Sandwich Outlet',
      'Rolls and Wraps Outlet', 'Fried Chicken Outlet', 'Momos Outlet',
      'Chaat and Snacks Outlet', 'Samosa and Pakoda Outlet', 'Noodles and Manchurian Outlet'
    ],
  },
  {
    name: 'Catering and Bulk Food Services',
    slug: 'catering-and-bulk-food-services',
    catalogueScope: 'customer_menu',
    allowedCapabilities: [
      'catering_service', 'corporate_meal_provider'
    ],
    productMode: 'made_to_order',
    supportedItemTypes: ['restaurant', 'service'],
    attributes: [
      { key: 'service_type', name: 'Catering Event Type', type: 'select', required: true, isVariant: false, options: ['Wedding', 'Event', 'Corporate Lunch', 'Party', 'Institutional', 'School / College', 'Community Meal', 'Custom Package'] },
      { key: 'minimum_people', name: 'Minimum Guests / People', type: 'number', required: true, isVariant: false, unit: 'persons' },
      { key: 'maximum_people', name: 'Maximum Capacity (Guests)', type: 'number', required: false, isVariant: false, unit: 'persons' },
      { key: 'price_per_plate', name: 'Price Per Plate (INR)', type: 'number', required: true, isVariant: true, unit: 'INR' },
      { key: 'lead_time_days', name: 'Lead Time Required (Days)', type: 'number', required: true, isVariant: false, unit: 'days' },
      { key: 'service_staff_included', name: 'Service Staff Included', type: 'boolean', required: false, isVariant: false },
      { key: 'serving_material_included', name: 'Serving Material Included', type: 'boolean', required: false, isVariant: false },
    ],
    childCategories: [
      'Wedding Catering', 'Event Catering', 'Corporate Catering', 'Institutional Catering',
      'Party Food Orders', 'Bulk Meal Boxes', 'Corporate Lunch Orders',
      'School and College Catering', 'Community Meal Service', 'Custom Catering Service'
    ],
  },
  {
    name: 'Meal Plans and Subscriptions',
    slug: 'meal-plans-and-subscriptions',
    catalogueScope: 'customer_menu',
    allowedCapabilities: [
      'meal_subscription_provider', 'tiffin_center', 'home_kitchen', 'cloud_kitchen', 'corporate_meal_provider'
    ],
    productMode: 'subscription',
    supportedItemTypes: ['restaurant', 'product'],
    attributes: [
      { key: 'plan_type', name: 'Subscription Plan Duration', type: 'select', required: true, isVariant: true, options: ['Daily', 'Weekly (6 Days)', 'Monthly (26 Days)', 'Custom Cycle'] },
      { key: 'meals_per_day', name: 'Meals Per Day', type: 'select', required: true, isVariant: true, options: ['1 Meal (Lunch or Dinner)', '2 Meals (Lunch + Dinner)', '3 Meals (Breakfast + Lunch + Dinner)'] },
      { key: 'veg_non_veg', name: 'Meal Preference', type: 'select', required: true, isVariant: true, options: ['Pure Veg', 'Non-Veg Mixed', 'Diet / Healthy', 'Jain Special'] },
      { key: 'pause_allowed', name: 'Pause / Skip Subscription Allowed', type: 'boolean', required: true, isVariant: false },
      { key: 'minimum_commitment', name: 'Minimum Commitment Days', type: 'number', required: true, isVariant: false, unit: 'days' },
    ],
    childCategories: [
      'Daily Meal Plan', 'Weekly Meal Plan', 'Monthly Meal Plan', 'Office Lunch Subscription',
      'Student Meal Subscription', 'Diet Meal Subscription', 'Senior Citizen Meal Plan',
      'Breakfast Subscription', 'Custom Meal Subscription'
    ],
  },
  {
    name: 'Restaurant Raw Materials',
    slug: 'restaurant-raw-materials',
    catalogueScope: 'restaurant_procurement',
    allowedCapabilities: [
      'restaurant_raw_material_wholesaler', 'vegetable_supplier', 'fruit_supplier',
      'meat_supplier', 'seafood_supplier', 'dairy_supplier', 'bakery_ingredient_supplier'
    ],
    productMode: 'wholesale',
    supportedItemTypes: ['product'],
    attributes: [
      { key: 'raw_material_category', name: 'Raw Material Type', type: 'select', required: true, isVariant: false, options: ['Vegetables', 'Fruits', 'Chicken', 'Mutton', 'Fish & Seafood', 'Eggs', 'Rice & Grains', 'Pulses & Dal', 'Cooking Oils', 'Masalas & Spices', 'Dairy Products', 'Bakery Ingredients', 'Frozen Foods', 'Ready-to-Cook', 'Beverages & Concentrates'] },
      { key: 'quality_type', name: 'Quality / Grade', type: 'select', required: true, isVariant: true, options: ['Grade A Commercial', 'Premium Restaurant Quality', 'Standard', 'Organic'] },
      { key: 'selling_unit', name: 'Wholesale Selling Unit', type: 'select', required: true, isVariant: false, options: ['Kg', 'Quintal (100kg)', 'Tonne', 'Tray (30 Eggs)', 'Crate', 'Liter', 'Carton', 'Bag (25kg)', 'Bag (50kg)'] },
      { key: 'pack_size', name: 'Pack Size / Net Quantity', type: 'text', required: true, isVariant: true, placeholder: '25 kg bag / 15L tin' },
      { key: 'moq', name: 'Minimum Order Quantity (MOQ)', type: 'number', required: true, isVariant: false, unit: 'units' },
      { key: 'dispatch_days', name: 'Dispatch Lead Time (Days)', type: 'number', required: true, isVariant: false, unit: 'days' },
      { key: 'gst_rate', name: 'GST Percentage', type: 'select', required: true, isVariant: false, options: ['0%', '5%', '12%', '18%', '28%'] },
      { key: 'hsn_code', name: 'HSN Code', type: 'text', required: false, isVariant: false },
    ],
    childCategories: [
      'Vegetables', 'Fruits', 'Chicken', 'Mutton', 'Fish and Seafood', 'Eggs',
      'Rice and Grains', 'Pulses and Dal', 'Cooking Oils', 'Masalas and Spices',
      'Dairy Products', 'Bakery Ingredients', 'Frozen Foods', 'Ready-to-Cook Products',
      'Beverages and Concentrates'
    ],
  },
  {
    name: 'Restaurant Supplies',
    slug: 'restaurant-supplies',
    catalogueScope: 'restaurant_procurement',
    allowedCapabilities: [
      'packaging_supplier', 'restaurant_supply_vendor'
    ],
    productMode: 'wholesale',
    supportedItemTypes: ['product'],
    attributes: [
      { key: 'supply_category', name: 'Supply Category', type: 'select', required: true, isVariant: false, options: ['Packaging Materials', 'Disposable Plates', 'Paper Cups', 'Food Containers', 'Carry Bags', 'Cleaning Products', 'Kitchen Consumables', 'Gas Accessories', 'Billing Rolls', 'Uniforms', 'Hygiene Supplies'] },
      { key: 'material', name: 'Material Type', type: 'select', required: false, isVariant: true, options: ['Biodegradable Paper', 'Aluminium', 'CPET / Polypropylene', 'Plastic', 'Bagasse / Sugarcane', 'Cotton / Fabric', 'Stainless Steel'] },
      { key: 'pack_quantity', name: 'Pack Quantity / Count', type: 'select', required: true, isVariant: true, options: ['100 pcs', '250 pcs', '500 pcs', '1000 pcs', 'Box of 50', 'Roll of 10'] },
      { key: 'moq', name: 'Minimum Order Quantity (MOQ)', type: 'number', required: true, isVariant: false, unit: 'packs' },
      { key: 'food_grade', name: 'Food Grade Certified', type: 'boolean', required: true, isVariant: false },
      { key: 'gst_rate', name: 'GST Percentage', type: 'select', required: true, isVariant: false, options: ['0%', '5%', '12%', '18%', '28%'] },
      { key: 'hsn_code', name: 'HSN Code', type: 'text', required: false, isVariant: false },
    ],
    childCategories: [
      'Packaging Materials', 'Disposable Plates', 'Paper Cups', 'Food Containers',
      'Carry Bags', 'Cleaning Products', 'Kitchen Consumables', 'Gas Accessories',
      'Billing Rolls', 'Uniforms', 'Hygiene Supplies'
    ],
  },
];

export const seedRestaurantTaxonomy = async () => {
  console.log('[SeedRestaurantTaxonomy] Starting Food & Dining taxonomy seeding (1 Parent, 13 Subcategories, 136 Child Categories)...');

  // 1. Upsert Restaurant Parent Category (Level 1)
  const parentCategory = await Category.findOneAndUpdate(
    { slug: 'restaurant' },
    {
      $set: {
        name: 'Food & Dining',
        slug: 'restaurant',
        description: 'Complete Food & Dining, Restaurant, Curry Points, Bakery, Sweets, Catering & Procurement Vertical',
        level: 1,
        parentId: null,
        supportedItemTypes: ['restaurant', 'product', 'service'],
        displayOrder: 2,
        isActive: true,
        isFeatured: true,
        image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=80',
        banner: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&auto=format&fit=crop&q=80',
      },
    },
    { upsert: true, new: true }
  );

  // Cleanup obsolete restaurant subcategories & children that are no longer in RESTAURANT_TAXONOMY
  const validSubSlugs = RESTAURANT_TAXONOMY.map(s => `restaurant-${s.slug}`);
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

  for (let sIdx = 0; sIdx < RESTAURANT_TAXONOMY.length; sIdx++) {
    const subDef = RESTAURANT_TAXONOMY[sIdx];
    if (!subDef) continue;
    const subSlug = `restaurant-${subDef.slug}`;

    // 2. Upsert Subcategory (Level 2)
    const subCategory = await Category.findOneAndUpdate(
      { slug: subSlug },
      {
        $set: {
          name: subDef.name,
          slug: subSlug,
          description: `${subDef.name} subcategory under Restaurant & Food`,
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
            mode: subDef.catalogueScope === 'restaurant_procurement'
              ? 'variant'
              : subDef.productMode === 'subscription'
              ? 'capacity'
              : subDef.productMode === 'made_to_order'
              ? 'made_to_order'
              : 'standard',
            requiresBatch: subDef.catalogueScope === 'restaurant_procurement' || subDef.productMode === 'food',
            requiresExpiry: subDef.catalogueScope === 'restaurant_procurement' || subDef.productMode === 'food',
            supportsReservedStock: true,
            supportsDamagedStock: true,
            supportsRawMaterials: subDef.catalogueScope === 'restaurant_procurement',
          },
          customizationPolicy: {
            enabled: subDef.productMode === 'customizable' || subDef.productMode === 'made_to_order' || subDef.slug.includes('bakery'),
            fields: [],
            requiresCustomerUpload: subDef.slug.includes('bakery'),
            requiresPreview: false,
            requiresApproval: subDef.productMode === 'made_to_order',
          },
          workflowPolicy: {
            workflowType: subDef.catalogueScope === 'restaurant_procurement' ? 'standard' : 'food',
            stages: ['order_confirmed', 'preparing', 'packed', 'out_for_delivery', 'delivered'],
          },
          deliveryPolicy: {
            homeDelivery: true,
            storePickup: true,
            sameDay: true,
            scheduled: true,
            fragile: subDef.slug.includes('bakery'),
            mergedDelivery: true,
            multiVendorDelivery: true,
          },
          compliancePolicy: {
            requiredDocuments: subDef.catalogueScope === 'restaurant_procurement'
              ? ['GST Certificate', 'FSSAI License']
              : ['FSSAI License'],
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
              mode: subDef.catalogueScope === 'restaurant_procurement'
                ? 'variant'
                : subDef.productMode === 'subscription'
                ? 'capacity'
                : subDef.productMode === 'made_to_order'
                ? 'made_to_order'
                : 'standard',
              requiresBatch: subDef.catalogueScope === 'restaurant_procurement' || subDef.productMode === 'food',
              requiresExpiry: subDef.catalogueScope === 'restaurant_procurement' || subDef.productMode === 'food',
              supportsReservedStock: true,
              supportsDamagedStock: true,
              supportsRawMaterials: subDef.catalogueScope === 'restaurant_procurement',
            },
            deliveryPolicy: {
              homeDelivery: true,
              storePickup: true,
              sameDay: true,
              scheduled: true,
              fragile: childName.toLowerCase().includes('cake'),
              mergedDelivery: true,
              multiVendorDelivery: true,
            },
            compliancePolicy: {
              requiredDocuments: subDef.catalogueScope === 'restaurant_procurement'
                ? ['GST Certificate', 'FSSAI License']
                : ['FSSAI License'],
              optionalDocuments: ['GST Certificate'],
            },
            isPublished: true,
          },
        },
        { upsert: true, new: true }
      );
      schemaCount++;
    }
  }

  console.log(`[SeedRestaurantTaxonomy] Seeding completed! 1 Parent (restaurant), ${subCount} L2 Subcategories, ${childCount} L3 Child Categories, and ${schemaCount} CategoryProductSchemas upserted successfully.`);
  return { parentCount: 1, subCount, childCount, schemaCount };
};

const runDirect = async () => {
  if (require.main === module) {
    try {
      const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
      await mongoose.connect(mongoURI);
      console.log('Connected to MongoDB. Running Restaurant taxonomy seed...');
      await seedRestaurantTaxonomy();
      process.exit(0);
    } catch (err) {
      console.error('Seed execution error:', err);
      process.exit(1);
    }
  }
};

runDirect();
