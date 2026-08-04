"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CUISINE_TAGS = exports.DEFAULT_MENU_SECTIONS = exports.RestaurantMenuSection = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const RestaurantMenuSectionSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isTemplate: { type: Boolean, default: true },
    restaurantId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Vendor', default: null },
}, { timestamps: true });
RestaurantMenuSectionSchema.index({ slug: 1 });
RestaurantMenuSectionSchema.index({ restaurantId: 1 });
exports.RestaurantMenuSection = mongoose_1.default.model('RestaurantMenuSection', RestaurantMenuSectionSchema);
exports.DEFAULT_MENU_SECTIONS = [
    'Breakfast',
    'Tiffins',
    'Starters',
    'Soups',
    'Main Course',
    'Curries',
    'Rice and Biryani',
    'Breads',
    'Snacks',
    'Chaat',
    'Fast Food',
    'Beverages',
    'Desserts',
    'Combos',
    'Family Packs',
    'Kids Menu',
    'Specials',
];
exports.CUISINE_TAGS = [
    'andhra',
    'telangana',
    'south_indian',
    'north_indian',
    'hyderabadi',
    'chinese',
    'indo_chinese',
    'arabian',
    'mughlai',
    'continental',
    'italian',
    'mexican',
    'seafood',
    'healthy',
    'vegan',
    'jain',
    'regional',
    'multi_cuisine',
];
exports.default = exports.RestaurantMenuSection;
