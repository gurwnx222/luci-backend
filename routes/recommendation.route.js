import express from "express";
import {
  getUserRecommendations,
  getCustomRecommendations,
} from "../controllers/recommendation.controller.js";

const router = express.Router();

// Get personalized recommendations for a user
router.get("/:userId", getUserRecommendations);

// Get custom recommendations with additional filters
router.post("/:userId/custom", getCustomRecommendations);

export default router;

