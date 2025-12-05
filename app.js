import express from "express";
import salonOwnerRouter from "./routes/register.route.js";
import createSalonProfile from "./routes/salon.profile.route.js";
import uploadTest from "./routes/uploadTest.route.js";
const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// main route
app.use("/api/v1", salonOwnerRouter);
//app.use("/api/v1", createSalonProfile);
app.use("/api/v1", uploadTest);
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
