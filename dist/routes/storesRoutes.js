"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const storesController_1 = require("../controllers/storesController");
const router = (0, express_1.Router)();
// Public marketplace store routes
router.get('/nearby', storesController_1.getNearbyStores);
router.get('/favourites', auth_1.protect, storesController_1.getFavourites);
router.post('/:id/favourite', auth_1.protect, storesController_1.addFavourite);
router.delete('/:id/favourite', auth_1.protect, storesController_1.removeFavourite);
router.get('/:slug', storesController_1.getStoreBySlug);
router.get('/:id/catalog', storesController_1.getStoreCatalog);
router.get('/:id/offers', storesController_1.getStoreOffers);
router.get('/:id/reviews', storesController_1.getStoreReviews);
exports.default = router;
