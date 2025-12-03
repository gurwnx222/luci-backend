import {
  registerSalonOwnerProfile,
  fetchSalonOwnerProfile,
} from "../controllers/register.controller.js";

//imported route module for routing
import { Router } from "express";
const router = Router();

//implemented routing on register controller
router.post("/register-salon-owner", registerSalonOwnerProfile);
router.post("/fetch-salon-owner-profile", fetchSalonOwnerProfile);

export default router;
