// routes/privateMassager.route.js
import { upload, uploadMultiple, handleMulterError } from "../middlewares/mutler.middleware.js";
import {
  createPrivateMassager,
  getPrivateMassagers,
  getPrivateMassagerById,
  updatePrivateMassager,
  deletePrivateMassager,
} from "../controllers/privateMassager.controller.js";
import { nestedJsonParser } from "../middlewares/jsonParser.middleware.js";
import { Router } from "express";

const router = Router();

// Create new private massager (supports single or multiple files)
// POST /api/private-massagers
router.post(
  "/",
  uploadMultiple, // Accept multiple files
  handleMulterError,
  nestedJsonParser,
  createPrivateMassager
);

// Fetch all private massagers (paginated)
// GET /api/private-massagers?limit=10&page=1
router.get("/", getPrivateMassagers);

// Fetch single private massager by ID
// GET /api/private-massagers/:id
router.get("/:id", getPrivateMassagerById);

// Update private massager
// PUT /api/private-massagers/:id
router.put(
  "/:id",
  uploadMultiple, // Accept multiple files
  handleMulterError,
  nestedJsonParser,
  updatePrivateMassager
);

// Delete private massager
// DELETE /api/private-massagers/:id
router.delete("/:id", deletePrivateMassager);

export default router;

