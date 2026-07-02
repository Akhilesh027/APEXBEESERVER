import { Router } from "express";
import {
  getGroups,
  getTrending,
  getFeaturedVendors,
  getServiceProviders,
  getCourses
} from "../controllers/discoveryController";

const router = Router();

router.get("/groups", getGroups);
router.get("/trending", getTrending);
router.get("/featured-vendors", getFeaturedVendors);
router.get("/service-providers", getServiceProviders);
router.get("/courses", getCourses);

export default router;
