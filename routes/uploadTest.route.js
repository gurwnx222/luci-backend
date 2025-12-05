import { upload, handleMulterError } from "../middlewares/mutler.middleware.js";
import { Router } from "express";
import { UploadOnImageKit } from "../utils/ImageKit.js";
import fs from "fs";

const router = Router();

// Helper function to clean up files
const cleanUploadedFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log("Temporary file deleted:", filePath);
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  }
};

router.post(
  "/test/upload-file",
  upload,
  handleMulterError,
  async (req, res) => {
    // FIXED: req.file itself is the uploaded file object
    const uploadedFile = req?.file;
    const uploadedFilePath = req.file?.path;

    // Check if file was uploaded
    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid image file!!",
      });
    }

    console.log("File received:", {
      filename: uploadedFile.filename,
      mimetype: uploadedFile.mimetype,
      size: uploadedFile.size,
      path: uploadedFilePath,
    });

    let imageKitResponse;
    try {
      console.log("Uploading image to ImageKit:", uploadedFilePath);
      imageKitResponse = await UploadOnImageKit(uploadedFilePath);
      console.log("ImageKit upload successful:", imageKitResponse.url);

      return res.status(200).json({
        success: true,
        message: "Image uploaded successfully",
        data: {
          url: imageKitResponse.url,
          fileId: imageKitResponse.fileId,
          name: imageKitResponse.name,
        },
      });
    } catch (uploadError) {
      console.error("ImageKit upload failed:", uploadError);
      return res.status(500).json({
        success: false,
        message: "Failed to upload image to storage",
        error:
          process.env.NODE_ENV === "development"
            ? uploadError.message
            : undefined,
      });
    } finally {
      // Always clean up the temporary file after ImageKit upload attempt
      cleanUploadedFile(uploadedFilePath);
    }
  }
);

export default router;
