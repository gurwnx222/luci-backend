import { UserProfileSchemaModel } from "../models/index.js";

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
  const { _id } = req.body;
  if (!_id)
    return res.status(400).json({
      message: "Id is not provided",
      status: 400,
    });
  const fetchingSalonOwner = UserProfileSchemaModel.findById(_id);
  if (!fetchingSalonOwner)
    return res.status(500).json({
      message: "Error fetching the salon owner profile.",
    });
  console.log("Fetched salon owner:", fetchingSalonOwner);
};
