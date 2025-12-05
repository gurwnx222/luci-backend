import fs from "fs";

export const cleanUploadedFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`Cleaned up temporary file: ${filePath}`);
    } catch (error) {
      console.warn(
        `Failed to delete temporary file: ${filePath}`,
        error.message
      );
    }
  }
};
