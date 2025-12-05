// controllers/salon.profile.controller.js

import { SalonProfileSchemaModel } from "../models/index.js";
import { geocodeAddress } from "../utils/NodeGeocoder.js";
import { UploadOnImageKit } from "../utils/ImageKit.js";
import mongoose from "mongoose";

/**
 * Helper function to clean up uploaded file
 */
import { cleanUploadedFile } from "../utils/cleanUploadedFile.js";

export const createSalonProfile = async (req, res) => {
  const uploadedFilePath = req.file?.path;

  try {
    const { salonName, priceRange, subscriptionID, location, typesOfMassages } =
      req.body;

    // ===== VALIDATION SECTION =====

    // Validate salon name
    if (!salonName) {
      cleanUploadedFile(uploadedFilePath);
      return res.status(400).json({
        success: false,
        message: "Salon name is required and must be a non-empty string",
      });
    }

    // Validate salon image
    /*if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Salon image is required",
      });
    } */

    // Validate location object (should already be parsed by middleware)
    if (!location || typeof location !== "object" || Array.isArray(location)) {
      cleanUploadedFile(uploadedFilePath);
      return res.status(400).json({
        success: false,
        message: "Location information is required and must be a valid object",
        hint: "Ensure location is sent as a JSON string in form-data",
      });
    }

    const { streetAddress, city, province, country } = location;

    if (!streetAddress || !city || !province || !country) {
      cleanUploadedFile(uploadedFilePath);
      return res.status(400).json({
        success: false,
        message: "Complete location details are required",
        required: ["streetAddress", "city", "province", "country"],
        received: {
          streetAddress: !!streetAddress,
          city: !!city,
          province: !!province,
          country: !!country,
        },
      });
    }

    // Validate price range
    if (!priceRange || typeof priceRange !== "number") {
      cleanUploadedFile(uploadedFilePath);
      return res.status(400).json({
        success: false,
        message: "Price range is required",
      });
    }

    // Validate massage types (should already be parsed by middleware)
    if (!Array.isArray(typesOfMassages) || typesOfMassages.length === 0) {
      cleanUploadedFile(uploadedFilePath);
      return res.status(400).json({
        success: false,
        message: "At least one massage type must be selected",
        hint: "Ensure typesOfMassages is sent as a JSON array string in form-data",
      });
    }

    // Validate subscriptionID if provided
    if (subscriptionID && !mongoose.Types.ObjectId.isValid(subscriptionID)) {
      cleanUploadedFile(uploadedFilePath);
      return res.status(400).json({
        success: false,
        message: "Invalid subscription ID format",
      });
    }

    // ===== GEOCODING SECTION =====

    let geoDataLatLot;
    try {
      console.log("Geocoding address:", {
        streetAddress,
        city,
        province,
        country,
      });
      geoDataLatLot = await geocodeAddress({
        streetAddress,
        city,
        province,
        country,
      });
      console.log("Geocoding result:", geoDataLatLot);
    } catch (geoError) {
      cleanUploadedFile(uploadedFilePath);
      console.error("Geocoding failed:", geoError);
      return res.status(400).json({
        success: false,
        message:
          "Unable to geocode the provided address. Please verify the address is correct.",
        error:
          process.env.NODE_ENV === "development" ? geoError.message : undefined,
      });
    }

    if (!geoDataLatLot?.latitude || !geoDataLatLot?.longitude) {
      cleanUploadedFile(uploadedFilePath);
      return res.status(400).json({
        success: false,
        message: "Could not determine coordinates for the provided address",
      });
    }

    // ===== IMAGE UPLOAD SECTION =====

    let imageKitResponse;
    try {
      console.log("Uploading image to ImageKit:", uploadedFilePath);
      imageKitResponse = await UploadOnImageKit(uploadedFilePath);
      console.log("ImageKit upload successful:", imageKitResponse.url);
    } catch (uploadError) {
      cleanUploadedFile(uploadedFilePath);
      console.error("ImageKit upload failed:", uploadError);
      return res.status(500).json({
        success: false,
        message: "Failed to upload image to storage",
        error:
          process.env.NODE_ENV === "development"
            ? uploadError.message
            : undefined,
      });
    } finally {
      // Always clean up the temporary file after ImageKit upload attempt
      cleanUploadedFile(uploadedFilePath);
    }

    // ===== DATABASE SAVE SECTION =====

    const newSalonProfile = new SalonProfileSchemaModel({
      salonName: salonName.trim(),
      salonImage: imageKitResponse.url,
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

    const savedSalonProfile = await newSalonProfile.save();

    console.log("Salon profile created successfully:", savedSalonProfile._id);

    return res.status(201).json({
      success: true,
      message: "Salon profile created successfully",
      data: savedSalonProfile,
    });
  } catch (error) {
    // Clean up file in case of any unhandled errors
    cleanUploadedFile(uploadedFilePath);

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
      const field = Object.keys(error.keyPattern || {})[0];
      return res.status(409).json({
        success: false,
        message: `A salon with this ${field || "information"} already exists`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error creating salon profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
