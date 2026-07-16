import { Router } from "express";
import { getRfqs, createRfq, getPos, createPo, updatePo } from "../controllers/b2bController";
import { protect } from "../middleware/auth";

const router = Router();

router.get("/rfqs", protect, getRfqs);
router.post("/rfqs", protect, createRfq);
router.get("/pos", protect, getPos);
router.post("/pos", protect, createPo);
router.patch("/pos/:id", protect, updatePo);

export default router;
