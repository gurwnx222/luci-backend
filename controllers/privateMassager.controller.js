// controllers/privateMassager.controller.js

import {
  PrivateMassagerSchemaModel,
  UserProfileSchemaModel,
} from "../models/index.js";
import { UploadOnImageKit } from "../utils/ImageKit.js";
import mongoose from "mongoose";
import { cleanUploadedFile } from "../utils/cleanUploadedFile.js";

/**
 * Create a new private massager profile
 * POST /api/private-massagers
 */
export const createPrivateMassager = async (req, res) => {
  const uploadedFiles = req.files || (req.file ? [req.file] : []);

  try {
    // Clean up field names (remove trailing/leading whitespace from keys)
    const cleanedBody = {};
    Object.keys(req.body).forEach((key) => {
      const cleanedKey = key.trim();
      cleanedBody[cleanedKey] = req.body[key];
    });

    const {
      ownerEmail,
      ownerName,
      height,
      weight,
      aboutMe,
      occupation,
      gender,
      subscriptionID,
    } = cleanedBody;

    // ===== OWNER VALIDATION =====
    if (!ownerEmail || !ownerName) {
      // Clean up uploaded files
      uploadedFiles.forEach((file) => cleanUploadedFile(file?.path));
      return res.status(400).json({
        success: false,
        message: "Owner email and name are required",
        required: ["ownerEmail", "ownerName"],
        received: {
          ownerEmail: ownerEmail || null,
          ownerName: ownerName || null,
        },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(ownerEmail)) {
      uploadedFiles.forEach((file) => cleanUploadedFile(file?.path));
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Find the owner by email and name
    const owner = await UserProfileSchemaModel.findOne({
      salonOwnerEmail: ownerEmail.toLowerCase().trim(),
      salonOwnerName: ownerName.trim(),
    });

    if (!owner) {
      uploadedFiles.forEach((file) => cleanUploadedFile(file?.path));
      return res.status(404).json({
        success: false,
        message:
          "Owner not found with the provided email and name. Please ensure you are registered first.",
      });
    }

    // Check if the owner already has a private massager profile
    const existingProfile = await PrivateMassagerSchemaModel.findOne({
      ownerId: owner._id,
    });

    if (existingProfile) {
      uploadedFiles.forEach((file) => cleanUploadedFile(file?.path));
      return res.status(400).json({
        success: false,
        message:
          "This owner already has a private massager profile. Each owner can only create one profile.",
        existingProfileId: existingProfile._id,
      });
    }

    // ===== VALIDATION SECTION =====

    // Validate gender if provided
    if (gender && !["Male", "Female", "Others"].includes(gender)) {
      uploadedFiles.forEach((file) => cleanUploadedFile(file?.path));
      return res.status(400).json({
        success: false,
        message: "Gender must be one of: Male, Female, Others",
      });
    }

    // Validate height if provided (in cm)
    if (height !== undefined) {
      const heightNum = parseFloat(height);
      if (isNaN(heightNum) || heightNum < 0 || heightNum > 300) {
        uploadedFiles.forEach((file) => cleanUploadedFile(file?.path));
        return res.status(400).json({
          success: false,
          message: "Height must be a number between 0 and 300 cm",
        });
      }
    }

    // Validate weight if provided (in kg)
    if (weight !== undefined) {
      const weightNum = parseFloat(weight);
      if (isNaN(weightNum) || weightNum < 0 || weightNum > 300) {
        uploadedFiles.forEach((file) => cleanUploadedFile(file?.path));
        return res.status(400).json({
          success: false,
          message: "Weight must be a number between 0 and 300 kg",
        });
      }
    }

    // Validate subscriptionID if provided
    if (subscriptionID && !mongoose.Types.ObjectId.isValid(subscriptionID)) {
      uploadedFiles.forEach((file) => cleanUploadedFile(file?.path));
      return res.status(400).json({
        success: false,
        message: "Invalid subscription ID format",
      });
    }

    // ===== IMAGE UPLOAD SECTION =====

    let profilePhoto = null;
    const photos = [];

    // Upload profile photo (first file if single, or specific field)
    if (uploadedFiles.length > 0) {
      try {
        const firstFile = uploadedFiles[0];
        console.log("Uploading profile photo to ImageKit:", firstFile.path);
        const imageKitResponse = await UploadOnImageKit(firstFile.path);
        profilePhoto = imageKitResponse.url;
        console.log("Profile photo upload successful:", profilePhoto);
        cleanUploadedFile(firstFile.path);

        // Upload additional photos if there are more files
        for (let i = 1; i < uploadedFiles.length; i++) {
          const file = uploadedFiles[i];
          try {
            console.log("Uploading additional photo to ImageKit:", file.path);
            const additionalPhotoResponse = await UploadOnImageKit(file.path);
            photos.push(additionalPhotoResponse.url);
            console.log("Additional photo upload successful:", additionalPhotoResponse.url);
            cleanUploadedFile(file.path);
          } catch (uploadError) {
            console.error("Failed to upload additional photo:", uploadError);
            cleanUploadedFile(file.path);
            // Continue with other photos even if one fails
          }
        }
      } catch (uploadError) {
        uploadedFiles.forEach((file) => cleanUploadedFile(file?.path));
        console.error("ImageKit upload failed:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload image to storage",
          error:
            process.env.NODE_ENV === "development"
              ? uploadError.message
              : undefined,
        });
      }
    }

    // ===== DATABASE SAVE SECTION =====

    const newPrivateMassager = new PrivateMassagerSchemaModel({
      ownerId: owner._id,
      profilePhoto,
      photos,
      height: height !== undefined ? parseFloat(height) : undefined,
      weight: weight !== undefined ? parseFloat(weight) : undefined,
      aboutMe: aboutMe?.trim() || undefined,
      occupation: occupation?.trim() || undefined,
      gender,
      subscriptionID: subscriptionID || undefined,
    });

    const savedPrivateMassager = await newPrivateMassager.save();

    console.log("Private massager profile created and linked to owner:", {
      profileId: savedPrivateMassager._id,
      ownerId: owner._id,
      ownerEmail: ownerEmail,
      ownerName: ownerName,
    });

    return res.status(201).json({
      success: true,
      message: "Private massager profile created and linked to your account successfully",
      data: {
        privateMassager: savedPrivateMassager,
        ownerId: owner._id,
        ownerEmail: owner.salonOwnerEmail,
        ownerName: owner.salonOwnerName,
      },
    });
  } catch (error) {
    // Clean up files in case of any unhandled errors
    uploadedFiles.forEach((file) => cleanUploadedFile(file?.path));

    console.error("Error creating private massager profile:", error);

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
        message: `A private massager with this ${field || "information"} already exists`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error creating private massager profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Fetch all private massagers
 * GET /api/private-massagers
 */
export const getPrivateMassagers = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const privateMassagers = await PrivateMassagerSchemaModel.find({})
      .select(
        "_id profilePhoto photos height weight aboutMe occupation gender ownerId subscriptionID"
      )
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await PrivateMassagerSchemaModel.countDocuments();

    return res.status(200).json({
      success: true,
      message: "Private massagers fetched successfully",
      count: privateMassagers.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: privateMassagers,
    });
  } catch (error) {
    console.error("Error fetching private massagers:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching private massagers",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Fetch single private massager by ID
 * GET /api/private-massagers/:id
 */
export const getPrivateMassagerById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid private massager ID format",
      });
    }

    const privateMassager = await PrivateMassagerSchemaModel.findById(id)
      .select(
        "_id profilePhoto photos height weight aboutMe occupation gender ownerId subscriptionID"
      )
      .lean();

    if (!privateMassager) {
      return res.status(404).json({
        success: false,
        message: "Private massager profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Private massager profile fetched successfully",
      data: privateMassager,
    });
  } catch (error) {
    console.error("Error fetching private massager profile:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching private massager profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update private massager profile
 * PUT /api/private-massagers/:id
 */
export const updatePrivateMassager = async (req, res) => {
  const uploadedFiles = req.files || (req.file ? [req.file] : []);

  try {
    // Clean up field names (remove trailing/leading whitespace from keys)
    const cleanedBody = {};
    Object.keys(req.body).forEach((key) => {
      const cleanedKey = key.trim();
      cleanedBody[cleanedKey] = req.body[key];
    });

    const { id } = req.params;
    const {
      height,
      weight,
      aboutMe,
      occupation,
      gender,
      subscriptionID,
    } = cleanedBody;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      uploadedFiles.forEach((file) => cleanUploadedFile(file?.path));
      return res.status(400).json({
        success: false,
        message: "Invalid private massager ID format",
      });
    }

    const privateMassager = await PrivateMassagerSchemaModel.findById(id);

    if (!privateMassager) {
      uploadedFiles.forEach((file) => cleanUploadedFile(file?.path));
      return res.status(404).json({
        success: false,
        message: "Private massager profile not found",
      });
    }

    // Validate gender if provided
    if (gender && !["Male", "Female", "Others"].includes(gender)) {
      uploadedFiles.forEach((file) => cleanUploadedFile(file?.path));
      return res.status(400).json({
        success: false,
        message: "Gender must be one of: Male, Female, Others",
      });
    }

    // Validate height if provided
    if (height !== undefined) {
      const heightNum = parseFloat(height);
      if (isNaN(heightNum) || heightNum < 0 || heightNum > 300) {
        uploadedFiles.forEach((file) => cleanUploadedFile(file?.path));
        return res.status(400).json({
          success: false,
          message: "Height must be a number between 0 and 300 cm",
        });
      }
      privateMassager.height = heightNum;
    }

    // Validate weight if provided
    if (weight !== undefined) {
      const weightNum = parseFloat(weight);
      if (isNaN(weightNum) || weightNum < 0 || weightNum > 300) {
        uploadedFiles.forEach((file) => cleanUploadedFile(file?.path));
        return res.status(400).json({
          success: false,
          message: "Weight must be a number between 0 and 300 kg",
        });
      }
      privateMassager.weight = weightNum;
    }

    // Update other fields if provided
    if (aboutMe !== undefined) {
      privateMassager.aboutMe = aboutMe?.trim() || undefined;
    }
    if (occupation !== undefined) {
      privateMassager.occupation = occupation?.trim() || undefined;
    }
    if (gender !== undefined) {
      privateMassager.gender = gender;
    }
    if (subscriptionID !== undefined) {
      if (subscriptionID && !mongoose.Types.ObjectId.isValid(subscriptionID)) {
        uploadedFiles.forEach((file) => cleanUploadedFile(file?.path));
        return res.status(400).json({
          success: false,
          message: "Invalid subscription ID format",
        });
      }
      privateMassager.subscriptionID = subscriptionID || undefined;
    }

    // Handle photo uploads if provided
    if (uploadedFiles.length > 0) {
      try {
        const firstFile = uploadedFiles[0];
        const imageKitResponse = await UploadOnImageKit(firstFile.path);
        privateMassager.profilePhoto = imageKitResponse.url;
        cleanUploadedFile(firstFile.path);

        // Add additional photos if provided
        const newPhotos = [];
        for (let i = 1; i < uploadedFiles.length; i++) {
          const file = uploadedFiles[i];
          try {
            const photoResponse = await UploadOnImageKit(file.path);
            newPhotos.push(photoResponse.url);
            cleanUploadedFile(file.path);
          } catch (uploadError) {
            console.error("Failed to upload additional photo:", uploadError);
            cleanUploadedFile(file.path);
          }
        }
        // Append new photos to existing photos array
        if (newPhotos.length > 0) {
          privateMassager.photos = [...(privateMassager.photos || []), ...newPhotos];
        }
      } catch (uploadError) {
        uploadedFiles.forEach((file) => cleanUploadedFile(file?.path));
        console.error("ImageKit upload failed:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload image to storage",
          error:
            process.env.NODE_ENV === "development"
              ? uploadError.message
              : undefined,
        });
      }
    }

    const updatedPrivateMassager = await privateMassager.save();

    return res.status(200).json({
      success: true,
      message: "Private massager profile updated successfully",
      data: updatedPrivateMassager,
    });
  } catch (error) {
    uploadedFiles.forEach((file) => cleanUploadedFile(file?.path));

    console.error("Error updating private massager profile:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error updating private massager profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Delete private massager profile
 * DELETE /api/private-massagers/:id
 */
export const deletePrivateMassager = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid private massager ID format",
      });
    }

    const privateMassager = await PrivateMassagerSchemaModel.findByIdAndDelete(id);

    if (!privateMassager) {
      return res.status(404).json({
        success: false,
        message: "Private massager profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Private massager profile deleted successfully",
      data: privateMassager,
    });
  } catch (error) {
    console.error("Error deleting private massager profile:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting private massager profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

