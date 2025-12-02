import { mongoose, Schema } from "mongoose";

const NotificationSchema = new Schema(
  {
    //mongo db id of the user to whom the notification is sent
    userID: {
      type: Schema.Types.ObjectId,
      ref: "Salon Owner Profile",
      required: true,
    },
    type: {
      type: String,
      enum: ["booking_request", "booking_update", "system"],
      required: true,
    },
    payload: { type: Schema.Types.Mixed }, // e.g. { bookingId, requesterName, snippet }
    read: { type: Boolean, default: false, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

const NotificationSchemaModel = mongoose.model(
  "Notification",
  NotificationSchema
);

export default NotificationSchemaModel;
