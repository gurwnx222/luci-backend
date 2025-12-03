import { UserProfileSchemaModel } from "../models/index.js";
import mongoose from "mongoose";
// registering salon owner profile
export const registerSalonOwnerProfile = async (req, res) => {
  try {
    const { salonOwnerName, salonOwnerEmail, salonID, chats } = req.body;
    console.log("recieved data:", {
      salonOwnerName,
      salonOwnerEmail,
      chats,
      salonID,
    });

    if (!salonOwnerName || !salonOwnerEmail) {
      return res.status(400).json({
        message:
          "While registeration either salonOwnerName, or salonOwnerEmail is missing!!",
      });
    }
    const newUserProfile = new UserProfileSchemaModel({
      salonOwnerName,
      salonOwnerEmail,
      salonID,
      chats,
    });
    const savedProfile = await newUserProfile.save();
    res.status(201).json(savedProfile);
  } catch (error) {
    res.status(500).json({ message: "Error registering user profile", error });
  }
};

// fetching salon owner profile
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
