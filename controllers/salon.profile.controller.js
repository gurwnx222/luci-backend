import { SalonProfileSchemaModel } from "../models";
import NodeGeocoder from "node-geocoder";
export const createSalonProfile = async (req, res) => {
  try {
    const {
      salonName,
      salonImage = "temporarily disabled for testing purposes.",
      location,
      priceRange,
      typesOfMassages,
      subscriptionID,
    } = req.body;

    console.log("Received salon profile data:", {
      salonName,
      salonImage,
      location,
      priceRange,
      typesOfMassages,
      subscriptionID,
    });
    // Comprehensive validation
    if (!salonName) {
      return res.status(400).json({
        success: false,
        message: "Salon name is required",
      });
    }
    /* if (!salonImage) {
      return res.status(400).json({
        success: false,
        message: "Salon image is required",
      });
    } */
    // Validate location object
    if (!location || typeof location !== "object") {
      return res.status(400).json({
        success: false,
        message: "Location information is required",
      });
    }

    const { streetAddress, city, country, latitude, longitude } = location;

    if (!streetAddress || !city || !country) {
      return res.status(400).json({
        success: false,
        message:
          "Complete location details (street address, city, country) are required",
      });
    }
    if (!priceRange) {
      return res.status(400).json({
        success: false,
        message: "Price range is required",
      });
    }
    // Validate massage types
    if (
      !typesOfMassages ||
      !Array.isArray(typesOfMassages) ||
      typesOfMassages.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one massage type must be selected",
      });
    }

    // Validate subscriptionID if provided
    if (subscriptionID && !mongoose.Types.ObjectId.isValid(subscriptionID)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription ID format",
      });
    }

    // Create new salon profile
    const newSalonProfile = new SalonProfileSchemaModel({
      salonName,
      salonImage,
      location: {
        streetAddress,
        city,
        country,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      },
      priceRange,
      typesOfMassages,
      subscriptionID: subscriptionID || undefined, // Only add if provided
    });

    // Save to database
    const savedSalonProfile = await newSalonProfile.save();
    return res.status(201).json({
      success: true,
      message: "Salon profile created successfully",
      data: savedSalonProfile,
    });
  } catch (error) {
    console.error("Error creating salon profile:", error);

    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors,
      });
    }

    // Handle duplicate key errors (unique fields)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A salon with this information already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error creating salon profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
