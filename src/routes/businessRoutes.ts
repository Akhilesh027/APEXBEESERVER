import { Router } from "express";
import { getBusinessByPincode } from "../controllers/businessController";

const router = Router();

router.get("/by-pincode", getBusinessByPincode);

export default router;
