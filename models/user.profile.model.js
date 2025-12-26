import { mongoose, Schema } from "mongoose";

const UserProfileSchema = new Schema(
  {
    salonOwnerName: {
      type: String,
      required: true,
    },
    salonOwnerEmail: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (email) {
          const emailRegex =
            /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
          if (!email || typeof email !== "string") return false;
          if (email.length > 254) return false;
          if (email.includes("..")) return false;
          if (email.startsWith(".") || email.endsWith(".")) return false;
          const dangerousPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+=/i,
            /<iframe/i,
            /\$\{/,
            /`/,
            /\\/,
          ];
          if (dangerousPatterns.some((pattern) => pattern.test(email))) {
            return false;
          }
          return emailRegex.test(email);
        },
        message: "Please provide a valid email address",
      },
    },
    salonProfileId: {
      // ✅ Changed from salonID
      type: Schema.Types.ObjectId,
      ref: "Salon Profile",
    },
    subscriptionID: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
    },
  },
  { timestamps: true }
);

const UserProfileSchemaModel = mongoose.model(
  "Salon Owner Profile",
  UserProfileSchema
);

export default UserProfileSchemaModel;
