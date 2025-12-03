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
      lowercase: true, // Normalize to lowercase
      trim: true, // Remove whitespace
      validate: {
        validator: function (email) {
          // RFC 5322 compliant email regex (simplified but secure)
          const emailRegex =
            /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

          // Additional security checks
          if (!email || typeof email !== "string") return false;
          if (email.length > 254) return false; // Max email length per RFC
          if (email.includes("..")) return false; // No consecutive dots
          if (email.startsWith(".") || email.endsWith(".")) return false;

          // Check for common injection patterns
          const dangerousPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+=/i, // onclick=, onerror=, etc.
            /<iframe/i,
            /\$\{/, // Template literals
            /`/, // Backticks
            /\\/, // Backslashes (unusual in emails)
          ];

          if (dangerousPatterns.some((pattern) => pattern.test(email))) {
            return false;
          }

          return emailRegex.test(email);
        },
        message: "Please provide a valid email address",
      },
    },
    salonID: {
      type: Schema.Types.ObjectId,
      ref: "Salon Profile",
    },
    chats: {
      type: [Schema.Types.ObjectId],
      ref: "Chat",
    },
  },
  { timestamps: true }
);

const UserProfileSchemaModel = mongoose.model(
  "Salon Owner Profile",
  UserProfileSchema
);

export default UserProfileSchemaModel;
