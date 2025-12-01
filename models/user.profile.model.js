import { mongoose, Schema } from "mongoose";

const UserProfileSchema = new Schema({
  salonOwnerName: {
    type: String,
    required: true,
  },
  salonOwnerEmail: {
    type: String,
    required: true,
    unique: true,
  },
  salonID: {
    type: Schema.Types.ObjectId,
    ref: "Salon Profile",
  },
  chats: {
    type: [Schema.Types.ObjectId],
    ref: "Chat",
  },
});

const UserProfileSchemaModel = mongoose.model(
  "Salon Owner Profile",
  UserProfileSchema
);

export default UserProfileSchemaModel;
