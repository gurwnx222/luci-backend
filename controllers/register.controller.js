import { UserProfileSchemaModel } from "../models/index.js";
import mongoose from "mongoose";
// registering salon owner profile
// controllers/salon.profile.controller.js

export const registerSalonOwnerProfile = async (req, res) => {
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
    if (!ownerEmail || !ownerName) {
      cleanUploadedFile(uploadedFilePath);
      return res.status(400).json({
        success: false,
        message: "Owner email and name are required",
        required: ["ownerEmail", "ownerName"],
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(ownerEmail)) {
      cleanUploadedFile(uploadedFilePath);
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

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
    if (!salonName) {
      cleanUploadedFile(uploadedFilePath);
      return res.status(400).json({
        success: false,
        message: "Salon name is required and must be a non-empty string",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Salon image is required",
      });
    }

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

    if (!Array.isArray(typesOfMassages) || typesOfMassages.length === 0) {
      cleanUploadedFile(uploadedFilePath);
      return res.status(400).json({
        success: false,
        message: "At least one massage type must be selected",
        hint: "Ensure typesOfMassages is sent as a JSON array string in form-data",
      });
    }

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
      cleanUploadedFile(uploadedFilePath);
    }

    // ===== DATABASE SAVE SECTION =====
    // 🔥 KEY FIX: Add ownerId to the salon profile
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
      ownerId: salonOwner._id,
    });

    const savedSalonProfile = await newSalonProfile.save();

    // ===== UPDATE SALON OWNER WITH PROFILE ID =====
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
        ownerEmail: salonOwner.salonOwnerEmail,
        ownerName: salonOwner.salonOwnerName,
      },
    });
  } catch (error) {
    cleanUploadedFile(uploadedFilePath);
    console.error("Error creating salon profile:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors,
      });
    }

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
// fetching salon owner profile by ID
export const fetchSalonOwnerProfile = async (req, res) => {
  try {
    const { _id } = req.body;
    if (!_id) {
      return res.status(400).json({
        message: "ID is not provided",
        status: 400,
      });
    }
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({
        message: "Invalid ID format",
        status: 400,
      });
    }
    const fetchingSalonOwner = await UserProfileSchemaModel.findById(_id);
    if (!fetchingSalonOwner) {
      return res.status(404).json({
        message: "Salon owner profile not found",
        status: 404,
      });
    }
    return res.status(200).json({
      message: "Salon owner profile fetched successfully",
      status: 200,
      data: fetchingSalonOwner,
    });
  } catch (error) {
    console.error("Error fetching salon owner profile:", error);
    return res.status(500).json({
      message: "Internal server error while fetching profile",
      status: 500,
      error: error.message,
    });
  }
};
