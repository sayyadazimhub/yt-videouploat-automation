import mongoose from "mongoose";

const AiVideoProjectSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            required: true,
        },
        user_id: {
            type: Number,
            default: null,
        },
        prompt: {
            type: String,
            required: true,
        },
        language: {
            type: String,
            required: true,
            default: "English",
        },
        duration: {
            type: Number,
            required: true,
            default: 60,
        },
        format: {
            type: String,
            required: true,
            default: "9:16",
        },
        story_json: {
            type: String,
            default: null,
        },
        status: {
            type: String,
            enum: [
                "PENDING",
                "GENERATING_STORY",
                "GENERATING_SCENES",
                "GENERATING_IMAGES",
                "GENERATING_AUDIO",
                "GENERATING_VIDEO",
                "COMPLETED",
                "FAILED"
            ],
            required: true,
            default: "PENDING",
        },
        progress: {
            type: Number,
            required: true,
            default: 0,
        },
        progress_label: {
            type: String,
            default: null,
        },
        video_path: {
            type: String,
            default: null,
        },
        error_message: {
            type: String,
            default: null,
        },
        youtube_video_id: {
            type: String,
            default: null,
        },
        youtube_url: {
            type: String,
            default: null,
        },
        youtube_status: {
            type: String,
            enum: [
                "NOT_STARTED",
                "AUTH_REQUIRED",
                "UPLOADING",
                "PROCESSING",
                "COMPLETED",
                "FAILED"
            ],
            default: "NOT_STARTED",
        },
        youtube_privacy_status: {
            type: String,
            default: "private",
        },
        youtube_title: {
            type: String,
            default: null,
        },
        youtube_description: {
            type: String,
            default: null,
        },
        youtube_uploaded_at: {
            type: Date,
            default: null,
        },
        auto_upload_youtube: {
            type: Boolean,
            default: false,
        }
    },
    {
        timestamps: true,
    }
);

AiVideoProjectSchema.virtual('id').get(function() {
    return this._id;
});

AiVideoProjectSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
    }
});

const AiVideoProject = mongoose.model("AiVideoProject", AiVideoProjectSchema);

export default AiVideoProject;
