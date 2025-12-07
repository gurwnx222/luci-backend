// controllers/subscription.controller.js

import Stripe from "stripe";
import {
  SubscriptionSchemaModel,
  UserProfileSchemaModel,
  SalonProfileSchemaModel,
} from "../models/index.js";

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a new subscription with Stripe
 */
export const createSubscription = async (req, res) => {
  try {
    const {
      ownerEmail,
      ownerName,
      planType,
      billingCycle,
      paymentMethodId, // Stripe payment method ID from frontend
    } = req.body;

    // ===== VALIDATION =====

    if (!ownerEmail || !ownerName) {
      return res.status(400).json({
        success: false,
        message: "Owner email and name are required",
      });
    }

    if (
      !planType ||
      !["Free", "Basic", "Standard", "Premium"].includes(planType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid plan type is required (Free, Basic, Standard, Premium)",
      });
    }

    if (!billingCycle || !["Monthly", "Yearly"].includes(billingCycle)) {
      return res.status(400).json({
        success: false,
        message: "Valid billing cycle is required (Monthly, Yearly)",
      });
    }

    // For paid plans, payment method is required
    if (planType !== "Free" && !paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required for paid plans",
      });
    }

    // ===== FIND SALON OWNER =====

    const salonOwner = await UserProfileSchemaModel.findOne({
      email: ownerEmail.toLowerCase().trim(),
      name: ownerName.trim(),
    });

    if (!salonOwner) {
      return res.status(404).json({
        success: false,
        message: "Salon owner not found with the provided email and name",
      });
    }

    // Check if owner already has an active subscription
    if (salonOwner.subscriptionId) {
      const existingSubscription = await SubscriptionSchemaModel.findById(
        salonOwner.subscriptionId
      );
      if (existingSubscription && existingSubscription.status === "Active") {
        return res.status(400).json({
          success: false,
          message:
            "You already have an active subscription. Please cancel it first or upgrade.",
          existingSubscription,
        });
      }
    }

    // ===== PRICING LOGIC =====

    const pricing = {
      Free: { Monthly: 0, Yearly: 0 },
      Basic: { Monthly: 3, Yearly: 32 },
    };

    const amount = pricing[planType][billingCycle];

    // ===== STRIPE INTEGRATION =====

    let stripeCustomerId = salonOwner.stripeCustomerId;
    let stripeSubscriptionId = null;

    // For paid plans, create Stripe subscription
    if (planType !== "Free") {
      try {
        // Create or retrieve Stripe customer
        if (!stripeCustomerId) {
          const customer = await stripe.customers.create({
            email: ownerEmail,
            name: ownerName,
            payment_method: paymentMethodId,
            invoice_settings: {
              default_payment_method: paymentMethodId,
            },
            metadata: {
              salonOwnerId: salonOwner._id.toString(),
            },
          });
          stripeCustomerId = customer.id;
          salonOwner.stripeCustomerId = stripeCustomerId;
        } else {
          // Attach payment method to existing customer
          await stripe.paymentMethods.attach(paymentMethodId, {
            customer: stripeCustomerId,
          });
          await stripe.customers.update(stripeCustomerId, {
            invoice_settings: {
              default_payment_method: paymentMethodId,
            },
          });
        }

        // Create Stripe subscription
        const stripeSubscription = await stripe.subscriptions.create({
          customer: stripeCustomerId,
          items: [
            {
              price_data: {
                currency: "inr",
                product_data: {
                  name: `${planType} Plan - ${billingCycle}`,
                  description: `Salon management ${planType.toLowerCase()} subscription`,
                },
                unit_amount: amount * 100, // Convert to paise (smallest currency unit)
                recurring: {
                  interval: billingCycle === "Monthly" ? "month" : "year",
                },
              },
            },
          ],
          payment_settings: {
            payment_method_types: ["card"],
          },
          metadata: {
            salonOwnerId: salonOwner._id.toString(),
            planType,
            billingCycle,
          },
        });

        stripeSubscriptionId = stripeSubscription.id;
      } catch (stripeError) {
        console.error("Stripe error:", stripeError);
        return res.status(500).json({
          success: false,
          message: "Failed to create Stripe subscription",
          error:
            process.env.NODE_ENV === "development"
              ? stripeError.message
              : undefined,
        });
      }
    }

    // ===== CALCULATE NEXT BILLING DATE =====

    const currentDate = new Date();
    const nextBillingDate = new Date(currentDate);

    if (billingCycle === "Monthly") {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    } else {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    }

    // ===== CREATE SUBSCRIPTION IN DATABASE =====

    const newSubscription = new SubscriptionSchemaModel({
      salonID: salonOwner.salonProfileId || null,
      planType,
      billingCycle,
      nextBillingDate: nextBillingDate.toISOString(),
      amount: amount.toString(),
      autoRenewal: planType !== "Free",
      status: "Active",
      stripeSubscriptionId, // Store Stripe subscription ID
    });

    const savedSubscription = await newSubscription.save();

    // ===== UPDATE SALON OWNER WITH SUBSCRIPTION ID =====

    salonOwner.subscriptionId = savedSubscription._id;
    await salonOwner.save();

    // Update salon profile if exists
    if (salonOwner.salonProfileId) {
      await SalonProfileSchemaModel.findByIdAndUpdate(
        salonOwner.salonProfileId,
        { subscriptionID: savedSubscription._id }
      );
    }

    console.log("Subscription created successfully:", {
      subscriptionId: savedSubscription._id,
      ownerId: salonOwner._id,
      planType,
      stripeSubscriptionId,
    });

    return res.status(201).json({
      success: true,
      message: "Subscription created successfully",
      data: {
        subscription: savedSubscription,
        ownerId: salonOwner._id,
        stripeCustomerId,
      },
    });
  } catch (error) {
    console.error("Error creating subscription:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating subscription",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get subscription details
 */
export const getSubscription = async (req, res) => {
  try {
    const { ownerEmail, ownerName } = req.query;

    if (!ownerEmail || !ownerName) {
      return res.status(400).json({
        success: false,
        message: "Owner email and name are required",
      });
    }

    const salonOwner = await UserProfileSchemaModel.findOne({
      email: ownerEmail.toLowerCase().trim(),
      name: ownerName.trim(),
    }).populate("subscriptionId");

    if (!salonOwner) {
      return res.status(404).json({
        success: false,
        message: "Salon owner not found",
      });
    }

    if (!salonOwner.subscriptionId) {
      return res.status(404).json({
        success: false,
        message: "No subscription found for this owner",
      });
    }

    return res.status(200).json({
      success: true,
      data: salonOwner.subscriptionId,
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching subscription details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (req, res) => {
  try {
    const { ownerEmail, ownerName } = req.body;

    if (!ownerEmail || !ownerName) {
      return res.status(400).json({
        success: false,
        message: "Owner email and name are required",
      });
    }

    const salonOwner = await UserProfileSchemaModel.findOne({
      email: ownerEmail.toLowerCase().trim(),
      name: ownerName.trim(),
    });

    if (!salonOwner || !salonOwner.subscriptionId) {
      return res.status(404).json({
        success: false,
        message: "No active subscription found",
      });
    }

    const subscription = await SubscriptionSchemaModel.findById(
      salonOwner.subscriptionId
    );

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    // Cancel Stripe subscription if exists
    if (subscription.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      } catch (stripeError) {
        console.error("Stripe cancellation error:", stripeError);
        // Continue even if Stripe cancellation fails
      }
    }

    // Update subscription status
    subscription.status = "Cancelled";
    subscription.autoRenewal = false;
    await subscription.save();

    return res.status(200).json({
      success: true,
      message: "Subscription cancelled successfully",
      data: subscription,
    });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    return res.status(500).json({
      success: false,
      message: "Error cancelling subscription",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update subscription (upgrade/downgrade)
 */
export const updateSubscription = async (req, res) => {
  try {
    const { ownerEmail, ownerName, newPlanType, newBillingCycle } = req.body;

    if (!ownerEmail || !ownerName) {
      return res.status(400).json({
        success: false,
        message: "Owner email and name are required",
      });
    }

    if (
      !newPlanType ||
      !["Free", "Basic", "Standard", "Premium"].includes(newPlanType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid plan type is required",
      });
    }

    const salonOwner = await UserProfileSchemaModel.findOne({
      email: ownerEmail.toLowerCase().trim(),
      name: ownerName.trim(),
    });

    if (!salonOwner || !salonOwner.subscriptionId) {
      return res.status(404).json({
        success: false,
        message: "No active subscription found",
      });
    }

    const subscription = await SubscriptionSchemaModel.findById(
      salonOwner.subscriptionId
    );

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    // Update pricing
    const pricing = {
      Free: { Monthly: 0, Yearly: 0 },
      Basic: { Monthly: 3, Yearly: 32 },
    };

    const billingCycle = newBillingCycle || subscription.billingCycle;
    const newAmount = pricing[newPlanType][billingCycle];

    // Update Stripe subscription if exists
    if (subscription.stripeSubscriptionId && newPlanType !== "Free") {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId
        );

        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          items: [
            {
              id: stripeSubscription.items.data[0].id,
              price_data: {
                currency: "inr",
                product_data: {
                  name: `${newPlanType} Plan - ${billingCycle}`,
                },
                unit_amount: newAmount * 100,
                recurring: {
                  interval: billingCycle === "Monthly" ? "month" : "year",
                },
              },
            },
          ],
          proration_behavior: "create_prorations",
        });
      } catch (stripeError) {
        console.error("Stripe update error:", stripeError);
        return res.status(500).json({
          success: false,
          message: "Failed to update Stripe subscription",
          error:
            process.env.NODE_ENV === "development"
              ? stripeError.message
              : undefined,
        });
      }
    }

    // Update subscription in database
    subscription.planType = newPlanType;
    subscription.billingCycle = billingCycle;
    subscription.amount = newAmount.toString();
    await subscription.save();

    return res.status(200).json({
      success: true,
      message: "Subscription updated successfully",
      data: subscription,
    });
  } catch (error) {
    console.error("Error updating subscription:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating subscription",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Stripe webhook handler
 */
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        const subscription = event.data.object;
        await handleSubscriptionUpdate(subscription);
        break;

      case "invoice.payment_succeeded":
        const invoice = event.data.object;
        await handleSuccessfulPayment(invoice);
        break;

      case "invoice.payment_failed":
        const failedInvoice = event.data.object;
        await handleFailedPayment(failedInvoice);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
};

// Helper functions for webhook

async function handleSubscriptionUpdate(stripeSubscription) {
  const subscription = await SubscriptionSchemaModel.findOne({
    stripeSubscriptionId: stripeSubscription.id,
  });

  if (subscription) {
    subscription.status =
      stripeSubscription.status === "active" ? "Active" : "Inactive";
    await subscription.save();
  }
}

async function handleSuccessfulPayment(invoice) {
  const subscription = await SubscriptionSchemaModel.findOne({
    stripeSubscriptionId: invoice.subscription,
  });

  if (subscription) {
    subscription.status = "Active";
    const nextBilling = new Date(invoice.period_end * 1000);
    subscription.nextBillingDate = nextBilling.toISOString();
    await subscription.save();
  }
}

async function handleFailedPayment(invoice) {
  const subscription = await SubscriptionSchemaModel.findOne({
    stripeSubscriptionId: invoice.subscription,
  });

  if (subscription) {
    subscription.status = "Inactive";
    await subscription.save();
  }
}
