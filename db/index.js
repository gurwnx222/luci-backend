import mongoose from "mongoose";
import dotenv from "dotenv";
// Configure dotenv to look for .env file in parent directory (root)
dotenv.config({
  path: "../.env",
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    // Add some debugging to see if env variable is loaded
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI environment variable is not defined");
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1);
  }
};
export default connectDB;
