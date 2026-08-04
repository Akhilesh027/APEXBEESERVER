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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEVOTIONAL_PRODUCT_SEEDS = void 0;
const poojaEssentials_products_1 = require("./poojaEssentials.products");
const poojaKits_products_1 = require("./poojaKits.products");
const festivalCombos_products_1 = require("./festivalCombos.products");
const flowersAndGarlands_products_1 = require("./flowersAndGarlands.products");
const fruitsAndCoconuts_products_1 = require("./fruitsAndCoconuts.products");
const prasadamAndOfferings_products_1 = require("./prasadamAndOfferings.products");
const idolsFramesDecor_products_1 = require("./idolsFramesDecor.products");
const poojaAccessories_products_1 = require("./poojaAccessories.products");
const spiritualBooksMedia_products_1 = require("./spiritualBooksMedia.products");
const devotionalServices_products_1 = require("./devotionalServices.products");
const devotionalWholesale_products_1 = require("./devotionalWholesale.products");
__exportStar(require("./devotionalProductTypes"), exports);
__exportStar(require("./poojaEssentials.products"), exports);
__exportStar(require("./poojaKits.products"), exports);
__exportStar(require("./festivalCombos.products"), exports);
__exportStar(require("./flowersAndGarlands.products"), exports);
__exportStar(require("./fruitsAndCoconuts.products"), exports);
__exportStar(require("./prasadamAndOfferings.products"), exports);
__exportStar(require("./idolsFramesDecor.products"), exports);
__exportStar(require("./poojaAccessories.products"), exports);
__exportStar(require("./spiritualBooksMedia.products"), exports);
__exportStar(require("./devotionalServices.products"), exports);
__exportStar(require("./devotionalWholesale.products"), exports);
exports.DEVOTIONAL_PRODUCT_SEEDS = [
    ...poojaEssentials_products_1.poojaEssentialsProducts,
    ...poojaKits_products_1.poojaKitsProducts,
    ...festivalCombos_products_1.festivalCombosProducts,
    ...flowersAndGarlands_products_1.flowersAndGarlandsProducts,
    ...fruitsAndCoconuts_products_1.fruitsAndCoconutsProducts,
    ...prasadamAndOfferings_products_1.prasadamAndOfferingsProducts,
    ...idolsFramesDecor_products_1.idolsFramesDecorProducts,
    ...poojaAccessories_products_1.poojaAccessoriesProducts,
    ...spiritualBooksMedia_products_1.spiritualBooksMediaProducts,
    ...devotionalServices_products_1.devotionalServicesProducts,
    ...devotionalWholesale_products_1.devotionalWholesaleProducts,
];
