import { request } from "express";
import { mongoose, Schema } from "mongoose";

const BookingSchema = new Schema(
  {
    reciever: {
      salonId: {
        type: Schema.Types.ObjectId,
        ref: "Salon Profile",
        required: true,
      },
      salonOwnerID: {
        type: Schema.Types.ObjectId,
        ref: "Salon Owner Profile",
        required: true,
      },
    },
    requester: {
      firebaseUID: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
      bio: {
        age: {
          type: Number,
          required: true,
        },
        weightKg: {
          type: Number,
          required: true,
        },
      },
    },
    appointmentDetails: {
      //Time and date of the appointment requested by the user
      requestedDateTime: {
        type: Date,
        required: true,
      },
      durationMinutes: {
        type: Number,
        default: 60,
        required: true,
      },
    },
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "rejected",
        "cancelled",
        "no_show",
        "expired",
      ],
      default: "pending",
      required: true,
    },
  },
  { timestamps: true }
);

const BookingSchemaModel = mongoose.model("Booking", BookingSchema);

export default BookingSchemaModel;
