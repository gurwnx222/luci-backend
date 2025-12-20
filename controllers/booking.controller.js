import BookingSchemaModel from "../models/booking.model.js";
import notificationManager from "../utils/NotificationManager.js";
import mongoose from "mongoose";
import {
  emitBookingNotification,
  emitBookingStatusUpdate,
  emitChatRoomCreated,
} from "../utils/socketServer.js";
import {
  registerChatUser,
  createOrGetConversation,
  getChatUser,
} from "../utils/chatApiClient.js";

export const createBookingRequest = async (req, res) => {
  try {
    // the salon and owner id sent from luci-app
    const {
      salonId,
      salonOwnerId,
      firebaseUID,
      name,
      email,
      age,
      weightKg,
      requestedDateTime,
      durationMinutes,
    } = req.body;

    // Validation
    if (
      !salonId ||
      !salonOwnerId ||
      !firebaseUID ||
      !name ||
      !email ||
      !requestedDateTime
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    // 1. Create the booking
    const booking = await BookingSchemaModel.create({
      reciever: {
        salonId,
        salonOwnerID: salonOwnerId,
      },
      requester: {
        firebaseUID,
        name,
        email,
        bio: {
          age: age || 0,
          weightKg: weightKg || 0,
        },
      },
      appointmentDetails: {
        requestedDateTime: new Date(requestedDateTime),
        durationMinutes: durationMinutes || 60,
      },
      status: "pending",
    });

    // 2. Create notification payload
    const notification = {
      type: "NEW_BOOKING",
      title: "New Booking Request", // Add title
      message: `New booking request from ${name}`,
      booking: {
        id: booking._id,
        customerName: name,
        customerEmail: email,
        requestedDateTime: booking.appointmentDetails.requestedDateTime,
        durationMinutes: booking.appointmentDetails.durationMinutes,
        status: booking.status,
        customerBio: { age: age || 0, weightKg: weightKg || 0 },
      },
    };

    // 3. Send real-time notification via SSE
    await notificationManager.notify(salonOwnerId, notification);

    // 4. Emit SocketIO notification to salon owner (if online)
    emitBookingNotification(salonOwnerId, {
      type: "booking_request_received",
      booking: {
        id: booking._id.toString(),
        customerName: name,
        customerEmail: email,
        requestedDateTime: booking.appointmentDetails.requestedDateTime,
        durationMinutes: booking.appointmentDetails.durationMinutes,
        status: booking.status,
        customerBio: { age: age || 0, weightKg: weightKg || 0 },
      },
    });

    // 5. Return success response
    res.status(201).json({
      success: true,
      booking,
      message: "Booking request created successfully",
    });
  } catch (error) {
    console.error("Booking creation error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const patchBookingRequest = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, salonOwnerId } = req.body;
    
    // Validate status
    const validStatuses = [
      "pending",
      "accepted",
      "rejected",
      "cancelled",
      "no_show",
      "expired",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status",
      });
    }

    // Get booking before update to access requester info
    const oldBooking = await BookingSchemaModel.findById(bookingId);
    if (!oldBooking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found",
      });
    }

    // Update booking
    const booking = await BookingSchemaModel.findByIdAndUpdate(
      bookingId,
      { status },
      { new: true, runValidators: true }
    );

    // If booking is accepted, create chat room
    let conversation = null;
    if (status === "accepted") {
      try {
        // Register/get customer in chat system
        const customerChatUser = await getChatUser(oldBooking.requester.firebaseUID);
        let customerUserId = null;

        if (!customerChatUser) {
          // Register customer in chat system
          const newUser = await registerChatUser({
            firebaseUid: oldBooking.requester.firebaseUID,
            name: oldBooking.requester.name,
            email: oldBooking.requester.email,
            phone: "",
            avatar: "",
          });
          customerUserId = newUser._id || newUser.firebaseUid;
        } else {
          customerUserId = customerChatUser._id || customerChatUser.firebaseUid;
        }

        // Register/get salon owner in chat system
        const ownerChatUser = await getChatUser(salonOwnerId.toString());
        let ownerUserId = null;

        if (!ownerChatUser) {
          // You might want to fetch salon owner details from database
          // For now, using salonOwnerId as identifier
          const newOwner = await registerChatUser({
            name: "Salon Owner",
            email: `salon-${salonOwnerId}@example.com`,
            phone: "",
            avatar: "",
          });
          ownerUserId = newOwner._id;
        } else {
          ownerUserId = ownerChatUser._id || ownerChatUser.firebaseUid;
        }

        // Create conversation
        conversation = await createOrGetConversation(
          customerUserId,
          ownerUserId
        );

        // Emit chat room created notification to customer
        emitChatRoomCreated(oldBooking.requester.firebaseUID, {
          conversationId: conversation._id,
          bookingId: booking._id.toString(),
          salonOwnerId: salonOwnerId.toString(),
          salonOwnerName: "Salon Owner", // You might want to fetch this from DB
        });

        // Emit chat room created notification to salon owner
        emitChatRoomCreated(salonOwnerId.toString(), {
          conversationId: conversation._id,
          bookingId: booking._id.toString(),
          customerId: oldBooking.requester.firebaseUID,
          customerName: oldBooking.requester.name,
        });
      } catch (chatError) {
        console.error("Error creating chat room:", chatError);
        // Don't fail the booking update if chat creation fails
      }
    }

    // Emit booking status update to customer
    emitBookingStatusUpdate(oldBooking.requester.firebaseUID, {
      bookingId: booking._id.toString(),
      status: status,
      booking: {
        id: booking._id.toString(),
        status: status,
        requestedDateTime: booking.appointmentDetails.requestedDateTime,
        durationMinutes: booking.appointmentDetails.durationMinutes,
        salonOwnerId: salonOwnerId.toString(),
        salonOwnerName: booking.reciever?.salonName || "Salon Owner",
      },
      conversationId: conversation?._id || null,
      salonOwnerId: salonOwnerId.toString(),
      salonOwnerName: booking.reciever?.salonName || "Salon Owner",
    });

    // Send notification to salon owner via SSE
    // Use valid enum values: NEW_BOOKING, BOOKING_CANCELLED, BOOKING_UPDATED, SYSTEM
    await notificationManager.notify(salonOwnerId, {
      type: "BOOKING_UPDATED", // All status changes use BOOKING_UPDATED
      title: `Booking ${status}`,
      message: `Booking request ${status}`,
      booking: {
        id: booking._id.toString(),
        status: status,
      },
    });

    res.json({
      success: true,
      booking,
      conversation: conversation ? { id: conversation._id } : null,
      message: `Booking ${status} successfully`,
    });
  } catch (error) {
    console.error("Booking update error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getAllBookingsForSalon = async (req, res) => {
  try {
    // Support both query param and body for salonOwnerId
    const salonOwnerId = req.query.salonOwnerId || req.body.salonOwnerId;
    const { status, startDate, endDate } = req.query;

    console.log("📥 Fetching bookings for salonOwnerId:", salonOwnerId);

    if (!salonOwnerId) {
      return res.status(400).json({
        success: false,
        error: "salonOwnerId is required",
      });
    }

    // Convert to ObjectId if it's a valid MongoDB ObjectId string
    let ownerIdQuery = salonOwnerId;
    if (mongoose.Types.ObjectId.isValid(salonOwnerId)) {
      ownerIdQuery = new mongoose.Types.ObjectId(salonOwnerId);
    }

    // Build query - try both ObjectId and string to handle different data types
    const query = {
      $or: [
        { "reciever.salonOwnerID": ownerIdQuery },
        { "reciever.salonOwnerID": salonOwnerId },
      ],
    };

    if (status) {
      query.status = status;
    }
    if (startDate || endDate) {
      query["appointmentDetails.requestedDateTime"] = {};
      if (startDate) {
        query["appointmentDetails.requestedDateTime"].$gte = new Date(
          startDate
        );
      }
      if (endDate) {
        query["appointmentDetails.requestedDateTime"].$lte = new Date(endDate);
      }
    }

    console.log("🔍 Query:", JSON.stringify(query, null, 2));

    const bookings = await BookingSchemaModel.find(query)
      .populate("reciever.salonId", "name address")
      .sort({ "appointmentDetails.requestedDateTime": -1 });
    
    console.log(`✅ Found ${bookings.length} bookings for salon owner ${salonOwnerId}`);
    
    res.json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("❌ Error fetching bookings for the salon:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

export const getPendingBookings = async (req, res) => {
  try {
    const { salonOwnerId } = req.params;

    const count = await BookingSchemaModel.countDocuments({
      "reciever.salonOwnerID": salonOwnerId,
      status: "pending",
    });

    res.json({
      success: true,
      pendingCount: count,
    });
  } catch (error) {
    console.error("Count pending bookings error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get booking by ID
 */
export const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate that id is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid booking ID format",
      });
    }

    const booking = await BookingSchemaModel.findById(id)
      .populate("reciever.salonId", "name address")
      .populate("reciever.salonOwnerID", "name email");

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found",
      });
    }

    res.json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Accept booking (wrapper for patchBookingRequest)
 */
export const acceptBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { salonOwnerId } = req.body;

    // Use patchBookingRequest with status 'accepted'
    req.params.bookingId = id;
    req.body.status = "accepted";

    return await patchBookingRequest(req, res);
  } catch (error) {
    console.error("Error accepting booking:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Reject booking (wrapper for patchBookingRequest)
 */
export const rejectBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { salonOwnerId } = req.body;

    // Use patchBookingRequest with status 'rejected'
    req.params.bookingId = id;
    req.body.status = "rejected";

    return await patchBookingRequest(req, res);
  } catch (error) {
    console.error("Error rejecting booking:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
