import { SalonProfileSchemaModel } from "../models/index.js";
import { geocodeAddress } from "../utils/NodeGeocoder.js";
import mongoose from "mongoose"; // ✅ Add this import if missing

export const createSalonProfile = async (req, res) => {
  try {
    const {
      salonName,
      salonImage,
      location,
      priceRange,
      typesOfMassages,
      subscriptionID,
    } = req.body;

    // Comprehensive validation
    if (!salonName) {
      return res.status(400).json({
        success: false,
        message: "Salon name is required",
      });
    }

    // Validate location object
    if (!location || typeof location !== "object") {
      return res.status(400).json({
        success: false,
        message: "Location information is required",
      });
    }

    const { streetAddress, city, province, country, latitude, longitude } =
      location;

    if (!streetAddress || !city || !country || !province) {
      return res.status(400).json({
        success: false,
        message:
          "Complete location details (street address, city, province, country) are required",
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
    let geoDataLatLot;
    try {
      geoDataLatLot = await geocodeAddress({
        streetAddress,
        city,
        province,
        country,
      });
      console.log("Geo Data for lat-lot conversion: ", geoDataLatLot);
    } catch (geoError) {
      console.error("Geocoding failed:", geoError.message);
      return res.status(400).json({
        success: false,
        message:
          "Unable to geocode the provided address. Please verify the address is correct.",
        error:
          process.env.NODE_ENV === "development" ? geoError.message : undefined,
      });
    }

    if (!geoDataLatLot || !geoDataLatLot.latitude || !geoDataLatLot.longitude) {
      return res.status(400).json({
        success: false,
        message: "Could not determine coordinates for the provided address",
      });
    }

    // Create new salon profile
    const newSalonProfile = new SalonProfileSchemaModel({
      salonName,
      salonImage,
      location: {
        streetAddress,
        city,
        province,
        country,
        latitude: parseFloat(geoDataLatLot.latitude),
        longitude: parseFloat(geoDataLatLot.longitude),
      },
      priceRange,
      typesOfMassages,
      subscriptionID: subscriptionID || undefined,
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
