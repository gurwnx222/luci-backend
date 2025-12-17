// controllers/recommendation.controller.js

import { getRecommendations } from "../utils/recommendationAlgorithm.js";

/**
 * Get personalized salon recommendations for a user
 * GET /api/v1/recommendations/:userId
 *
 * Returns salons with ownerId included for booking requests
 */
export const getUserRecommendations = async (req, res) => {
  try {
    const { userId } = req.params; // userId is firebaseUID
    const { limit = 20, latitude, longitude } = req.query;

    // Parse location if provided
    let userLocation = null;
    if (latitude && longitude) {
      userLocation = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      };
    }

    // Get recommendations (algorithm handles users with no booking history)
    const recommendations = await getRecommendations(
      userId,
      userLocation,
      parseInt(limit)
    );

    // 🔥 Ensure each salon has ownerId for booking requests
    const recommendationsWithOwner = recommendations.map((rec) => ({
      ...rec,
      salon: {
        ...rec.salon,
        // ownerId should already be in salon data from DB
        // but we ensure it's present
        ownerId: rec.salon.ownerId || rec.salon.owner?._id,
      },
    }));

    res.json({
      success: true,
      count: recommendationsWithOwner.length,
      recommendations: recommendationsWithOwner,
      // Include message for new users with no booking history
      message:
        recommendationsWithOwner.length === 0
          ? "No salons available at the moment"
          : recommendationsWithOwner.some((r) =>
              r.reasons?.includes("Previously visited")
            )
          ? undefined
          : "Personalized recommendations will appear after your first accepted booking",
    });
  } catch (error) {
    console.error("Error getting recommendations:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching recommendations",
      error: error.message,
    });
  }
};

/**
 * Get recommendations with custom preferences
 * POST /api/v1/recommendations/:userId/custom
 *
 * Returns salons with ownerId included for booking requests
 */
export const getCustomRecommendations = async (req, res) => {
  try {
    const { userId } = req.params; // userId is firebaseUID
    const {
      limit = 20,
      latitude,
      longitude,
      preferredServices,
      priceRange,
    } = req.body;

    // Parse location
    let userLocation = null;
    if (latitude && longitude) {
      userLocation = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      };
    }

    // Get recommendations (algorithm handles users with no booking history)
    const recommendations = await getRecommendations(
      userId,
      userLocation,
      parseInt(limit)
    );

    // Filter by custom preferences if provided
    let filteredRecommendations = recommendations;

    // Filter by preferred massage types (maps to salon.typesOfMassages array)
    if (preferredServices && preferredServices.length > 0) {
      const normalizedPrefs = preferredServices.map((p) => p.toLowerCase());
      filteredRecommendations = recommendations.filter((rec) => {
        if (
          !rec.salon.typesOfMassages ||
          !Array.isArray(rec.salon.typesOfMassages)
        )
          return false;
        const salonTypes = rec.salon.typesOfMassages.map((t) =>
          t.toLowerCase()
        );
        return normalizedPrefs.some((pref) =>
          salonTypes.some((type) => type.includes(pref) || pref.includes(type))
        );
      });
    }

    // Filter by price range using salon.priceRange (string -> number)
    if (priceRange) {
      filteredRecommendations = filteredRecommendations.filter((rec) => {
        const p = rec.salon.priceRange ? parseFloat(rec.salon.priceRange) : NaN;
        if (Number.isNaN(p)) return false;

        return (
          (!priceRange.min || p >= priceRange.min) &&
          (!priceRange.max || p <= priceRange.max)
        );
      });
    }

    // 🔥 Ensure each salon has ownerId for booking requests
    const recommendationsWithOwner = filteredRecommendations.map((rec) => ({
      ...rec,
      salon: {
        ...rec.salon,
        ownerId: rec.salon.ownerId || rec.salon.owner?._id,
      },
    }));

    res.json({
      success: true,
      count: recommendationsWithOwner.length,
      recommendations: recommendationsWithOwner,
    });
  } catch (error) {
    console.error("Error getting custom recommendations:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching custom recommendations",
      error: error.message,
    });
  }
};
