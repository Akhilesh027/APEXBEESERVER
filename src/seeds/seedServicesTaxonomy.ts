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

export interface IServicesSubcategoryDef {
  name: string;
  slug: string;
  allowedCapabilities: string[];
  productMode: 'not_applicable' | 'customizable' | 'subscription' | 'wholesale' | 'standard' | 'made_to_order';
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
    productMode?: 'not_applicable' | 'customizable' | 'subscription' | 'wholesale' | 'standard' | 'made_to_order';
    supportedItemTypes?: string[];
    catalogueScope?: 'service_booking' | 'service_plan' | 'vendor_procurement' | 'customer_retail' | 'corporate_contract';
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

export const SERVICES_TAXONOMY: IServicesSubcategoryDef[] = [
  {
    name: 'Home Appliances Repair & Maintenance',
    slug: 'services-home-appliances-repair-maintenance',
    allowedCapabilities: [
      'individual_appliance_technician', 'appliance_service_center', 'authorized_appliance_service_center',
      'freelancer_technician', 'appliance_service_franchise', 'ac_technician', 'refrigerator_technician',
      'washing_machine_technician', 'tv_electronics_technician', 'ro_purifier_technician', 'geyser_technician',
      'kitchen_appliance_technician', 'electrician', 'multi_appliance_technician', 'appliance_spare_parts_supplier'
    ],
    productMode: 'not_applicable',
    supportedItemTypes: ['service', 'product'],
    attributes: [
      { key: 'service_name', name: 'Service Name', type: 'text', required: true, isVariant: false, placeholder: 'e.g. AC General Wet Service / Refrigerator Gas Filling' },
      { key: 'appliance_category', name: 'Appliance Category', type: 'select', required: true, isVariant: false, options: ['Air Conditioner', 'Refrigerator', 'Washing Machine', 'Television & Audio', 'RO Water Purifier', 'Geyser & Water Heater', 'Microwave & Oven', 'Chimney & Stove', 'Electrical & Wiring', 'Multi-Appliance'] },
      { key: 'service_action', name: 'Service Action', type: 'select', required: true, isVariant: false, options: ['installation', 'inspection', 'repair', 'maintenance', 'cleaning', 'gas_filling', 'part_replacement', 'uninstallation', 'annual_service', 'diagnosis'] },
      { key: 'supported_brands', name: 'Supported Brands', type: 'multiselect', required: false, isVariant: false, options: ['LG', 'Samsung', 'Whirlpool', 'Daikin', 'Voltas', 'Blue Star', 'Godrej', 'Haier', 'IFB', 'Bosch', 'Kent', 'Aquaguard', 'Bajaj', 'Havells', 'All Brands'] },
      { key: 'starting_price', name: 'Starting Price (INR)', type: 'number', required: true, isVariant: false, unit: 'INR' },
      { key: 'inspection_charge', name: 'Visiting / Inspection Charge (INR)', type: 'number', required: true, isVariant: false, unit: 'INR' },
      { key: 'pricing_mode', name: 'Pricing Mode', type: 'select', required: true, isVariant: false, options: ['fixed', 'starting_at', 'inspection_plus_service', 'per_hour', 'per_visit', 'quotation'] },
      { key: 'estimated_duration_minutes', name: 'Estimated Job Time (Minutes)', type: 'number', required: true, isVariant: false, unit: 'mins' },
      { key: 'home_visit_available', name: 'Doorstep Home Visit Available', type: 'boolean', required: true, isVariant: false },
      { key: 'service_center_visit_available', name: 'Carry-In Service Center Visit Allowed', type: 'boolean', required: false, isVariant: false },
      { key: 'emergency_service_available', name: 'Emergency / 2-Hour Express Visit Available', type: 'boolean', required: false, isVariant: false },
      { key: 'same_day_available', name: 'Same Day Service Booking Available', type: 'boolean', required: true, isVariant: false },
      { key: 'warranty_days', name: 'Service Warranty (Days)', type: 'select', required: true, isVariant: false, options: ['No Warranty', '7 Days Warranty', '30 Days Warranty', '60 Days Warranty', '90 Days Warranty', '1 Year Warranty'] },
      { key: 'spare_parts_included', name: 'Spare Parts Included in Base Price', type: 'boolean', required: true, isVariant: false },
      { key: 'quotation_required', name: 'Requires Advance Inspection Quotation', type: 'boolean', required: false, isVariant: false },
      { key: 'customer_photo_upload_supported', name: 'Customer Fault Photo Upload Supported', type: 'boolean', required: false, isVariant: false },
      { key: 'customer_video_upload_supported', name: 'Customer Fault Video Upload Supported', type: 'boolean', required: false, isVariant: false },
      { key: 'service_radius_km', name: 'Service Radius (KM)', type: 'number', required: true, isVariant: false, unit: 'km' },
    ],
    childCategories: [
      {
        name: "Air Conditioner Services",
        extraAttributes: [
          { key: 'ac_type', name: 'AC Type', type: 'select', required: true, isVariant: true, options: ['Split AC', 'Window AC', 'Cassette AC', 'Tower AC', 'Centralized / Duct AC'] },
          { key: 'tonnage', name: 'Capacity Tonnage', type: 'select', required: true, isVariant: true, options: ['1 Ton', '1.5 Ton', '2 Ton', '2.5 Ton+'] },
          { key: 'inverter_or_non_inverter', name: 'Inverter Technology', type: 'select', required: false, isVariant: true, options: ['Inverter AC', 'Non-Inverter Dual Flap'] },
          { key: 'gas_type', name: 'Refrigerant Gas Type', type: 'select', required: false, isVariant: false, options: ['R32', 'R410A', 'R22', 'R134a'] },
          { key: 'indoor_unit_service', name: 'Indoor Foam / Jet Cleaning Included', type: 'boolean', required: true, isVariant: false },
          { key: 'outdoor_unit_service', name: 'Outdoor Unit Pressure Wash Included', type: 'boolean', required: true, isVariant: false },
          { key: 'installation_floor', name: 'Floor Level Extra Charge Required', type: 'boolean', required: false, isVariant: false },
          { key: 'copper_pipe_required', name: 'Extra Copper Piping Available', type: 'boolean', required: false, isVariant: false },
        ],
      },
      {
        name: "Refrigerator Services",
        extraAttributes: [
          { key: 'refrigerator_type', name: 'Fridge Model', type: 'select', required: true, isVariant: true, options: ['Single Door', 'Double Door Top Freezer', 'Bottom Freezer', 'Side by Side', 'French Door', 'Deep Freezer'] },
          { key: 'capacity_litres', name: 'Volume Capacity Range', type: 'select', required: false, isVariant: false, options: ['Under 200L', '200L - 350L', '350L - 500L', '500L+'] },
          { key: 'cooling_issue', name: 'Cooling Symptom', type: 'select', required: false, isVariant: false, options: ['Not Cooling at All', 'Less Cooling', 'Water Leakage', 'Excess Noise / Vibrations', 'Defrost Issue', 'Power Dead'] },
          { key: 'compressor_service', name: 'Compressor Repair / Relay Replacement', type: 'boolean', required: false, isVariant: false },
          { key: 'gas_charging', name: 'Freon Gas Charging Available', type: 'boolean', required: true, isVariant: false },
        ],
      },
      {
        name: "Washing Machine Services",
        extraAttributes: [
          { key: 'machine_type', name: 'Washing Machine Type', type: 'select', required: true, isVariant: true, options: ['Fully Automatic Front Load', 'Fully Automatic Top Load', 'Semi Automatic Twin Tub', 'Washer Dryer Combo'] },
          { key: 'capacity_kg', name: 'Wash Capacity (KG)', type: 'select', required: false, isVariant: false, options: ['6 KG', '6.5 KG', '7 KG', '8 KG', '9 KG+'] },
          { key: 'drum_service', name: 'Drum Scaling & Descaling Wash', type: 'boolean', required: false, isVariant: false },
          { key: 'motor_service', name: 'Motor & Belt Replacement Service', type: 'boolean', required: false, isVariant: false },
        ],
      },
      {
        name: "Television and Home Theatre Services",
        extraAttributes: [
          { key: 'screen_type', name: 'Display Panel Technology', type: 'select', required: true, isVariant: true, options: ['LED TV', 'OLED TV', 'QLED TV', 'LCD / Plasma TV', 'CRT TV'] },
          { key: 'screen_size', name: 'Screen Size (Inches)', type: 'select', required: true, isVariant: true, options: ['32 Inch & Below', '40 - 43 Inch', '50 - 55 Inch', '65 Inch & Above'] },
          { key: 'smart_tv', name: 'Smart Android TV Software Setup', type: 'boolean', required: false, isVariant: false },
          { key: 'panel_service', name: 'Backlight / Panel Bonding Repair', type: 'boolean', required: false, isVariant: false },
          { key: 'motherboard_service', name: 'Main Board / Power Supply Repair', type: 'boolean', required: false, isVariant: false },
          { key: 'wall_mount_service', name: 'Wall Mount Installation Bracket Included', type: 'boolean', required: false, isVariant: false },
        ],
      },
      {
        name: "RO and Water Purifier Services",
        extraAttributes: [
          { key: 'purifier_type', name: 'Filtration Type', type: 'select', required: true, isVariant: true, options: ['RO + UV + UF', 'RO + Alkaline', 'Gravity Filter', 'Commercial RO Plant'] },
          { key: 'purification_stages', name: 'Filter Stages', type: 'select', required: false, isVariant: false, options: ['3 Stage', '5 Stage', '7 Stage', '8 Stage+'] },
          { key: 'filter_replacement', name: 'Sediment & Carbon Filter Kit Included', type: 'boolean', required: true, isVariant: false },
          { key: 'membrane_replacement', name: 'RO Membrane Replacement Available', type: 'boolean', required: true, isVariant: false },
          { key: 'water_tds_test', name: 'Free Water TDS & Hardness Test', type: 'boolean', required: true, isVariant: false },
          { key: 'amc_supported', name: 'Annual Service Maintenance Contract Available', type: 'boolean', required: true, isVariant: false },
        ],
      },
      {
        name: "Geyser and Water Heater Services",
        extraAttributes: [
          { key: 'geyser_type', name: 'Geyser Category', type: 'select', required: true, isVariant: true, options: ['Storage Electric Geyser', 'Instant Water Heater', 'Gas Water Heater', 'Solar Water Heating System'] },
          { key: 'capacity_litres', name: 'Tank Capacity', type: 'select', required: false, isVariant: true, options: ['3L Instant', '6L', '10L', '15L', '25L', '35L+'] },
          { key: 'heating_element_service', name: 'Heating Coil Descaling & Replacement', type: 'boolean', required: true, isVariant: false },
        ],
      },
      {
        name: "Microwave and Kitchen Appliance Services",
        extraAttributes: [
          { key: 'appliance_name', name: 'Kitchen Appliance Name', type: 'select', required: true, isVariant: true, options: ['Microwave Oven (Convection)', 'Solo Microwave', 'Mixer Grinder / Juicer', 'Electric Chimney', 'Induction Cooktop', 'Dishwasher', 'Air Fryer'] },
          { key: 'power_rating', name: 'Power Rating (Watts)', type: 'text', required: false, isVariant: false, placeholder: '750W / 1200W / 2000W' },
          { key: 'motor_or_pcb_service', name: 'Magnetron / PCB Touch Panel Repair', type: 'boolean', required: false, isVariant: false },
        ],
      },
      {
        name: "Electrical and Electrician Services",
        extraAttributes: [
          { key: 'electrical_service_type', name: 'Electrical Work Type', type: 'select', required: true, isVariant: true, options: ['Fan Installation / Repair', 'Switch & Socket Replacement', 'MCB & Fuse Box Repair', 'Chandelier / Light Fitting', 'Inverter & Battery Wiring', 'Complete Room Wiring Check'] },
          { key: 'residential_or_commercial', name: 'Property Scope', type: 'select', required: false, isVariant: false, options: ['Residential Home', 'Commercial Office / Shop'] },
          { key: 'material_included', name: 'Wires & Switches Included', type: 'boolean', required: true, isVariant: false },
        ],
      },
      { name: "Multi-Appliance Service Centers" },
      {
        name: "Appliance AMC and Warranty Plans",
        productMode: 'subscription',
        catalogueScope: 'service_plan',
        extraAttributes: [
          { key: 'plan_name', name: 'AMC Plan Name', type: 'text', required: true, isVariant: false, placeholder: 'Total Home Care AMC / Dual AC Annual Plan' },
          { key: 'plan_tier', name: 'Plan Tier Level', type: 'select', required: true, isVariant: true, options: ['Silver', 'Gold', 'Platinum', 'Custom Corporate'] },
          { key: 'covered_appliances', name: 'Covered Appliances', type: 'multiselect', required: true, isVariant: false, options: ['Air Conditioner', 'Refrigerator', 'Washing Machine', 'RO Water Purifier', 'Geyser', 'Microwave', 'TV'] },
          { key: 'number_of_appliances', name: 'Appliance Units Included', type: 'number', required: true, isVariant: false, unit: 'units' },
          { key: 'coverage_duration_months', name: 'Coverage Validity (Months)', type: 'select', required: true, isVariant: true, options: ['6 Months', '12 Months (1 Year)', '24 Months (2 Years)', '36 Months (3 Years)'] },
          { key: 'scheduled_visits', name: 'Free Mandatory Maintenance Visits', type: 'number', required: true, isVariant: false, unit: 'visits' },
          { key: 'emergency_visits', name: 'Unlimited Breakdown Emergency Visits', type: 'boolean', required: true, isVariant: false },
          { key: 'labour_included', name: 'Free Labour Charges Included', type: 'boolean', required: true, isVariant: false },
          { key: 'spare_parts_discount', name: 'Discount on Spare Parts (%)', type: 'number', required: false, isVariant: false, unit: '%' },
          { key: 'spare_parts_included', name: 'All Spare Parts Covered (Comprehensive AMC)', type: 'boolean', required: true, isVariant: false },
          { key: 'priority_service', name: 'Priority 4-Hour Response SLA Guarantee', type: 'boolean', required: false, isVariant: false },
          { key: 'renewal_available', name: 'Yearly Plan Renewal Discount Available', type: 'boolean', required: false, isVariant: false },
        ],
      },
      {
        name: "Appliance Spare Parts and Consumables",
        productMode: 'wholesale',
        supportedItemTypes: ['product'],
        catalogueScope: 'vendor_procurement',
        inventoryMode: 'variant',
        extraAttributes: [
          { key: 'part_name', name: 'Spare Part Component Name', type: 'text', required: true, isVariant: false, placeholder: 'AC R32 Gas Can / RO Sediment Filter / Fridge Relay' },
          { key: 'part_category', name: 'Component Category', type: 'select', required: true, isVariant: false, options: ['Refrigerant Gas', 'Motors & Capacitors', 'Compressors & Pumps', 'RO Filters & Membranes', 'PCB Mainboards', 'Copper Pipes & Fittings', 'Belts & Valves', 'Sensors & Thermostats'] },
          { key: 'compatible_brands', name: 'Compatible OEM Brands', type: 'multiselect', required: true, isVariant: false, options: ['LG', 'Samsung', 'Whirlpool', 'Voltas', 'Daikin', 'Kent', 'Aquaguard', 'Universal / All Brands'] },
          { key: 'manufacturer', name: 'Part Manufacturer / Brand', type: 'text', required: true, isVariant: false },
          { key: 'part_number', name: 'OEM Part Number', type: 'text', required: false, isVariant: true },
          { key: 'oem_or_compatible', name: 'Part Authenticity', type: 'select', required: true, isVariant: false, options: ['100% Genuine Original OEM', 'Compatible Aftermarket', 'Refurbished Tested'] },
          { key: 'pack_quantity', name: 'Pack Quantity', type: 'number', required: true, isVariant: true, unit: 'pcs' },
          { key: 'minimum_order_quantity', name: 'Minimum Wholesale Order Quantity (MOQ)', type: 'number', required: true, isVariant: false, unit: 'units' },
          { key: 'tier_pricing', name: 'Volume Tier Pricing Supported', type: 'boolean', required: false, isVariant: false },
          { key: 'available_stock', name: 'In-Stock Quantity', type: 'number', required: true, isVariant: false, unit: 'units' },
          { key: 'gst_rate', name: 'GST Percentage', type: 'select', required: true, isVariant: false, options: ['5%', '12%', '18%', '28%'] },
          { key: 'hsn_code', name: 'HSN Code', type: 'text', required: false, isVariant: false },
          { key: 'dispatch_time', name: 'Dispatch Lead Time (Days)', type: 'number', required: true, isVariant: false, unit: 'days' },
        ],
      },
    ],
  },
  {
    name: 'Home Cleaning & Housekeeping',
    slug: 'services-home-cleaning-housekeeping',
    allowedCapabilities: [
      'individual_cleaner', 'cleaning_agency', 'housekeeping_company', 'deep_cleaning_specialist',
      'kitchen_bathroom_cleaner', 'sofa_carpet_cleaner', 'move_in_move_out_cleaner', 'post_construction_cleaner',
      'office_cleaning_provider', 'water_tank_cleaner', 'corporate_housekeeping_provider',
      'cleaning_franchise_partner', 'cleaning_consumables_supplier'
    ],
    productMode: 'customizable',
    supportedItemTypes: ['service', 'product'],
    attributes: [
      { key: 'service_name', name: 'Service Title', type: 'text', required: true, isVariant: false, placeholder: 'e.g. 2BHK Full Home Deep Cleaning / L-Shape Sofa Shampooing' },
      { key: 'property_type', name: 'Property Category', type: 'select', required: true, isVariant: false, options: ['Apartment / Flat', 'Villa / Duplex', 'Independent House', 'Office Space', 'Retail Shop', 'Commercial Building', 'School / Hospital'] },
      { key: 'property_size_sqft', name: 'Area Coverage Range (Sq.Ft)', type: 'select', required: false, isVariant: true, options: ['Under 500 Sq.Ft', '500 - 1000 Sq.Ft', '1000 - 1500 Sq.Ft', '1500 - 2000 Sq.Ft', '2000 - 3000 Sq.Ft', '3000+ Sq.Ft'] },
      { key: 'number_of_bedrooms', name: 'Bedroom Count', type: 'select', required: false, isVariant: true, options: ['1 BHK', '2 BHK', '3 BHK', '4 BHK', '5 BHK+'] },
      { key: 'number_of_bathrooms', name: 'Bathroom Count', type: 'select', required: false, isVariant: true, options: ['1 Bathroom', '2 Bathrooms', '3 Bathrooms', '4 Bathrooms+'] },
      { key: 'starting_price', name: 'Service Price (INR)', type: 'number', required: true, isVariant: false, unit: 'INR' },
      { key: 'pricing_mode', name: 'Pricing Calculation Mode', type: 'select', required: true, isVariant: false, options: ['fixed', 'per_room', 'per_bathroom', 'per_sqft', 'per_staff', 'quotation'] },
      { key: 'estimated_duration_minutes', name: 'Estimated Cleaning Duration (Minutes)', type: 'number', required: true, isVariant: false, unit: 'mins' },
      { key: 'number_of_staff_included', name: 'Deployed Cleaners Team Count', type: 'number', required: true, isVariant: false, unit: 'cleaners' },
      { key: 'cleaning_materials_included', name: 'Cleaning Chemicals & Detergents Included', type: 'boolean', required: true, isVariant: false },
      { key: 'equipment_included', name: 'Heavy Machinery (Vacuum/Single Disc) Included', type: 'boolean', required: true, isVariant: false },
      { key: 'service_checklist', name: 'Includes Step-by-Step Cleaning Checklist', type: 'boolean', required: true, isVariant: false },
      { key: 'before_photo_required', name: 'Before Cleaning Photo Inspection Required', type: 'boolean', required: false, isVariant: false },
      { key: 'after_photo_required', name: 'After Cleaning Verification Photo Uploaded', type: 'boolean', required: false, isVariant: false },
      { key: 'same_day_available', name: 'Same Day Emergency Slots Available', type: 'boolean', required: true, isVariant: false },
      { key: 'service_radius_km', name: 'Service Coverage Radius (KM)', type: 'number', required: true, isVariant: false, unit: 'km' },
    ],
    childCategories: [
      { name: "Full Home Cleaning" },
      { name: "Deep Cleaning" },
      {
        name: "Kitchen Cleaning",
        extraAttributes: [
          { key: 'chimney_cleaning', name: 'Kitchen Chimney Filter Degreasing Included', type: 'boolean', required: true, isVariant: false },
          { key: 'cabinet_inside_cleaning', name: 'Empty Cabinet Interior Cleaning', type: 'boolean', required: false, isVariant: false },
          { key: 'grease_removal', name: 'Heavy Oil & Gas Stove Stain Removal', type: 'boolean', required: true, isVariant: false },
          { key: 'appliance_external_cleaning', name: 'Fridge & Microwave Exterior Wipe', type: 'boolean', required: false, isVariant: false },
        ],
      },
      {
        name: "Bathroom Cleaning",
        extraAttributes: [
          { key: 'toilet_sanitization', name: 'Toilet Seat Hospital-Grade Sanitization', type: 'boolean', required: true, isVariant: false },
          { key: 'tile_cleaning', name: 'Grout & Wall Tile Buffing', type: 'boolean', required: true, isVariant: false },
          { key: 'hard_water_stain_removal', name: 'Glass & Tap Hard Water Stain Scrubbing', type: 'boolean', required: true, isVariant: false },
          { key: 'drain_cleaning', name: 'Floor Drain De-clogging & Deodorizing', type: 'boolean', required: false, isVariant: false },
        ],
      },
      {
        name: "Sofa and Upholstery Cleaning",
        extraAttributes: [
          { key: 'furniture_type', name: 'Seating Furniture Type', type: 'select', required: true, isVariant: true, options: ['Fabric Sofa', 'Leatherette / Leather Sofa', 'Recliner', 'Dining Chairs', 'Office Armchairs'] },
          { key: 'number_of_seats', name: 'Seating Capacity Count', type: 'select', required: true, isVariant: true, options: ['1 Seater', '2 Seater', '3 Seater', '5 Seater (3+1+1)', '6 Seater L-Shape', '7 Seater+'] },
          { key: 'fabric_type', name: 'Upholstery Material', type: 'select', required: false, isVariant: false, options: ['Velvet', 'Suede / Microfiber', 'Cotton Blend', 'Genuine Leather'] },
          { key: 'shampooing', name: 'Injection Suction Wet Shampooing', type: 'boolean', required: true, isVariant: false },
          { key: 'steam_cleaning', name: 'Thermal Steam Disinfection', type: 'boolean', required: false, isVariant: false },
          { key: 'drying_time', name: 'Estimated Natural Drying Time (Hours)', type: 'number', required: true, isVariant: false, unit: 'hours' },
        ],
      },
      {
        name: "Mattress and Carpet Cleaning",
        extraAttributes: [
          { key: 'item_type', name: 'Soft Furnishing Item', type: 'select', required: true, isVariant: true, options: ['Single Bed Mattress', 'Queen / King Mattress', 'Living Room Carpet / Rug', 'Wall to Wall Carpet'] },
          { key: 'number_of_items', name: 'Item Quantity Count', type: 'number', required: true, isVariant: true, unit: 'items' },
          { key: 'vacuum_cleaning', name: 'HEPA Deep Dust Mite Vacuuming', type: 'boolean', required: true, isVariant: false },
          { key: 'stain_removal', name: 'Spot Stain Treatment (Coffee/Ink/Blood)', type: 'boolean', required: false, isVariant: false },
        ],
      },
      { name: "Curtain and Glass Cleaning" },
      {
        name: "Move-In and Move-Out Cleaning",
        extraAttributes: [
          { key: 'property_empty', name: 'Property Completely Vacant / Unfurnished', type: 'boolean', required: true, isVariant: false },
          { key: 'inside_storage_cleaning', name: 'Inside Wardrobes & Drawers Sanitized', type: 'boolean', required: true, isVariant: false },
          { key: 'window_cleaning', name: 'Window Glass Track Slits Cleaned', type: 'boolean', required: true, isVariant: false },
          { key: 'floor_polishing', name: 'Single Disc Machine Floor Scrubbing', type: 'boolean', required: false, isVariant: false },
          { key: 'handover_checklist', name: 'Landlord Tenant Handover Sign-off Checklist', type: 'boolean', required: true, isVariant: false },
        ],
      },
      {
        name: "Post-Construction Cleaning",
        extraAttributes: [
          { key: 'construction_dust_level', name: 'Debris & Cement Dust Severity', type: 'select', required: true, isVariant: false, options: ['Moderate Renovation Dust', 'Heavy Post-Construction Cement/Paint'] },
          { key: 'paint_stain_removal', name: 'Floor & Glass Paint Splatter Scraping', type: 'boolean', required: true, isVariant: false },
          { key: 'cement_stain_removal', name: 'Tile Cement Residue Chemical Scrub', type: 'boolean', required: true, isVariant: false },
          { key: 'debris_removal', name: 'Heavy Garbage Bag Removal Included', type: 'boolean', required: false, isVariant: false },
        ],
      },
      {
        name: "Office and Commercial Cleaning",
        extraAttributes: [
          { key: 'commercial_area_sqft', name: 'Commercial Floor Area (Sq.Ft)', type: 'number', required: true, isVariant: true, unit: 'sqft' },
          { key: 'workstation_count', name: 'Workstation / Desk Count', type: 'number', required: false, isVariant: false, unit: 'desks' },
          { key: 'washroom_count', name: 'Office Washroom Block Count', type: 'number', required: false, isVariant: false, unit: 'blocks' },
          { key: 'shift_preference', name: 'Working Shift Window', type: 'select', required: false, isVariant: false, options: ['Night Shift After Hours', 'Early Morning Before 9 AM', 'Weekend Hours'] },
          { key: 'staff_deployment_required', name: 'Dedicated Daily Janitorial Staff Deployment', type: 'boolean', required: false, isVariant: false },
        ],
      },
      {
        name: "Cleaning AMC and Recurring Plans",
        productMode: 'subscription',
        catalogueScope: 'service_plan',
        extraAttributes: [
          { key: 'plan_name', name: 'Subscription Package Name', type: 'text', required: true, isVariant: false, placeholder: 'Monthly Bathroom Cleaning / Bi-Weekly Maid Service' },
          { key: 'coverage_duration_months', name: 'Subscription Cycle', type: 'select', required: true, isVariant: true, options: ['1 Month', '3 Months', '6 Months', '1 Year'] },
          { key: 'visits_per_month', name: 'Cleaning Visits Per Month', type: 'select', required: true, isVariant: true, options: ['1 Visit/Month', '2 Visits/Month (Bi-Weekly)', '4 Visits/Month (Weekly)', '12 Visits/Month'] },
          { key: 'included_services', name: 'Services Included in Package', type: 'multiselect', required: true, isVariant: false, options: ['Bathroom Cleaning', 'Kitchen Cleaning', 'Deep Floor Scrubbing', 'Sofa Shampooing', 'Full Home Deep Clean'] },
          { key: 'pause_allowed', name: 'Pause / Resume Subscription Visits', type: 'boolean', required: true, isVariant: false },
          { key: 'reschedule_allowed', name: 'Free Visit Rescheduling Window', type: 'boolean', required: true, isVariant: false },
        ],
      },
      {
        name: "Cleaning Materials and Equipment",
        productMode: 'wholesale',
        supportedItemTypes: ['product'],
        catalogueScope: 'vendor_procurement',
        inventoryMode: 'variant',
        extraAttributes: [
          { key: 'product_name', name: 'Chemical / Equipment Name', type: 'text', required: true, isVariant: false, placeholder: 'Taski R2 Cleaner / Floor Single Disc Polisher' },
          { key: 'material_category', name: 'Item Category', type: 'select', required: true, isVariant: false, options: ['Professional Cleaning Chemical', 'Disinfectant & Sanitizer', 'Microfiber & Wipes', 'Floor Polishing Machine', 'High Pressure Washer', 'Vacuum Cleaner'] },
          { key: 'brand', name: 'Brand Manufacturer', type: 'text', required: true, isVariant: false },
          { key: 'chemical_or_equipment', name: 'Type', type: 'select', required: true, isVariant: false, options: ['Liquid Chemical Consumable', 'Hardware Machine Equipment', 'Accessory Tool'] },
          { key: 'pack_size', name: 'Pack Size / Unit', type: 'select', required: true, isVariant: true, options: ['5 Litre Can', '20 Litre Drum', 'Box of 10 Pcs', 'Single Machine Unit'] },
          { key: 'minimum_order_quantity', name: 'Minimum Wholesale MOQ', type: 'number', required: true, isVariant: false, unit: 'units' },
          { key: 'gst_rate', name: 'GST Percentage', type: 'select', required: true, isVariant: false, options: ['5%', '12%', '18%', '28%'] },
        ],
      },
    ],
  },
  {
    name: 'Spa, Salon & Beauty',
    slug: 'services-spa-salon-beauty',
    allowedCapabilities: [
      'mens_salon', 'womens_salon', 'unisex_salon', 'spa_center', 'beauty_parlour',
      'barber_shop', 'nail_studio', 'makeup_studio', 'bridal_studio', 'wellness_center',
      'home_beauty_provider', 'beauty_products_supplier'
    ],
    productMode: 'customizable',
    supportedItemTypes: ['service', 'product'],
    attributes: [
      { key: 'service_name', name: 'Treatment / Service Name', type: 'text', required: true, isVariant: false, placeholder: 'e.g. O3+ Facial / Swedish Full Body Massage' },
      { key: 'service_category', name: 'Service Category', type: 'select', required: true, isVariant: false, options: ['Hair Care', 'Beard & Shave', 'Facial & Cleanup', 'Body Spa & Massage', 'Threading & Waxing', 'Manicure & Pedicure', 'Bridal & Party Makeup', 'Pre-Bridal Package'] },
      { key: 'gender_supported', name: 'Gender Target Audience', type: 'select', required: true, isVariant: true, options: ['Female Only', 'Male Only', 'Unisex (Men & Women)'] },
      { key: 'age_group', name: 'Age Group', type: 'select', required: false, isVariant: false, options: ['Adults', 'Teens', 'Kids (Below 12)'] },
      { key: 'duration_minutes', name: 'Treatment Duration (Minutes)', type: 'number', required: true, isVariant: false, unit: 'mins' },
      { key: 'starting_price', name: 'Base Service Price (INR)', type: 'number', required: true, isVariant: false, unit: 'INR' },
      { key: 'offer_price', name: 'Special Promotional Price (INR)', type: 'number', required: false, isVariant: false, unit: 'INR' },
      { key: 'staff_selection_available', name: 'Stylist / Therapist Choice Available', type: 'boolean', required: false, isVariant: false },
      { key: 'staff_gender_preference_available', name: 'Male / Female Therapist Preference Supported', type: 'boolean', required: true, isVariant: false },
      { key: 'home_service_available', name: 'At-Home Doorstep Beauty Service Available', type: 'boolean', required: true, isVariant: false },
      { key: 'shop_service_available', name: 'In-Salon Outlet Visit Available', type: 'boolean', required: true, isVariant: false },
      { key: 'home_service_charge', name: 'Doorstep Convenience Visit Fee (INR)', type: 'number', required: false, isVariant: false, unit: 'INR' },
      { key: 'service_radius_km', name: 'Home Service Coverage Radius (KM)', type: 'number', required: false, isVariant: false, unit: 'km' },
      { key: 'products_included', name: 'Disposable Hygiene Kit & Products Included', type: 'boolean', required: true, isVariant: false },
      { key: 'patch_test_required', name: 'Skin Sensitivity Patch Test Recommended', type: 'boolean', required: false, isVariant: false },
      { key: 'same_day_available', name: 'Same Day Instant Slot Booking Available', type: 'boolean', required: true, isVariant: false },
    ],
    childCategories: [
      {
        name: "Hair Services",
        extraAttributes: [
          { key: 'hair_service_type', name: 'Hair Care Treatment', type: 'select', required: true, isVariant: true, options: ['Haircut & Styling', 'Hair Coloring / Root Touchup', 'Keratin & Smoothing', 'Hair Spa & Scalp Treatment', 'Highlights / Balayage', 'Hair Extension'] },
          { key: 'hair_length', name: 'Hair Length Tier', type: 'select', required: false, isVariant: true, options: ['Short (Above Shoulders)', 'Medium (Shoulder Length)', 'Long (Below Waist)'] },
          { key: 'wash_included', name: 'Shampoo Hair Wash Included', type: 'boolean', required: true, isVariant: false },
          { key: 'blow_dry_included', name: 'Blow Dry & Heat Styling Included', type: 'boolean', required: true, isVariant: false },
        ],
      },
      {
        name: "Beard and Grooming",
        extraAttributes: [
          { key: 'beard_service_type', name: 'Grooming Service', type: 'select', required: true, isVariant: true, options: ['Beard Trim & Shape', 'Royal Shave', 'Beard Color / Dye', 'Beard Spa & Oil Massage'] },
          { key: 'styling_product_included', name: 'Beard Serum / Wax Applied', type: 'boolean', required: false, isVariant: false },
        ],
      },
      {
        name: "Skin Care and Facials",
        extraAttributes: [
          { key: 'skin_type', name: 'Skin Type Compatibility', type: 'select', required: true, isVariant: false, options: ['All Skin Types', 'Oily / Acne Prone', 'Dry & Sensitive', 'Anti-Aging / Mature'] },
          { key: 'facial_type', name: 'Facial Kit Grade', type: 'select', required: true, isVariant: true, options: ['Fruit / Organic Facial', 'Gold / Diamond Facial', 'O3+ Advanced Oxy Facial', 'Hydra Facial Machine'] },
          { key: 'product_brand', name: 'Skincare Product Line Brand', type: 'select', required: false, isVariant: true, options: ['L’Oreal', 'O3+', 'Lotus Herbals', 'Cheryl’s', 'Organic Harvest'] },
        ],
      },
      {
        name: "Spa and Massage",
        extraAttributes: [
          { key: 'massage_type', name: 'Therapy Style', type: 'select', required: true, isVariant: true, options: ['Swedish Massage', 'Deep Tissue Body Therapy', 'Aromatherapy Oil Massage', 'Foot Reflexology', 'Head & Shoulder Spa', 'Ayurvedic Abhyanga'] },
          { key: 'therapist_gender_preference', name: 'Same Gender Therapist Policy', type: 'select', required: true, isVariant: false, options: ['Female Therapist for Female Client', 'Male Therapist for Male Client', 'Either / No Restriction'] },
          { key: 'steam_included', name: 'Post Massage Herbal Steam Bath Included', type: 'boolean', required: false, isVariant: false },
          { key: 'shower_facility_required', name: 'Shower Facility Required at Premises', type: 'boolean', required: false, isVariant: false },
        ],
      },
      { name: "Beauty, Threading and Waxing" },
      {
        name: "Nail Services",
        extraAttributes: [
          { key: 'nail_service_type', name: 'Nail Art & Care', type: 'select', required: true, isVariant: true, options: ['Gel Polish Manicure', 'Spa Pedicure', 'Acrylic Nail Extensions', 'Nail Art / Ombre', 'Nail Gel Removal'] },
          { key: 'gel_or_regular', name: 'Polish Type', type: 'select', required: false, isVariant: true, options: ['UV Gel Long Lasting', 'Regular Polish', 'Chrome / Glitter'] },
        ],
      },
      {
        name: "Bridal and Makeup Services",
        extraAttributes: [
          { key: 'occasion', name: 'Event Occasion', type: 'select', required: true, isVariant: false, options: ['Bridal Wedding Day', 'Sangeet / Mehendi', 'Party / Reception', 'Pre-Wedding Shoot'] },
          { key: 'makeup_type', name: 'Makeup Technique', type: 'select', required: true, isVariant: true, options: ['HD Makeup', 'Airbrush Makeup', '3D Mineral Makeup', 'Traditional Kryolan'] },
          { key: 'trial_session_available', name: 'Paid Pre-Bridal Makeup Trial Available', type: 'boolean', required: false, isVariant: false },
          { key: 'draping_included', name: 'Saree / Lehenga Draping Included', type: 'boolean', required: true, isVariant: false },
          { key: 'home_or_venue_service', name: 'Artist Venue Travel Included', type: 'boolean', required: true, isVariant: false },
        ],
      },
      {
        name: "Home Salon Services",
        extraAttributes: [
          { key: 'home_service_only', name: '100% Home Doorstep Service Only', type: 'boolean', required: true, isVariant: false },
          { key: 'minimum_booking_amount', name: 'Minimum Cart Booking Amount (INR)', type: 'number', required: true, isVariant: false, unit: 'INR' },
          { key: 'equipment_carried', name: 'Portable Bed & Towels Carried by Beautician', type: 'boolean', required: true, isVariant: false },
        ],
      },
      {
        name: "Salon Memberships and Packages",
        productMode: 'subscription',
        catalogueScope: 'service_plan',
        extraAttributes: [
          { key: 'plan_name', name: 'Package / Pass Name', type: 'text', required: true, isVariant: false, placeholder: 'Pre-Bridal 30-Day Glow Pass / Family Beauty Pass' },
          { key: 'duration_months', name: 'Validity Period', type: 'select', required: true, isVariant: true, options: ['1 Month', '3 Months', '6 Months', '12 Months'] },
          { key: 'included_services', name: 'Services Included in Pass', type: 'multiselect', required: true, isVariant: false, options: ['Haircuts', 'Facials', 'Waxing', 'Manicure-Pedicure', 'Massage'] },
          { key: 'discount_percentage', name: 'Flat Membership Discount (%)', type: 'number', required: true, isVariant: false, unit: '%' },
          { key: 'family_members_allowed', name: 'Shareable with Family Members', type: 'boolean', required: true, isVariant: false },
        ],
      },
      { name: "Wellness Services" },
      {
        name: "Beauty Products and Consumables",
        productMode: 'standard',
        supportedItemTypes: ['product'],
        catalogueScope: 'customer_retail',
        inventoryMode: 'variant',
        extraAttributes: [
          { key: 'product_name', name: 'Cosmetic / Hair Product Name', type: 'text', required: true, isVariant: false, placeholder: 'L’Oreal Professionnel Shampoo 150ml / O3+ D-Tan Pack' },
          { key: 'beauty_category', name: 'Cosmetic Category', type: 'select', required: true, isVariant: false, options: ['Hair Care Shampoo & Serum', 'Facial Cream & Pack', 'Waxing Cartridge', 'Essential Oils', 'Nail Polish & Gel'] },
          { key: 'brand', name: 'Brand', type: 'text', required: true, isVariant: false },
          { key: 'volume_or_weight', name: 'Volume / Net Weight', type: 'select', required: true, isVariant: true, options: ['50ml', '100ml', '250ml', '500ml', '100g', '500g'] },
          { key: 'expiry_date', name: 'Expiry Date', type: 'text', required: true, isVariant: false, placeholder: 'YYYY-MM-DD' },
          { key: 'gst_rate', name: 'GST Percentage', type: 'select', required: true, isVariant: false, options: ['18%', '28%'] },
        ],
      },
    ],
  },
  {
    name: 'Laundry & Garment Care',
    slug: 'services-laundry-garment-care',
    allowedCapabilities: [
      'laundry_shop', 'dry_cleaning_center', 'steam_iron_center', 'premium_garment_care',
      'shoe_bag_cleaning_provider', 'carpet_curtain_cleaning_provider', 'laundry_franchise',
      'pickup_delivery_laundry', 'corporate_laundry_provider', 'institutional_laundry_provider',
      'laundry_consumables_supplier'
    ],
    productMode: 'customizable',
    supportedItemTypes: ['service', 'product'],
    attributes: [
      { key: 'service_name', name: 'Laundry Service Title', type: 'text', required: true, isVariant: false, placeholder: 'e.g. Wash & Fold / Suit Dry Cleaning / Steam Ironing' },
      { key: 'laundry_service_type', name: 'Service Process Type', type: 'select', required: true, isVariant: false, options: ['Wash & Fold', 'Wash & Iron', 'Dry Cleaning', 'Steam Ironing Only', 'Shoe Spa', 'Blanket / Carpet Wash'] },
      { key: 'pricing_mode', name: 'Unit Pricing Mode', type: 'select', required: true, isVariant: false, options: ['per_piece', 'per_kg', 'fixed', 'package', 'subscription'] },
      { key: 'price_per_piece', name: 'Rate Per Garment Piece (INR)', type: 'number', required: false, isVariant: true, unit: 'INR' },
      { key: 'price_per_kg', name: 'Rate Per KG (INR)', type: 'number', required: false, isVariant: true, unit: 'INR' },
      { key: 'minimum_weight_kg', name: 'Minimum Weight Order Threshold (KG)', type: 'number', required: false, isVariant: false, unit: 'kg' },
      { key: 'estimated_completion_hours', name: 'Turnaround Delivery Time (Hours)', type: 'select', required: true, isVariant: false, options: ['6 Hours Express', '24 Hours (Next Day)', '48 Hours (2 Days)', '72 Hours (3 Days)'] },
      { key: 'express_available', name: 'Express Same-Day Fast Track Available', type: 'boolean', required: true, isVariant: false },
      { key: 'express_charge', name: 'Express Surcharge Fee (%)', type: 'number', required: false, isVariant: false, unit: '%' },
      { key: 'pickup_available', name: 'Doorstep Garment Pickup Available', type: 'boolean', required: true, isVariant: false },
      { key: 'delivery_available', name: 'Cleaned Garment Doorstep Delivery Included', type: 'boolean', required: true, isVariant: false },
      { key: 'pickup_radius_km', name: 'Pickup & Delivery Radius (KM)', type: 'number', required: true, isVariant: false, unit: 'km' },
      { key: 'stain_removal_available', name: 'Spot Stain Removal Treatment Available', type: 'boolean', required: false, isVariant: false },
      { key: 'perfume_finish_available', name: 'Fragrance Perfume Spray Wash Finish', type: 'boolean', required: false, isVariant: false },
    ],
    childCategories: [
      { name: "Regular Wash" },
      { name: "Premium Wash" },
      {
        name: "Dry Cleaning",
        extraAttributes: [
          { key: 'dry_cleanable_garment_types', name: 'Garment Category', type: 'select', required: true, isVariant: true, options: ['Men 2-Piece Suit', 'Designer Heavy Saree / Lehenga', 'Winter Coat / Jacket', 'Sherwani / Kurta Pajama', 'Silk Shirt / Blouse'] },
          { key: 'silk_support', name: '100% Pure Silk Gentle Hydrocarbon Care', type: 'boolean', required: true, isVariant: false },
          { key: 'wool_support', name: 'Woolen & Pashmina Dry Clean Specialist', type: 'boolean', required: true, isVariant: false },
        ],
      },
      {
        name: "Steam and Normal Ironing",
        extraAttributes: [
          { key: 'normal_or_steam', name: 'Pressing Machine Type', type: 'select', required: true, isVariant: true, options: ['Steam Ironing (Vacuum Table)', 'Normal Electric Iron'] },
          { key: 'fold_or_hanger', name: 'Packing Finishing', type: 'select', required: true, isVariant: true, options: ['Hanger Packing', 'Neat Folded Pouch'] },
        ],
      },
      { name: "Express Laundry" },
      {
        name: "Shoe and Bag Cleaning",
        extraAttributes: [
          { key: 'item_type', name: 'Accessory Type', type: 'select', required: true, isVariant: true, options: ['Sports Sneakers', 'Suede / Leather Shoes', 'Handbag / Tote', 'Backpack / Luggage'] },
          { key: 'polishing_included', name: 'Leather Polish & Color Touchup Included', type: 'boolean', required: true, isVariant: false },
          { key: 'waterproofing_available', name: 'Hydrophobic Water Repellent Coating', type: 'boolean', required: false, isVariant: false },
        ],
      },
      {
        name: "Curtain, Carpet and Blanket Cleaning",
        extraAttributes: [
          { key: 'item_type', name: 'Heavy Fabric Item', type: 'select', required: true, isVariant: true, options: ['Single Quilt / Blanket', 'Double Heavy Rajai / Comforter', 'Window Curtain Panel', 'Floor Carpet Rug'] },
          { key: 'onsite_cleaning_available', name: 'On-Site Carpet Washing Available', type: 'boolean', required: false, isVariant: false },
        ],
      },
      {
        name: "Delicate Garment Care and Stain Removal",
        extraAttributes: [
          { key: 'fabric_type', name: 'Delicate Fabric Spec', type: 'select', required: true, isVariant: false, options: ['Zari / Embroidery Saree', 'Chiffon / Net Dress', 'Organza', 'Leather Jacket'] },
          { key: 'manual_cleaning_required', name: '100% Hand Wash Gentle Sponge Only', type: 'boolean', required: true, isVariant: false },
          { key: 'customer_risk_approval_required', name: 'Color Bleeding Disclaim Approval Required', type: 'boolean', required: true, isVariant: false },
        ],
      },
      {
        name: "Pickup and Delivery Laundry",
        extraAttributes: [
          { key: 'pickup_charge', name: 'Doorstep Pickup Fee (INR)', type: 'number', required: false, isVariant: false, unit: 'INR' },
          { key: 'free_pickup_limit', name: 'Free Pickup Minimum Order Amount (INR)', type: 'number', required: true, isVariant: false, unit: 'INR' },
        ],
      },
      {
        name: "Laundry Subscriptions",
        productMode: 'subscription',
        catalogueScope: 'service_plan',
        extraAttributes: [
          { key: 'plan_name', name: 'Monthly Laundry Plan Title', type: 'text', required: true, isVariant: false, placeholder: 'Bachelor 15KG Monthly Pass / Family 50KG Pass' },
          { key: 'monthly_weight_limit', name: 'Monthly Weight Allowance (KG)', type: 'select', required: true, isVariant: true, options: ['15 KG / Month', '30 KG / Month', '50 KG / Month', '100 KG / Month'] },
          { key: 'weekly_pickups', name: 'Doorstep Pickups Allowed Per Week', type: 'number', required: true, isVariant: false, unit: 'pickups' },
          { key: 'express_discount', name: 'Free Express Processing Included', type: 'boolean', required: false, isVariant: false },
        ],
      },
      {
        name: "Corporate and Institutional Laundry",
        productMode: 'made_to_order',
        catalogueScope: 'corporate_contract',
        extraAttributes: [
          { key: 'organization_type', name: 'Client Sector', type: 'select', required: true, isVariant: false, options: ['Hotel / Resort', 'Hospital / Clinic', 'Restaurant / Cafe', 'Hostel / PG', 'Industrial Factory'] },
          { key: 'estimated_monthly_weight', name: 'Estimated Monthly Volume (KG)', type: 'number', required: true, isVariant: false, unit: 'kg' },
          { key: 'linen_types', name: 'Linen / Apparel Items', type: 'multiselect', required: true, isVariant: false, options: ['Bedsheets & Pillow Covers', 'Bath Towels', 'Chef Coats & Aprons', 'Hospital Scrubs & Gowns', 'Work Overalls'] },
          { key: 'barcode_tracking_required', name: 'Garment QR / RFID Tagging System', type: 'boolean', required: false, isVariant: false },
          { key: 'quotation_required', name: 'Official Institutional Tender Bidding Required', type: 'boolean', required: true, isVariant: false },
        ],
      },
      {
        name: "Laundry Consumables and Accessories",
        productMode: 'wholesale',
        supportedItemTypes: ['product'],
        catalogueScope: 'vendor_procurement',
        inventoryMode: 'variant',
        extraAttributes: [
          { key: 'product_name', name: 'Consumable Item Name', type: 'text', required: true, isVariant: false, placeholder: 'Commercial Detergent Powder 25kg / Hanger Pack' },
          { key: 'consumable_category', name: 'Category', type: 'select', required: true, isVariant: false, options: ['Commercial Detergent', 'Fabric Softener', 'Dry Cleaning Solvent', 'Stain Remover Chemical', 'Garment Hangers & Tags', 'Laundry Mesh Bags'] },
          { key: 'brand', name: 'Manufacturer Brand', type: 'text', required: true, isVariant: false },
          { key: 'pack_size', name: 'Wholesale Pack Size', type: 'select', required: true, isVariant: true, options: ['5L Bottle', '25KG Bag', '50KG Drum', 'Box of 500 Hangers'] },
          { key: 'minimum_order_quantity', name: 'Minimum Order Quantity (MOQ)', type: 'number', required: true, isVariant: false, unit: 'units' },
          { key: 'gst_rate', name: 'GST Percentage', type: 'select', required: true, isVariant: false, options: ['18%', '28%'] },
        ],
      },
    ],
  },
];

export const seedServicesTaxonomy = async () => {
  console.log('[SeedServicesTaxonomy] Starting Services taxonomy seeding (1 Parent, 4 Subcategories, 46 Child Categories)...');

  // 1. Upsert Services Parent Category (Level 1)
  const parentCategory = await Category.findOneAndUpdate(
    { slug: 'services' },
    {
      $set: {
        name: 'Services',
        slug: 'services',
        description: 'Complete Services Vertical: Home Appliances Repair, Home Cleaning, Spa & Salon, Laundry & Garment Care',
        level: 1,
        parentId: null,
        supportedItemTypes: ['service', 'product'],
        displayOrder: 5,
        isActive: true,
        isFeatured: true,
        image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&auto=format&fit=crop&q=80',
        banner: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1600&auto=format&fit=crop&q=80',
      },
    },
    { upsert: true, new: true }
  );

  // Cleanup obsolete services subcategories & children
  const validSubSlugs = SERVICES_TAXONOMY.map(s => s.slug);
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

  for (let sIdx = 0; sIdx < SERVICES_TAXONOMY.length; sIdx++) {
    const subDef = SERVICES_TAXONOMY[sIdx];
    if (!subDef) continue;

    // 2. Upsert Subcategory (Level 2)
    const subCategory = await Category.findOneAndUpdate(
      { slug: subDef.slug },
      {
        $set: {
          name: subDef.name,
          slug: subDef.slug,
          description: `${subDef.name} subcategory under Services`,
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
            mode: 'simple',
            requiresBatch: false,
            requiresExpiry: false,
            supportsReservedStock: true,
            supportsDamagedStock: false,
          },
          deliveryPolicy: {
            homeDelivery: true,
            storePickup: true,
            sameDay: true,
            scheduled: true,
          },
          compliancePolicy: {
            requiredDocuments: ['Identity Proof / Aadhaar Masked', 'Trade Licence / GST'],
            optionalDocuments: ['Certifications', 'Service Center Authorization'],
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
              mode: childDef.inventoryMode || 'simple',
              requiresBatch: childDef.inventoryMode === 'batch_expiry',
              requiresExpiry: childDef.inventoryMode === 'batch_expiry',
              supportsReservedStock: true,
              supportsDamagedStock: true,
            },
            customizationPolicy: {
              enabled: true,
              fields: [],
              requiresCustomerUpload: childName.includes('Repair') || childName.includes('Cleaning') || childName.includes('Bridal'),
              requiresApproval: childProductMode === 'subscription' || childProductMode === 'made_to_order',
            },
            deliveryPolicy: {
              homeDelivery: true,
              storePickup: true,
              sameDay: true,
              scheduled: true,
            },
            compliancePolicy: {
              requiredDocuments: ['Identity Proof / Aadhaar Masked', 'Trade Licence / GST'],
              optionalDocuments: ['Certifications', 'Service Center Authorization'],
            },
            isPublished: true,
          },
        },
        { upsert: true, new: true }
      );
      schemaCount++;
    }
  }

  console.log(`[SeedServicesTaxonomy] Seeding completed! 1 Parent (services), ${subCount} L2 Subcategories, ${childCount} L3 Child Categories, and ${schemaCount} CategoryProductSchemas upserted successfully.`);
  return { parentCount: 1, subCount, childCount, schemaCount };
};

const runDirect = async () => {
  if (require.main === module) {
    try {
      const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
      await mongoose.connect(mongoURI);
      console.log('Connected to MongoDB. Running Services taxonomy seed...');
      await seedServicesTaxonomy();
      process.exit(0);
    } catch (err) {
      console.error('Seed execution error:', err);
      process.exit(1);
    }
  }
};

runDirect();
