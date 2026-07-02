import { Router } from "express";
import {
  getBusinessRelationships,
  getBusinessRelationshipById,
} from "../controllers/businessRelationshipController";
import { protect } from "../middleware/auth";

const router = Router();

router.get("/", protect, getBusinessRelationships);
router.get("/:id", protect, getBusinessRelationshipById);

export default router;
