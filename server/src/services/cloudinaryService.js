import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a local file to Cloudinary and returns the secure URL.
 * @param {string} localFilePath - The absolute path to the local file to upload
 * @param {string} folderName - The destination folder in Cloudinary
 * @returns {Promise<string>} - The secure URL of the uploaded file
 */
export const uploadToCloudinary = async (localFilePath, folderName) => {
    try {
        const result = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "video",
            folder: folderName,
        });
        return result.secure_url;
    } catch (error) {
        console.error("❌ Failed to upload to Cloudinary:", error);
        throw error;
    }
};
