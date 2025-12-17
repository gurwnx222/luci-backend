// controllers/salon.profile.controller.js

import {
  SalonProfileSchemaModel,
  UserProfileSchemaModel,
} from "../models/index.js";
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
    const {
      salonName,
      priceRange,
      subscriptionID,
      location,
      typesOfMassages,
      ownerEmail,
      ownerName,
    } = req.body;

    // ===== OWNER VALIDATION =====

    // Validate owner email and name are provided
    if (!ownerEmail || !ownerName) {
      cleanUploadedFile(uploadedFilePath);
      return res.status(400).json({
        success: false,
        message: "Owner email and name are required",
        required: ["ownerEmail", "ownerName"],
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(ownerEmail)) {
      cleanUploadedFile(uploadedFilePath);
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Find the salon owner by email and name
    const salonOwner = await UserProfileSchemaModel.findOne({
      salonOwnerEmail: ownerEmail.toLowerCase().trim(),
      salonOwnerName: ownerName.trim(),
    });

    if (!salonOwner) {
      cleanUploadedFile(uploadedFilePath);
      return res.status(404).json({
        success: false,
        message:
          "Salon owner not found with the provided email and name. Please ensure you are registered first.",
      });
    }

    // Check if the owner already has a salon profile
    if (salonOwner.salonProfileId) {
      cleanUploadedFile(uploadedFilePath);
      return res.status(400).json({
        success: false,
        message:
          "This owner already has a salon profile. Each owner can only create one salon profile.",
        existingProfileId: salonOwner.salonProfileId,
      });
    }

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
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Salon image is required",
      });
    }

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

    // Validate price range (can be string or number, will be stored as string)
    if (
      !priceRange ||
      (typeof priceRange !== "string" && typeof priceRange !== "number")
    ) {
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

    // ===== UPDATE SALON OWNER WITH PROFILE ID =====

    // Attach the salon profile ID to the salon owner
    salonOwner.salonProfileId = savedSalonProfile._id;
    await salonOwner.save();

    console.log("Salon profile created and linked to owner:", {
      profileId: savedSalonProfile._id,
      ownerId: salonOwner._id,
      ownerEmail: ownerEmail,
      ownerName: ownerName,
    });

    return res.status(201).json({
      success: true,
      message: "Salon profile created and linked to your account successfully",
      data: {
        salonProfile: savedSalonProfile,
        ownerId: salonOwner._id,
        ownerEmail: salonOwner.email,
        ownerName: salonOwner.name,
      },
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

/**
 * Fetch all salon profiles with owner information
 * GET /api/v1/salons
 */
export const fetchAllSalonProfiles = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const salons = await SalonProfileSchemaModel.find({})
      .select(
        "_id salonName salonImage location priceRange typesOfMassages ownerId"
      )
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await SalonProfileSchemaModel.countDocuments();

    return res.status(200).json({
      success: true,
      message: "Salon profiles fetched successfully",
      count: salons.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: salons,
    });
  } catch (error) {
    console.error("Error fetching salon profiles:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching salon profiles",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Fetch single salon profile by ID with owner information
 * GET /api/v1/salons/:salonId
 */
export const fetchSalonProfileById = async (req, res) => {
  try {
    const { salonId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(salonId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salon ID format",
      });
    }

    const salon = await SalonProfileSchemaModel.findById(salonId)
      .select(
        "_id salonName salonImage location priceRange typesOfMassages ownerId"
      )
      .lean();

    if (!salon) {
      return res.status(404).json({
        success: false,
        message: "Salon profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Salon profile fetched successfully",
      data: salon,
    });
  } catch (error) {
    console.error("Error fetching salon profile:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching salon profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Fetch salon profile with populated owner details
 * GET /api/v1/salons/:salonId/with-owner
 */
export const fetchSalonWithOwnerDetails = async (req, res) => {
  try {
    const { salonId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(salonId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salon ID format",
      });
    }

    const salon = await SalonProfileSchemaModel.findById(salonId)
      .populate({
        path: "ownerId",
        select: "_id salonOwnerName salonOwnerEmail",
      })
      .lean();

    if (!salon) {
      return res.status(404).json({
        success: false,
        message: "Salon profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Salon profile with owner details fetched successfully",
      data: salon,
    });
  } catch (error) {
    console.error("Error fetching salon with owner details:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching salon profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Fetch salon profile by owner ID
 * GET /api/v1/salons/owner/:ownerId
 */
export const fetchSalonByOwnerId = async (req, res) => {
  try {
    const { ownerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid owner ID format",
      });
    }

    const salon = await SalonProfileSchemaModel.findOne({ ownerId })
      .select(
        "_id salonName salonImage location priceRange typesOfMassages ownerId"
      )
      .lean();

    if (!salon) {
      return res.status(404).json({
        success: false,
        message: "No salon profile found for this owner",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Salon profile fetched successfully",
      data: salon,
    });
  } catch (error) {
    console.error("Error fetching salon by owner ID:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching salon profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
