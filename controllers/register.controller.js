import {
  UserProfileSchemaModel,
  SalonProfileSchemaModel,
} from "../models/index.js";
import mongoose from "mongoose";
import { cleanUploadedFile } from "../utils/cleanUploadedFile.js";
import { geocodeAddress } from "../utils/NodeGeocoder.js";
import { UploadOnImageKit } from "../utils/ImageKit.js";

// ============================================
// Register Salon Owner Profile
// ============================================
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

    // ===== SIMPLE OWNER REGISTRATION MODE =====
    // If salonName is missing but ownerEmail/ownerName are provided,
    // treat this as a plain salon-owner registration and skip salon profile logic.
    if (!salonName && ownerEmail && ownerName) {
      try {
        // Check if owner already exists
        let existingOwner = await UserProfileSchemaModel.findOne({
          salonOwnerEmail: ownerEmail.toLowerCase().trim(),
        });

        if (existingOwner) {
          return res.status(200).json({
            success: true,
            data: existingOwner,
            message: "Salon owner already registered",
          });
        }

        // Create new owner
        const newOwner = new UserProfileSchemaModel({
          salonOwnerName: ownerName.trim(),
          salonOwnerEmail: ownerEmail.toLowerCase().trim(),
        });
        const savedOwner = await newOwner.save();

        return res.status(201).json({
          success: true,
          data: savedOwner,
          message: "Salon owner registered successfully",
        });
      } catch (ownerError) {
        return res.status(500).json({
          success: false,
          message: "Error registering salon owner",
          error:
            process.env.NODE_ENV === "development"
              ? ownerError.message
              : undefined,
        });
      }
    }

    // ===== FULL SALON PROFILE CREATION MODE =====
    // From here on we expect full salon profile payload

    // ===== OWNER EMAIL & NAME VALIDATION =====
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

    // ===== FIND OR CREATE SALON OWNER =====
    let salonOwner = await UserProfileSchemaModel.findOne({
      salonOwnerEmail: ownerEmail.toLowerCase().trim(),
    });

    // 🔥 AUTO-CREATE OWNER IF DOESN'T EXIST
    if (!salonOwner) {
      console.log("Salon owner not found. Creating new owner profile...");

      salonOwner = new UserProfileSchemaModel({
        salonOwnerName: ownerName.trim(),
        salonOwnerEmail: ownerEmail.toLowerCase().trim(),
      });

      try {
        await salonOwner.save();
        console.log("✅ Auto-created salon owner:", {
          id: salonOwner._id,
          email: salonOwner.salonOwnerEmail,
          name: salonOwner.salonOwnerName,
        });
      } catch (saveError) {
        cleanUploadedFile(uploadedFilePath);

        // Handle duplicate email error
        if (saveError.code === 11000) {
          return res.status(409).json({
            success: false,
            message: "An owner with this email already exists",
          });
        }

        console.error("Error creating owner:", saveError);
        return res.status(500).json({
          success: false,
          message: "Failed to create salon owner profile",
          error:
            process.env.NODE_ENV === "development"
              ? saveError.message
              : undefined,
        });
      }
    } else {
      console.log("✅ Found existing salon owner:", salonOwner._id);
    }

    // ===== CHECK IF OWNER ALREADY HAS A SALON PROFILE =====
    if (salonOwner.salonProfileId) {
      cleanUploadedFile(uploadedFilePath);
      return res.status(400).json({
        success: false,
        message:
          "This owner already has a salon profile. Each owner can only create one salon profile.",
        existingProfileId: salonOwner.salonProfileId,
      });
    }

    // ===== SALON NAME VALIDATION =====
    if (!salonName || typeof salonName !== "string" || !salonName.trim()) {
      cleanUploadedFile(uploadedFilePath);
      return res.status(400).json({
        success: false,
        message: "Salon name is required and must be a non-empty string",
      });
    }

    // ===== IMAGE VALIDATION =====
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Salon image is required",
      });
    }

    // ===== LOCATION VALIDATION =====
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

    // ===== PRICE RANGE VALIDATION =====
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

    // ===== MASSAGE TYPES VALIDATION =====
    if (!Array.isArray(typesOfMassages) || typesOfMassages.length === 0) {
      cleanUploadedFile(uploadedFilePath);
      return res.status(400).json({
        success: false,
        message: "At least one massage type must be selected",
        hint: "Ensure typesOfMassages is sent as a JSON array string in form-data",
      });
    }

    // ===== SUBSCRIPTION ID VALIDATION =====
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
      console.log("🌍 Geocoding address:", {
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

      console.log("✅ Geocoding result:", geoDataLatLot);
    } catch (geoError) {
      cleanUploadedFile(uploadedFilePath);
      console.error("❌ Geocoding failed:", geoError);
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
      console.log("📤 Uploading image to ImageKit:", uploadedFilePath);
      imageKitResponse = await UploadOnImageKit(uploadedFilePath);
      console.log("✅ ImageKit upload successful:", imageKitResponse.url);
    } catch (uploadError) {
      cleanUploadedFile(uploadedFilePath);
      console.error("❌ ImageKit upload failed:", uploadError);
      return res.status(500).json({
        success: false,
        message: "Failed to upload image to storage",
        error:
          process.env.NODE_ENV === "development"
            ? uploadError.message
            : undefined,
      });
    } finally {
      // Clean up local file after upload attempt
      cleanUploadedFile(uploadedFilePath);
    }

    // ===== CREATE SALON PROFILE =====
    const newSalonProfile = new SalonProfileSchemaModel({
      salonName: salonName.trim(),
      salonImage: imageKitResponse.url,
      location: {
        streetAddress: streetAddress.trim(),
        city: city.trim(),
        province: province.trim(),
        country: country.trim(),
        latitude: parseFloat(geoDataLatLot.latitude),
        longitude: parseFloat(geoDataLatLot.longitude),
      },
      priceRange,
      typesOfMassages,
      subscriptionID: subscriptionID || undefined,
      ownerId: salonOwner._id,
    });

    const savedSalonProfile = await newSalonProfile.save();

    // ===== LINK SALON PROFILE TO OWNER =====
    salonOwner.salonProfileId = savedSalonProfile._id;
    await salonOwner.save();

    console.log("✅ Salon profile created and linked to owner:", {
      profileId: savedSalonProfile._id,
      ownerId: salonOwner._id,
      ownerEmail: salonOwner.salonOwnerEmail,
      ownerName: salonOwner.salonOwnerName,
    });

    // ===== SUCCESS RESPONSE =====
    return res.status(201).json({
      success: true,
      message: "Salon profile created and linked to your account successfully",
      data: {
        salonProfile: savedSalonProfile,
        owner: {
          id: salonOwner._id,
          email: salonOwner.salonOwnerEmail,
          name: salonOwner.salonOwnerName,
        },
      },
    });
  } catch (error) {
    // Clean up uploaded file in case of any error
    cleanUploadedFile(uploadedFilePath);
    console.error("❌ Error creating salon profile:", error);

    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors,
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      return res.status(409).json({
        success: false,
        message: `A salon with this ${field || "information"} already exists`,
      });
    }

    // Generic error response
    return res.status(500).json({
      success: false,
      message: "Error creating salon profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================================
// Fetch Salon Owner Profile by ID
// ============================================
export const fetchSalonOwnerProfile = async (req, res) => {
  try {
    const { _id } = req.body;

    // Validate ID presence
    if (!_id) {
      return res.status(400).json({
        success: false,
        message: "ID is not provided",
      });
    }

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    // Fetch salon owner with populated salon profile
    const salonOwner = await UserProfileSchemaModel.findById(_id).populate(
      "salonProfileId"
    );

    if (!salonOwner) {
      return res.status(404).json({
        success: false,
        message: "Salon owner profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Salon owner profile fetched successfully",
      data: salonOwner,
    });
  } catch (error) {
    console.error("❌ Error fetching salon owner profile:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
