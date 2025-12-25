import { request } from "express";
import { mongoose, Schema } from "mongoose";

const BookingSchema = new Schema(
  {
    reciever: {
      salonId: {
        type: Schema.Types.ObjectId,
        ref: "Salon Profile",
        required: false, // Made optional to support private massagers
      },
      privateMassagerId: {
        type: Schema.Types.ObjectId,
        ref: "Private Massager",
        required: false, // Optional - either salonId or privateMassagerId must be provided
      },
      salonOwnerID: {
        type: Schema.Types.ObjectId,
        ref: "Salon Owner Profile",
        required: true, // Owner ID is always required (works for both salon and private massager)
      },
      providerType: {
        type: String,
        enum: ["salon", "privateMassager"],
        required: false, // Will be auto-determined if not provided
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

// Pre-save hook to automatically set providerType based on which ID is provided
BookingSchema.pre("save", function (next) {
  if (!this.reciever.providerType) {
    if (this.reciever.salonId) {
      this.reciever.providerType = "salon";
    } else if (this.reciever.privateMassagerId) {
      this.reciever.providerType = "privateMassager";
    }
  }
  next();
});

// Validation: Either salonId or privateMassagerId must be provided
BookingSchema.pre("validate", function (next) {
  if (!this.reciever.salonId && !this.reciever.privateMassagerId) {
    next(new Error("Either salonId or privateMassagerId must be provided"));
  } else {
    next();
  }
});

const BookingSchemaModel = mongoose.model("Booking", BookingSchema);

export default BookingSchemaModel;
