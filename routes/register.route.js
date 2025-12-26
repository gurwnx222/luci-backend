import {
  registerSalonOwnerProfile,
  fetchSalonOwnerProfile,
} from "../controllers/register.controller.js";
import { upload, handleMulterError } from "../middlewares/mutler.middleware.js";
import { nestedJsonParser } from "../middlewares/jsonParser.middleware.js";
//imported route module for routing
import { Router } from "express";
const router = Router();

//implemented routing on register controller
router.post(
  "/register-salon",
  upload,
  handleMulterError,
  nestedJsonParser,
  registerSalonOwnerProfile
);
router.post("/fetch-salon-owner-profile", fetchSalonOwnerProfile);

export default router;
