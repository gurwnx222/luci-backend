import { mongoose, Schema } from "mongoose";

const RecommendationMatchSchema = new Schema(
  {
    salonId: {
      type: Schema.Types.ObjectId,
      ref: "Salon Profile",
      required: true,
      index: true,
    },
    userId: {
      type: String, // firebaseUID of the requester
      required: true,
      index: true,
    },
    weekStartDate: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries
RecommendationMatchSchema.index({ salonId: 1, userId: 1, weekStartDate: 1 });

const RecommendationMatchModel =
  mongoose.models["Recommendation Match"] ||
  mongoose.model("Recommendation Match", RecommendationMatchSchema);

export default RecommendationMatchModel;

