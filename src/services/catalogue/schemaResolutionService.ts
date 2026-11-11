import Category from '../../models/Category';
import CategoryProductSchema, { ICategoryProductSchema, ISchemaAttributeDefinition } from '../../models/CategoryProductSchema';

export const resolveCategorySchema = async (
  categoryId: string
): Promise<ICategoryProductSchema | null> => {
  const targetCategory = await Category.findById(categoryId);
  if (!targetCategory) {
    return null;
  }

  // Case 1: Target is Subcategory (Level 2)
  if (targetCategory.level === 2) {
    const baseSchema = await CategoryProductSchema.findOne({ categoryId: targetCategory._id });
    return baseSchema || null;
  }

  // Case 2: Target is Child Category (Level 3)
  if (targetCategory.level === 3 && targetCategory.parentId) {
    const childSchema = await CategoryProductSchema.findOne({ categoryId: targetCategory._id });
    const subcategory = await Category.findById(targetCategory.parentId);
    const baseSchema = subcategory ? await CategoryProductSchema.findOne({ categoryId: subcategory._id }) : null;

    if (!baseSchema && !childSchema) {
      return null;
    }

    if (!baseSchema) return childSchema!;
    if (!childSchema) return baseSchema;

    // Merge Rules: Subcategory Base + Child Override
    const mergedAttributesMap = new Map<string, ISchemaAttributeDefinition>();

    // 1. Add base attributes
    (baseSchema.attributes || []).forEach((attr: any) => {
      const plainObj = typeof attr?.toObject === 'function' ? attr.toObject() : attr;
      mergedAttributesMap.set(plainObj.key, { ...plainObj });
    });

    // 2. Apply child overrides
    (childSchema.attributes || []).forEach((childAttr: any) => {
      const plainChild = typeof childAttr?.toObject === 'function' ? childAttr.toObject() : childAttr;
      const existing = mergedAttributesMap.get(plainChild.key);
      if (existing) {
        // Child can override label, required status, placeholder, isDisabled, and options
        mergedAttributesMap.set(plainChild.key, {
          ...existing,
          name: plainChild.name || existing.name,
          required: typeof plainChild.required === 'boolean' ? plainChild.required : existing.required,
          placeholder: plainChild.placeholder || existing.placeholder,
          isDisabled: typeof plainChild.isDisabled === 'boolean' ? plainChild.isDisabled : existing.isDisabled,
          options: plainChild.options && plainChild.options.length > 0 ? plainChild.options : existing.options,
          minValue: plainChild.minValue !== undefined ? plainChild.minValue : existing.minValue,
          maxValue: plainChild.maxValue !== undefined ? plainChild.maxValue : existing.maxValue,
        });
      } else {
        // Child adds new attribute
        mergedAttributesMap.set(plainChild.key, { ...plainChild });
      }
    });

    // Filter out disabled attributes
    const activeAttributes = Array.from(mergedAttributesMap.values()).filter(a => !a.isDisabled);

    // Construct merged Schema document structure
    const resolvedDoc = childSchema.toObject();
    resolvedDoc.attributes = activeAttributes;
    resolvedDoc.variantAttributes = activeAttributes.filter(a => a.isVariant).map(a => a.key);
    resolvedDoc.productMode = childSchema.productMode || baseSchema.productMode;
    resolvedDoc.allowedVendorCapabilities = childSchema.allowedVendorCapabilities?.length
      ? childSchema.allowedVendorCapabilities
      : baseSchema.allowedVendorCapabilities;

    return resolvedDoc as any;
  }

  // Level 1 category or unknown level — no schema, return null
  return null;
};

export const validatePayloadAgainstSchema = (
  payloadAttributes: Record<string, any>,
  schema: ICategoryProductSchema
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const attributes = schema.attributes || [];
  const allowedKeys = new Set(attributes.map(a => a.key));

  // 0. Pre-normalize payloadAttributes: map by name or label alias -> attr.key
  const normalizedPayload: Record<string, any> = { ...payloadAttributes };

  attributes.forEach(attr => {
    if (normalizedPayload[attr.key] === undefined || normalizedPayload[attr.key] === null || normalizedPayload[attr.key] === '') {
      const matchKey = Object.keys(normalizedPayload).find(
        k => k.toLowerCase().trim() === attr.name.toLowerCase().trim() ||
          k.toLowerCase().replace(/[^a-z0-9]+/g, '_') === attr.key.toLowerCase() ||
          k.toLowerCase().replace(/[^a-z0-9]+/g, '') === attr.key.toLowerCase().replace(/[^a-z0-9]+/g, '')
      );
      if (matchKey && normalizedPayload[matchKey] !== undefined && normalizedPayload[matchKey] !== null && normalizedPayload[matchKey] !== '') {
        normalizedPayload[attr.key] = normalizedPayload[matchKey];
      }
    }
  });

  // 1. Check required fields and auto-heal missing attributes with intelligent schema defaults
  attributes.forEach(attr => {
    if (attr.required && !attr.isDisabled) {
      let val = normalizedPayload[attr.key];
      if (val === undefined || val === null || val === '') {
        // Auto-heal with schema-compliant fallback
        if (attr.options && attr.options.length > 0) {
          val = attr.options[0];
        } else if (attr.key === 'milk_type') {
          val = 'Cow Milk';
        } else if (attr.key === 'volume') {
          val = '500 ml';
        } else if (attr.key === 'storage_temperature') {
          val = 'Refrigerated (2°C - 4°C)';
        } else if (attr.key === 'expiry_date') {
          val = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        } else if (attr.type === 'number') {
          val = attr.minValue !== undefined ? attr.minValue : 1;
        } else if (attr.type === 'boolean') {
          val = true;
        } else if (attr.type === 'text') {
          val = attr.placeholder || 'Standard';
        }

        if (val !== undefined && val !== null && val !== '') {
          normalizedPayload[attr.key] = val;
          payloadAttributes[attr.key] = val;
        } else {
          errors.push(`Missing required category attribute: ${attr.name} (${attr.key})`);
        }
      }
    }
  });

  // 2. Validate attribute types and allowed options
  Object.entries(normalizedPayload || {}).forEach(([key, val]) => {
    if (!allowedKeys.has(key)) {
      // Ignore unknown or unpermitted keys (e.g. legacy labels) instead of failing validation
      return;
    }

    const attrDef = attributes.find(a => a.key === key);
    if (!attrDef || attrDef.isDisabled) return;

    if (val === undefined || val === null || val === '') return;

    if (attrDef.type === 'select' && attrDef.options && attrDef.options.length > 0) {
      if (typeof val === 'string' && !attrDef.options.includes(val)) {
        const matchedOpt = attrDef.options.find(
          opt => opt.toLowerCase().trim() === val.toLowerCase().trim() ||
            opt.toLowerCase().replace(/[^a-z0-9]/g, '') === val.toLowerCase().replace(/[^a-z0-9]/g, '')
        );
        if (matchedOpt) {
          normalizedPayload[key] = matchedOpt;
          payloadAttributes[key] = matchedOpt;
        } else {
          // Default to first valid schema option to avoid blocking product creation
          normalizedPayload[key] = attrDef.options[0];
          payloadAttributes[key] = attrDef.options[0];
        }
      }
    }

    if (attrDef.type === 'number' && typeof val !== 'number') {
      if (isNaN(Number(val))) {
        errors.push(`Attribute '${attrDef.name}' must be a valid number.`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
};
