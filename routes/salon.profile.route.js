// routes/salon.profile.routes.js
import { upload, handleMulterError } from "../middlewares/mutler.middleware.js";
import {
  createSalonProfile,
  fetchAllSalonProfiles,
  fetchSalonProfileById,
  fetchSalonWithOwnerDetails,
  fetchSalonByOwnerId,
} from "../controllers/salon.profile.controller.js";
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
// Fetch all salon profiles (paginated)
// GET /api/v1/salons?limit=10&page=1
router.get("/", fetchAllSalonProfiles);

// Fetch single salon by ID
// GET /api/v1/salons/:salonId
router.get("/:salonId", fetchSalonProfileById);

// Fetch salon with populated owner details
// GET /api/v1/salons/:salonId/with-owner
router.get("/:salonId/with-owner", fetchSalonWithOwnerDetails);

// Fetch salon by owner ID
// GET /api/v1/salons/owner/:ownerId
router.get("/owner/:ownerId", fetchSalonByOwnerId);

export default router;
