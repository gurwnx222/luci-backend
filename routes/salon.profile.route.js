// routes/salon.profile.routes.js
import { upload, handleMulterError } from "../middlewares/mutler.middleware.js";
import { createSalonProfile } from "../controllers/salon.profile.controller.js";
import { nestedJsonParser } from "../middlewares/jsonParser.middleware.js";
import { Router } from "express";

const router = Router();

router.post(
  "/register-salon-profile",
  upload,
  handleMulterError,
  nestedJsonParser,
  createSalonProfile // 4. Handle the request
);

export default router;
