import { mongoose, Schema } from "mongoose";

const SalonProfileSchema = new Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserProfile",
      required: [true, "Owner ID is required"],
      index: true, // Add index for faster queries
    },
    salonName: {
      type: String,
      required: true,
    },
    location: {
      streetAddress: {
        type: String,
        required: false,
      },
      city: {
        type: String,
        required: false,
      },
      province: {
        type: String,
        required: false,
      },
      country: {
        type: String,
        required: false,
        default: "Thailand",
      },
      latitude: {
        type: Number,
        required: false,
      },
      longitude: {
        type: Number,
        required: false,
      },
    },
    salonImage: {
      type: String,
      validate: {
        validator: function (v) {
          return /^https?:\/\/.+/.test(v);
        },
        message: "Image URL must be a valid HTTP/HTTPS URL",
      },
      required: false,
    },
    priceRange: {
      type: String,
      min: 10,
      max: 5000,
      required: true,
    },
    typesOfMassages: {
      type: [String],
      enum: [
        "Neck/Shoulder",
        "Oil massage",
        "Nuad Thai",
        "Hot compress",
        "Aromatherapy",
        "Foot massage",
        "others",
      ],
      required: [false, "At least one massage type is required"],
      validate: {
        validator: function (arr) {
          return arr && arr.length > 0; // Ensure at least one type is selected
        },
        message: "At least one massage type must be selected",
      },
    },
  },
  { timestamps: true }
);

const SalonProfileSchemaModel = mongoose.model(
  "Salon Profile",
  SalonProfileSchema
);

export default SalonProfileSchemaModel;
