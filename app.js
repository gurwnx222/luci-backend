import express from "express";
import cors from "cors";
import salonOwnerRoutes from "./routes/register.route.js";
import createSalonProfile from "./routes/salon.profile.route.js";
import bookingRoutes from "./routes/booking.route.js";
import notificationRoutes from "./routes/notification.route.js";
import recommendationRoutes from "./routes/recommendation.route.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// CORS configuration - must be before other middleware
const corsOptions = {
  origin: "*", // Allow all origins (you can restrict this in production)
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
  credentials: false, // Set to true if you need to send cookies
  preflightContinue: false,
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

// Explicit OPTIONS handler as fallback (before routes)
app.options("*", cors(corsOptions), (req, res) => {
  res.status(200).end();
});

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
// main route
app.use("/api/v1", salonOwnerRoutes);
// Salon profile routes are available under both /register and /salons for backward compatibility
app.use("/api/v1/register", createSalonProfile);
app.use("/api/v1/salons", createSalonProfile);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/recommendations", recommendationRoutes);
app.get("/", (req, res) => {
  res.json({
    message: "Express server is running!",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

export default app;
