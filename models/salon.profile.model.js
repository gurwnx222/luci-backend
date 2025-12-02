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
      country: {
        type: String,
        required: true,
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
      required: true,
    },
    priceRange: {
      type: String,
      min: 10,
      max: 5000,
      required: true,
    },
    typesOfMassages: {
      type: String,
      enum: [
        "Neck/Shoulder",
        "Oil massage",
        "Nuad Thai",
        "Hot compress",
        "Aromatherapy",
        "Foot massage",
        "others",
      ],
      required: true,
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
