import {
  BookingSchemaModel,
  SalonProfileSchemaModel,
  SubscriptionSchemaModel,
  RecommendationMatchModel,
} from "../models/index.js";

/**
 * Get the start of the current week (Monday)
 */
const getWeekStart = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  const weekStart = new Date(now.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Analyze user's booking history to extract preferences
 */
const analyzeUserPreferences = async (userId) => {
  const bookings = await BookingSchemaModel.find({
    "requester.firebaseUID": userId,
    status: "accepted",
  })
    .populate("reciever.salonId")
    .sort({ "appointmentDetails.requestedDateTime": -1 })
    .limit(50)
    .lean();

  if (bookings.length === 0) {
    return {
      preferredServices: [],
      priceRange: null,
      locationPattern: null,
      frequentSalons: [],
    };
  }

  // Extract preferred services (massage types) based on booked salons
  const serviceFrequency = {};
  bookings.forEach((booking) => {
    const salon = booking.reciever?.salonId;
    if (salon?.typesOfMassages && Array.isArray(salon.typesOfMassages)) {
      salon.typesOfMassages.forEach((serviceType) => {
        const serviceName = serviceType.toLowerCase();
        serviceFrequency[serviceName] =
          (serviceFrequency[serviceName] || 0) + 1;
      });
    }
  });

  const preferredServices = Object.entries(serviceFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name]) => name);

  // Calculate price range patterns – derive from salon priceRange (string -> number)
  const prices = bookings
    .map((b) => {
      const salon = b.reciever?.salonId;
      if (!salon || !salon.priceRange) return null;
      const p = parseFloat(salon.priceRange);
      return Number.isNaN(p) ? null : p;
    })
    .filter((p) => p !== null);

  if (prices.length === 0) {
    return {
      preferredServices,
      priceRange: null,
      locationPattern: null,
      frequentSalons: [],
    };
  }

  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = {
    min: Math.max(0, minPrice * 0.7), // 30% below minimum
    max: maxPrice * 1.3, // 30% above maximum
    average: avgPrice,
  };

  // Analyze location patterns
  const locations = bookings
    .map((b) => b.reciever?.salonId?.location)
    .filter(
      (loc) => loc && loc.latitude !== undefined && loc.longitude !== undefined
    );

  let locationPattern = null;
  if (locations.length > 0) {
    const avgLat =
      locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length;
    const avgLon =
      locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length;
    locationPattern = {
      center: { latitude: avgLat, longitude: avgLon },
      maxDistance: 20, // Default 20km radius
    };
  }

  // Get frequently booked salons
  const salonFrequency = {};
  bookings.forEach((booking) => {
    const salon = booking.reciever?.salonId;
    if (salon && salon._id) {
      const salonId = salon._id.toString();
      salonFrequency[salonId] = (salonFrequency[salonId] || 0) + 1;
    }
  });

  const frequentSalons = Object.entries(salonFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([salonId]) => salonId);

  return {
    preferredServices,
    priceRange,
    locationPattern,
    frequentSalons,
  };
};

/**
 * Get weekly match count for a subscription (calculated dynamically)
 */
const getWeeklyMatchCount = async (subscriptionId, weekStart) => {
  const subscription = await SubscriptionSchemaModel.findById(subscriptionId)
    .populate("salonID")
    .lean();

  if (!subscription || !subscription.salonID) {
    return 0;
  }

  const matchCount = await RecommendationMatchModel.countDocuments({
    salonId: subscription.salonID._id,
    weekStartDate: weekStart,
  });

  return matchCount;
};

/**
 * Get subscribed salons that haven't reached weekly limit
 */
