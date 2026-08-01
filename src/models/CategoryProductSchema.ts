import mongoose, { Schema, Document } from 'mongoose';

export type InventoryPolicyMode =
  | 'standard'
  | 'variant'
  | 'batch_expiry'
  | 'fresh'
  | 'fresh_batch'
  | 'chilled_batch'
  | 'frozen_batch'
  | 'capacity'
  | 'daily_capacity'
  | 'digital'
  | 'made_to_order'
  | 'simple'
  | 'returnable_asset';

export type ProductModePolicy =
  | 'standard'
  | 'fresh'
  | 'food'
  | 'customizable'
  | 'made_to_order'
  | 'combo'
  | 'subscription'
  | 'wholesale'
  | 'digital'
  | 'not_applicable';

export interface ISchemaAttributeDefinition {
  key: string;
  name: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'textarea';
  unit?: string;
  required: boolean;
  isVariant: boolean;
  options?: string[];
  placeholder?: string;
  displayGroup?: string;
  isDisabled?: boolean;
  minValue?: number;
  maxValue?: number;
}

export interface ICategoryProductSchema extends Document {
  categoryId: mongoose.Types.ObjectId; // Category ID (Subcategory level 2 or Child Category level 3)
  subcategoryId?: mongoose.Types.ObjectId; // Parent Subcategory ID if this is a Level 3 Child Override
  isChildOverride: boolean;

  schemaVersion: number;
  productMode: ProductModePolicy;
  allowedVendorCapabilities: string[];
  allowedItemTypes: string[];

  commonFields: ISchemaAttributeDefinition[];
  attributes: ISchemaAttributeDefinition[];
  variantAttributes: string[];

  inventoryPolicy: {
    mode: InventoryPolicyMode;
    requiresBatch: boolean;
    requiresExpiry: boolean;
    supportsReservedStock: boolean;
    supportsDamagedStock: boolean;
    supportsRawMaterials: boolean;
  };

  customizationPolicy: {
    enabled: boolean;
    fields: ISchemaAttributeDefinition[];
    requiresCustomerUpload: boolean;
    requiresPreview: boolean;
    requiresApproval: boolean;
  };

  workflowPolicy: {
    workflowType: 'standard' | 'fresh' | 'food' | 'production' | 'service' | 'combo';
    stages: string[];
  };

  deliveryPolicy: {
    homeDelivery: boolean;
    storePickup: boolean;
    sameDay: boolean;
    scheduled: boolean;
    fragile: boolean;
    mergedDelivery: boolean;
    multiVendorDelivery: boolean;
  };

  compliancePolicy: {
    requiredDocuments: string[];
    optionalDocuments: string[];
  };

  isPublished: boolean;
  effectiveFrom?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const SchemaAttributeDefinitionSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['text', 'number', 'select', 'multiselect', 'boolean', 'textarea'],
      required: true,
    },
    unit: { type: String, default: '' },
    required: { type: Boolean, default: false },
    isVariant: { type: Boolean, default: false },
    options: [{ type: String }],
    placeholder: { type: String, default: '' },
    displayGroup: { type: String, default: 'General' },
    isDisabled: { type: Boolean, default: false },
    minValue: { type: Number },
    maxValue: { type: Number },
  },
  { _id: false }
);

const CategoryProductSchemaSchema = new Schema<ICategoryProductSchema>(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      unique: true,
      index: true,
    },
    subcategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      index: true,
    },
    isChildOverride: { type: Boolean, default: false },
    schemaVersion: { type: Number, default: 1 },
    productMode: {
      type: String,
      enum: [
        'standard',
        'fresh',
        'food',
        'customizable',
        'made_to_order',
        'combo',
        'subscription',
        'wholesale',
        'digital',
        'not_applicable',
      ],
      default: 'standard',
    },
    allowedVendorCapabilities: [{ type: String }],
    allowedItemTypes: [{ type: String, default: 'product' }],

    commonFields: [SchemaAttributeDefinitionSchema],
    attributes: [SchemaAttributeDefinitionSchema],
    variantAttributes: [{ type: String }],

    inventoryPolicy: {
      mode: {
        type: String,
        enum: [
          'standard',
          'variant',
          'batch_expiry',
          'fresh',
          'fresh_batch',
          'chilled_batch',
          'frozen_batch',
          'capacity',
          'daily_capacity',
          'digital',
          'made_to_order',
          'simple',
          'returnable_asset',
        ],
        default: 'standard',
      },
      requiresBatch: { type: Boolean, default: false },
      requiresExpiry: { type: Boolean, default: false },
      supportsReservedStock: { type: Boolean, default: true },
      supportsDamagedStock: { type: Boolean, default: true },
      supportsRawMaterials: { type: Boolean, default: false },
    },

    customizationPolicy: {
      enabled: { type: Boolean, default: false },
      fields: [SchemaAttributeDefinitionSchema],
      requiresCustomerUpload: { type: Boolean, default: false },
      requiresPreview: { type: Boolean, default: false },
      requiresApproval: { type: Boolean, default: false },
    },

    workflowPolicy: {
      workflowType: {
        type: String,
        enum: ['standard', 'fresh', 'food', 'production', 'service', 'combo'],
        default: 'standard',
      },
      stages: [{ type: String }],
    },

    deliveryPolicy: {
      homeDelivery: { type: Boolean, default: true },
      storePickup: { type: Boolean, default: true },
      sameDay: { type: Boolean, default: false },
      scheduled: { type: Boolean, default: false },
      fragile: { type: Boolean, default: false },
      mergedDelivery: { type: Boolean, default: true },
      multiVendorDelivery: { type: Boolean, default: true },
    },

    compliancePolicy: {
      requiredDocuments: [{ type: String }],
      optionalDocuments: [{ type: String }],
    },

    isPublished: { type: Boolean, default: true },
    effectiveFrom: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

CategoryProductSchemaSchema.index({ categoryId: 1, isChildOverride: 1 });

export const CategoryProductSchema = mongoose.model<ICategoryProductSchema>(
  'CategoryProductSchema',
  CategoryProductSchemaSchema
);
export default CategoryProductSchema;
