import {
  createBookingRequest,
  patchBookingRequest,
  getAllBookingsForSalon,
  getPendingBookings,
} from "../controllers/booking.controller.js";
import { Router } from "express";
const router = Router();

router.post("/create-booking", createBookingRequest);
router.post("/patch-booking/:bookingId", patchBookingRequest);
router.get("/fetch-salon-bookings", getAllBookingsForSalon);
router.post("/fetch-pending-bookings", getPendingBookings);

export default router;