const getAvailableSubscribedSalons = async (weekStart) => {
  const subscriptions = await SubscriptionSchemaModel.find({
    status: "Active",
  })
    .populate("salonID")
    .lean();

  const availableSalons = [];

  for (const sub of subscriptions) {
    if (!sub.salonID) continue;

    const weeklyMatchCount = await getWeeklyMatchCount(sub._id, weekStart);

    if (weeklyMatchCount < 10) {
      availableSalons.push({
        salon: sub.salonID,
        remainingMatches: 10 - weeklyMatchCount,
        subscription: {
          ...sub,
          weeklyMatchCount,
        },
      });
    }
  }

  return availableSalons;
};

/**
 * Calculate relevance score for a salon based on user preferences
 */
const calculateRelevanceScore = (salon, userPreferences, userLocation) => {
  let score = 0;

  // Service preference match (0-40 points)
  if (userPreferences.preferredServices.length > 0) {
    if (salon.typesOfMassages && Array.isArray(salon.typesOfMassages)) {
      const salonServices = salon.typesOfMassages.map((s) => s.toLowerCase());
      const matches = userPreferences.preferredServices.some((pref) =>
        salonServices.some(
          (salonService) =>
            salonService.includes(pref) || pref.includes(salonService)
        )
      );
      if (matches) {
        score += 40;
      } else {
        score += 10; // small neutral score if not matching
      }
    } else {
      score += 20; // Neutral if salon has no service info
    }
  } else {
    score += 20; // Neutral score if no preferences
  }

  // Price range match (0-25 points)
  if (userPreferences.priceRange) {
    const salonAvgPrice = salon.priceRange ? parseFloat(salon.priceRange) : 0;

    if (
      salonAvgPrice >= userPreferences.priceRange.min &&
      salonAvgPrice <= userPreferences.priceRange.max
    ) {
      const priceDiff = Math.abs(
        salonAvgPrice - userPreferences.priceRange.average
      );
      const priceRange =
        userPreferences.priceRange.max - userPreferences.priceRange.min;
      score += 25 * (1 - Math.min(priceDiff / priceRange, 1));
    }
  } else {
    score += 12.5; // Neutral score
  }

  // Location proximity (0-25 points)
  if (
    userLocation &&
    salon.location &&
    salon.location.latitude !== undefined &&
    salon.location.longitude !== undefined &&
    userPreferences.locationPattern
  ) {
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      salon.location.latitude,
      salon.location.longitude
    );

    if (distance <= userPreferences.locationPattern.maxDistance) {
      score +=
        25 * (1 - distance / userPreferences.locationPattern.maxDistance);
    }
  } else {
    score += 12.5; // Neutral score
  }

  // Rating boost (0-10 points) - if salon has rating field
  if (salon.rating && salon.rating > 0) {
    score += (salon.rating / 5) * 10;
  }

  return score;
};

/**
 * Main recommendation algorithm
 */
