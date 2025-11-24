import ImageKit from "imagekit";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const UploadOnImageKit = async (localFilePath, fileBuffer, originalname) => {
  try {
    if (!fileBuffer && !localFilePath) return null;

    let fileInput;
    if (fileBuffer) {
      // Use buffer if available (memory storage)
      fileInput = fileBuffer;
    } else {
      // Use file path (disk storage)
      fileInput = fs.readFileSync(localFilePath);
    }

    const response = await imagekit.upload({
      file: fileInput,
      fileName: originalname || path.basename(localFilePath),
      folder: "/pdfs",
    });

    console.log("Upload Success:", response);

    // Clean up local file if it exists
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return response;
  } catch (error) {
    console.error("Upload Error:", error);

    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return null;
  }
};

export { UploadOnImageKit };
