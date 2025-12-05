// routes/salon.profile.routes.js

import { createSalonProfile } from "../controllers/salon.profile.controller.js";
import { nestedJsonParser } from "../middlewares/jsonParser.middleware.js";
import { Router } from "express";

const router = Router();

// CORRECT ORDER: multer → error handler → JSON parser → controller
router.post(
  "/register-salon-profile",
  // 3. Parse JSON strings from form-data
  createSalonProfile // 4. Handle the request
);

export default router;
