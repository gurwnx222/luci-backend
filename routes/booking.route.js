import {
  createBookingRequest,
  patchBookingRequest,
  getAllBookingsForSalon,
  getPendingBookings,
  getBookingById,
  acceptBooking,
  rejectBooking,
} from "../controllers/booking.controller.js";
import { Router } from "express";
const router = Router();

// New API endpoints (matching requirements)
// IMPORTANT: Specific routes (like /list) must come BEFORE parameterized routes (like /:id)
// Otherwise Express will match /list as /:id with id="list"
router.post("/request", createBookingRequest);
router.get("/list", getAllBookingsForSalon);
router.get("/:id", getBookingById);
router.put("/:id/accept", acceptBooking);
router.put("/:id/reject", rejectBooking);

// Legacy endpoints (for backward compatibility)
router.post("/create-booking", createBookingRequest);
router.post("/patch-booking/:bookingId", patchBookingRequest);
router.get("/fetch-salon-bookings", getAllBookingsForSalon);
router.post("/fetch-pending-bookings", getPendingBookings);

export default router;
