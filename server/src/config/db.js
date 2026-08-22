import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export const dbconnected = async () => {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) {
            throw new Error("MONGO_URI is not defined in .env");
        }
        await mongoose.connect(uri);
        console.log("✅ MongoDB connection established successfully.");
    } catch (error) {
        console.error("❌ Unable to connect to the database:", error.message);
        console.error("   Make sure MongoDB is running and MONGO_URI in .env is correct.");
    }
};

export default mongoose;
