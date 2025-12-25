import { mongoose, Schema } from "mongoose";

const PrivateMassagerSchema = new Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      // Reference to user profile (similar to salon owner)
      ref: "Salon Owner Profile",
      required: false,
      index: true,
    },
    profilePhoto: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: "Image URL must be a valid HTTP/HTTPS URL",
      },
      required: false,
    },
    photos: {
      type: [String],
      validate: {
        validator: function (arr) {
          return !arr || arr.every((url) => /^https?:\/\/.+/.test(url));
        },
        message: "All photo URLs must be valid HTTP/HTTPS URLs",
      },
      default: [],
    },
    height: {
      type: Number,
      required: false,
      min: 0,
      max: 300, // in cm
    },
    weight: {
      type: Number,
      required: false,
      min: 0,
      max: 300, // in kg
    },
    aboutMe: {
      type: String,
      required: false,
      maxlength: 2000,
    },
    occupation: {
      type: String,
      required: false,
      maxlength: 200,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Others"],
      required: false,
    },
    subscriptionID: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      required: false,
    },
  },
  { timestamps: true }
);

const PrivateMassagerSchemaModel = mongoose.model(
  "Private Massager",
  PrivateMassagerSchema
);

export default PrivateMassagerSchemaModel;

