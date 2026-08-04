export interface DevotionalVariantDefinition {
  name: string;
  skuSuffix?: string;
  barcode?: string;
  attributes: Record<string, any>;
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
}

export interface DevotionalProductSeed {
  seedKey: string;
  name: string;
  slug: string;
  subcategorySlug: string;
  childCategorySlug: string;
  itemType: 'physical_product' | 'fresh_product' | 'food_product' | 'service' | 'digital_product' | 'combo' | 'subscription' | 'wholesale';
  productMode: 'standard' | 'fresh' | 'food' | 'customizable' | 'made_to_order' | 'combo' | 'subscription' | 'wholesale' | 'digital' | 'service';
  shortDescription: string;
  detailedDescription?: string;
  keywords: string[];
  tags: string[];
  supportedUnits: string[];
  attributeValues?: Record<string, any>;
  variantDefinitions?: DevotionalVariantDefinition[];
  inventoryRules?: {
    mode?: string;
    requiresBatch?: boolean;
    requiresExpiry?: boolean;
    supportsReservedStock?: boolean;
    supportsDamagedStock?: boolean;
    dailyStock?: boolean;
    expiryDays?: number;
    sameDayAvailability?: boolean;
  };
  deliveryRules?: {
    homeDelivery?: boolean;
    storePickup?: boolean;
    sameDay?: boolean;
    scheduled?: boolean;
    fragile?: boolean;
    preOrderClosingHours?: number;
  };
  complianceRules?: {
    fssaiRequired?: boolean;
    businessVerificationRequired?: boolean;
    priestApproved?: boolean;
  };
  customizationRules?: {
    allowCustomText?: boolean;
    allowCustomLength?: boolean;
    allowCustomImage?: boolean;
  };
  mediaRules?: {
    audioFormat?: string;
    digitalFormat?: string;
  };
  wholesaleRules?: {
    minimumOrderQuantity?: number;
    minimumOrderUnit?: string;
    unitsPerCarton?: number;
    cartonWeight?: number;
  };
  serviceRules?: {
    serviceLocation?: string;
    onlineOrOffline?: string;
    durationMinutes?: number;
    priestLanguage?: string[];
    numberOfPriests?: number;
  };
}
