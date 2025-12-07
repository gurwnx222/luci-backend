import mongoose, { Schema } from "mongoose";

const NotificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "Salon Owner Profile",
      required: true,
      index: true, // For fast queries
    },
    type: {
      type: String,
      enum: ["NEW_BOOKING", "BOOKING_CANCELLED", "BOOKING_UPDATED", "SYSTEM"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    // Store the full booking or relevant data
    data: {
      type: Schema.Types.Mixed, // Flexible - can store any JSON
      required: true,
    },
    // Link to the booking if applicable
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
      index: true, // For fast unread queries
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Index for common queries
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

const NotificationModel =
  mongoose.models.Notification ||
  mongoose.model("Notification", NotificationSchema);

export default NotificationModel;