export const getRecommendations = async (
  userId,
  userLocation = null,
  limit = 20
) => {
  try {
    // Get user preferences from booking history
    const userPreferences = await analyzeUserPreferences(userId);

    // Get available subscribed salons
    const weekStart = getWeekStart();
    const subscribedSalons = await getAvailableSubscribedSalons(weekStart);

    // 🔥 CRITICAL: Fetch all active salons with ownerId field included
    const allSalons = await SalonProfileSchemaModel.find({})
      .select(
        "_id salonName salonImage location priceRange typesOfMassages rating totalReviews ownerId"
      )
      .lean();

    // Get subscription IDs for subscribed salons
    const subscribedSalonIds = subscribedSalons.map((item) =>
      item.salon._id.toString()
    );

    // Filter out subscribed salons from all salons list
    const nonSubscribedSalons = allSalons.filter(
      (salon) => !subscribedSalonIds.includes(salon._id.toString())
    );

    // Combine subscribed and non-subscribed salons
    const allSalonsList = [
      ...subscribedSalons.map((item) => item.salon),
      ...nonSubscribedSalons,
    ];

    // Calculate scores for all salons
    const salonScores = allSalonsList.map((salon) => {
      const baseScore = calculateRelevanceScore(
        salon,
        userPreferences,
        userLocation
      );

      // Boost subscribed salons
      const subscribedSalon = subscribedSalons.find(
        (item) => item.salon._id.toString() === salon._id.toString()
      );
      let boost = 0;
      if (subscribedSalon && subscribedSalon.remainingMatches > 0) {
        boost = 50; // Significant boost for subscribed salons
      }

      // Check if user has booked this salon before (slight preference)
      const isFrequent = userPreferences.frequentSalons.includes(
        salon._id.toString()
      );
      if (isFrequent) {
        boost += 10;
      }

      return {
        salon,
        score: baseScore + boost,
        isSubscribed: !!subscribedSalon,
        subscription: subscribedSalon?.subscription,
      };
    });

    // Sort by score (descending)
    salonScores.sort((a, b) => b.score - a.score);

    // Take top results
    const recommendations = salonScores.slice(0, limit);

    // Track matches for subscribed salons
    const weekStartDate = getWeekStart();
    for (const rec of recommendations) {
      if (rec.isSubscribed && rec.subscription) {
        // Check if this match was already counted this week
        const existingMatch = await RecommendationMatchModel.findOne({
          salonId: rec.salon._id,
          userId: userId,
          weekStartDate: weekStartDate,
        });

        // Get current weekly match count
        const currentWeeklyMatchCount = await getWeeklyMatchCount(
          rec.subscription._id,
          weekStartDate
        );

        if (!existingMatch && currentWeeklyMatchCount < 10) {
          // Create match record
          await RecommendationMatchModel.create({
            salonId: rec.salon._id,
            userId: userId,
            weekStartDate: weekStartDate,
          });

          // Update the subscription object for response
          rec.subscription.weeklyMatchCount = currentWeeklyMatchCount + 1;
        } else if (existingMatch) {
          rec.subscription.weeklyMatchCount = currentWeeklyMatchCount;
        }
      }
    }

    // 🔥 CRITICAL: Return recommendations with ownerId included
    return recommendations.map((rec) => ({
      salon: {
        _id: rec.salon._id,
        salonName: rec.salon.salonName,
        name: rec.salon.salonName,
        salonImage: rec.salon.salonImage,
        location: rec.salon.location,
        priceRange: rec.salon.priceRange,
        typesOfMassages: rec.salon.typesOfMassages,
        rating: rec.salon.rating || 0,
        totalReviews: rec.salon.totalReviews || 0,
        isSubscribed: rec.isSubscribed,
        ownerId: rec.salon.ownerId, // 🔥 CRITICAL: Include ownerId for booking requests
      },
      score: rec.score,
      reasons: generateRecommendationReasons(rec.salon, userPreferences),
    }));
  } catch (error) {
    console.error("Error in recommendation algorithm:", error);
    throw error;
  }
};

/**
 * Generate human-readable reasons for recommendation
 */
const generateRecommendationReasons = (salon, userPreferences) => {
  const reasons = [];

  // Check if salon is subscribed (we'll need to check this from subscription)
  // For now, we'll skip this check in reasons as it's already in the response

  if (userPreferences.preferredServices.length > 0) {
    if (salon.typesOfMassages && Array.isArray(salon.typesOfMassages)) {
      const salonServices = salon.typesOfMassages.map((s) => s.toLowerCase());
      const matches = userPreferences.preferredServices.some((pref) =>
        salonServices.some(
          (salonService) =>
            salonService.includes(pref) || pref.includes(salonService)
        )
      );
      if (matches) {
        reasons.push(`Offers ${salon.typesOfMassages.join(", ")}`);
      }
    }
  }

  if (salon.rating && salon.rating >= 4.5) {
    reasons.push("Highly rated");
  }

  if (userPreferences.frequentSalons.includes(salon._id.toString())) {
    reasons.push("Previously visited");
  }

  return reasons.length > 0 ? reasons : ["Popular choice"];
};
