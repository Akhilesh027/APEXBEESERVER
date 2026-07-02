import { Router } from "express";
import {
  getCommissionRules,
  createCommissionRule,
  updateCommissionRule,
} from "../controllers/commissionRuleController";
import { protect, restrictTo } from "../middleware/auth";

const router = Router();

router.get("/", protect, getCommissionRules);
router.post("/", protect, restrictTo("admin"), createCommissionRule);
router.put("/:id", protect, restrictTo("admin"), updateCommissionRule);

export default router;
