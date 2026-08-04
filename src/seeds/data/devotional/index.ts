import { DevotionalProductSeed } from './devotionalProductTypes';
import { poojaEssentialsProducts } from './poojaEssentials.products';
import { poojaKitsProducts } from './poojaKits.products';
import { festivalCombosProducts } from './festivalCombos.products';
import { flowersAndGarlandsProducts } from './flowersAndGarlands.products';
import { fruitsAndCoconutsProducts } from './fruitsAndCoconuts.products';
import { prasadamAndOfferingsProducts } from './prasadamAndOfferings.products';
import { idolsFramesDecorProducts } from './idolsFramesDecor.products';
import { poojaAccessoriesProducts } from './poojaAccessories.products';
import { spiritualBooksMediaProducts } from './spiritualBooksMedia.products';
import { devotionalServicesProducts } from './devotionalServices.products';
import { devotionalWholesaleProducts } from './devotionalWholesale.products';

export * from './devotionalProductTypes';
export * from './poojaEssentials.products';
export * from './poojaKits.products';
export * from './festivalCombos.products';
export * from './flowersAndGarlands.products';
export * from './fruitsAndCoconuts.products';
export * from './prasadamAndOfferings.products';
export * from './idolsFramesDecor.products';
export * from './poojaAccessories.products';
export * from './spiritualBooksMedia.products';
export * from './devotionalServices.products';
export * from './devotionalWholesale.products';

export const DEVOTIONAL_PRODUCT_SEEDS: DevotionalProductSeed[] = [
  ...poojaEssentialsProducts,
  ...poojaKitsProducts,
  ...festivalCombosProducts,
  ...flowersAndGarlandsProducts,
  ...fruitsAndCoconutsProducts,
  ...prasadamAndOfferingsProducts,
  ...idolsFramesDecorProducts,
  ...poojaAccessoriesProducts,
  ...spiritualBooksMediaProducts,
  ...devotionalServicesProducts,
  ...devotionalWholesaleProducts,
];
