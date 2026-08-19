import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const AiVideoProject = sequelize.define(
    "AiVideoProject",
    {
        id: {
            type: DataTypes.STRING(36),
            primaryKey: true,
            allowNull: false,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        prompt: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        style: {
            type: DataTypes.STRING(100),
            allowNull: true,
            defaultValue: "Cinematic",
        },
        mood: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        language: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: "English",
        },
        duration: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 60,
        },
        format: {
            type: DataTypes.STRING(10),
            allowNull: false,
            defaultValue: "9:16",
        },
        story_json: {
            type: DataTypes.TEXT("long"),
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM(
                "PENDING",
                "GENERATING_STORY",
                "GENERATING_SCENES",
                "GENERATING_IMAGES",
                "GENERATING_AUDIO",
                "GENERATING_VIDEO",
                "COMPLETED",
                "FAILED"
            ),
            allowNull: false,
            defaultValue: "PENDING",
        },
        progress: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        progress_label: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        video_path: {
            type: DataTypes.STRING(500),
            allowNull: true,
        },
        error_message: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        youtube_video_id: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        youtube_url: {
            type: DataTypes.STRING(500),
            allowNull: true,
        },
        youtube_status: {
            type: DataTypes.ENUM(
                "NOT_STARTED",
                "AUTH_REQUIRED",
                "UPLOADING",
                "PROCESSING",
                "COMPLETED",
                "FAILED"
            ),
            allowNull: true,
            defaultValue: "NOT_STARTED",
        },
        youtube_privacy_status: {
            type: DataTypes.STRING(50),
            allowNull: true,
            defaultValue: "private",
        },
        youtube_title: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        youtube_description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        youtube_uploaded_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        tableName: "ai_video_projects",
        timestamps: true,
    }
);

export default AiVideoProject;
