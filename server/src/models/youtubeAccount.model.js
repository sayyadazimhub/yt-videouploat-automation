import mongoose from "mongoose";

const YoutubeAccountSchema = new mongoose.Schema(
    {
        user_id: {
            type: Number,
            default: null,
        },
        channel_id: {
            type: String,
            required: true,
        },
        channel_title: {
            type: String,
            required: true,
        },
        refresh_token: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

const YoutubeAccount = mongoose.model("YoutubeAccount", YoutubeAccountSchema);

export default YoutubeAccount;
