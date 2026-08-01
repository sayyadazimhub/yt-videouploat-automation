import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: process.env.DB_DIALECT,
        logging: false,
    }
);

export const dbconnected = async () => {
    try {
        await sequelize.authenticate();
        console.log("✅ Database connection established successfully.");
        await sequelize.sync({ alter: true });
        console.log("✅ Database synchronized.");
    } catch (error) {
        console.error("❌ Unable to connect to the database:", error.message);
        console.error("   Make sure MySQL is running and DB credentials in .env are correct.");
    }
};

export default sequelize;
