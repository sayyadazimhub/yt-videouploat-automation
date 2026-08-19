import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const YoutubeAccount = sequelize.define(
    "YoutubeAccount",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        channel_id: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        channel_title: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        refresh_token: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
    },
    {
        tableName: "youtube_accounts",
        timestamps: true,
    }
);

export default YoutubeAccount;
