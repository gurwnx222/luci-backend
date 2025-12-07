import BookingSchemaModel from "../models/booking.model.js";
import notificationManager from "../utils/NotificationManager.js";

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

    // 4. Return success response
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

    // Update booking
    const booking = await BookingSchemaModel.findByIdAndUpdate(
      bookingId,
      { status },
      { new: true, runValidators: true }
    );
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found",
      });
    }
    // Optionally: Send notification back to customer about status change
    // This would require a similar notification system for mobile app users

    res.json({
      success: true,
      booking,
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
    const { salonOwnerId } = req.body;
    const { status, startDate, endDate } = req.query;

    // Build query
    const query = { "reciever.salonOwnerID": salonOwnerId };

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

    const bookings = await BookingSchemaModel.find(query)
      .populate("reciever.salonId", "name address")
      .sort({ "appointmentDetails.requestedDateTime": -1 });
    res.json({
      success: true,
      count: bookings.length,
      bookings,
    });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } catch (error) {
    console.error("Error fetching bookings for the salon: ", error);
    res.status(500).json({
      success: false,
      error: error.message,
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
