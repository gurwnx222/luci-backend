import { mongoose, Schema } from "mongoose";

const SalonProfileSchema = new Schema(
  {
    salonName: {
      type: String,
      required: true,
    },
    location: {
      streetAddress: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      province: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        required: true,
        default: "Thailand",
      },
      latitude: {
        type: Number,
        required: true,
      },
      longitude: {
        type: Number,
        required: true,
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
      required: [true, "At least one massage type is required"],
      validate: {
        validator: function (arr) {
          return arr && arr.length > 0; // Ensure at least one type is selected
        },
        message: "At least one massage type must be selected",
      },
    },
    subscriptionID: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
    },
  },
  { timestamps: true }
);

const SalonProfileSchemaModel = mongoose.model(
  "Salon Profile",
  SalonProfileSchema
);

export default SalonProfileSchemaModel;
