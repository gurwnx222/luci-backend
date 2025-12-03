import { SalonProfileSchemaModel } from "../models/index.js";

export const createSalonProfile = async (req, res) => {
  try {
    const { salonName, salonAddress, salonImage, location } = req.body;
    console.log("received data:", { salonName, salonAddress, salonContact });
    if (!salonName || !salonAddress || !salonContact) {
      return res.status(400).json({
        message:
          "While creating salon profile, one of salonName, salonAddress, or salonContact is missing!!",
      });
    }
    const newSalonProfile = new SalonProfileSchemaModel({
      salonName,
      salonAddress,
      salonContact,
    });
    const savedSalonProfile = await newSalonProfile.save();
    res.status(201).json(savedSalonProfile);
  } catch (error) {
    res.status(500).json({ message: "Error creating salon profile", error });
  }
};
