import app from "./app.js";
import connectDB from "./db/index.js";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 3000;
connectDB()
  .then(() => {
    app.on("error", (error) => console.log("Error: ", error));
    console.log("Connected to MongoDB!");
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Test endpoint: http://localhost:${PORT}/api/test`);
    });
  })
  .catch((error) =>
    console.error("Error connecting to MongoDB:", {
      error: error,
    })
  );
