import app from "./app.js";
import connectDB from "./db/index.js";
import dotenv from "dotenv";
import { initializeSocketServer, getHttpServer } from "./utils/socketServer.js";

dotenv.config();

const PORT = process.env.PORT || 3000;
connectDB()
  .then(() => {
    app.on("error", (error) => console.log("Error: ", error));
    console.log("Connected to MongoDB!");
    
    // Initialize SocketIO server
    const { httpServer } = initializeSocketServer(app);
    
    // Start HTTP server (with SocketIO)
    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Test endpoint: http://localhost:${PORT}/api/test`);
      console.log(`SocketIO server initialized on port ${PORT}`);
    });
  })
  .catch((error) =>
    console.error("Error connecting to MongoDB:", {
      error: error,
    })
  );
