import { mongoose, Schema } from "mongoose";

const SubscriptionSchema = new Schema(
  {
    salonID: {
      type: Schema.Types.ObjectId,
      ref: "Salon Profile",
    },
    planType: {
      type: String,
      enum: ["Free", "Basic", "Standard", "Premium"],
      required: true,
    },
    billingCycle: {
      type: String,
      enum: ["Monthly", "Yearly"],
      required: true,
    },
    nextBillingDate: {
      type: String,
      required: true,
    },
    amount: {
      type: String,
      required: true,
    },
    autoRenewal: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Cancelled", "Expired"],
      required: true,
    },
  },
  { timestamps: true }
);

const SubscriptionSchemaModel = mongoose.model(
  "Subscription",
  SubscriptionSchema
);

export default SubscriptionSchemaModel;
