import { Router } from "express";
import {
  getTerritories,
  createTerritory,
  updateTerritory,
  assignTerritory,
  removeTerritoryAssignment,
  deleteTerritory,
  getStates,
  getDistricts,
  getMandals,
  getTerritoryAvailability,
  getTerritoryByPincode,
} from "../controllers/territoryController";

const router = Router();

router.get("/availability", getTerritoryAvailability);
router.get("/pincode/:pincode", getTerritoryByPincode);
router.get("/states", getStates);
router.get("/districts/:stateId", getDistricts);
router.get("/mandals/:districtId", getMandals);

router.get("/", getTerritories);
router.post("/", createTerritory);
router.put("/:id", updateTerritory);
router.put("/:id/assign", assignTerritory);
router.put("/:id/remove-assignment", removeTerritoryAssignment);
router.delete("/:id", deleteTerritory);

export default router;