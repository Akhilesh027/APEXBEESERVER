import { Router } from "express";
import {
  createLead,
  getLeads,
  updateLead,
} from "../controllers/leadController";
import { protect } from "../middleware/auth";

const router = Router();

router.post("/", protect, createLead);
router.get("/", protect, getLeads);
router.put("/:id", protect, updateLead);

export default router;
