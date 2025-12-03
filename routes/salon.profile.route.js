import { createSalonProfile } from "../controllers/salon.profile.controller";
//imported route module for routing
import { Router } from "express";
const router = Router();

router.post("/register-salon-profile", createSalonProfile);

export default router;
