import { Router } from "express";
import {
    authController,
    callbackController,
    getStatusController,
    disconnectController,
    generateMetadataController,
    uploadController,
    getUploadStatusController
} from "../controller/youtube.controller.js";

const router = Router();

router.get("/youtube/auth", authController);
router.get("/youtube/callback", callbackController);
router.get("/youtube/status", getStatusController);
router.post("/youtube/disconnect", disconnectController);
router.post("/youtube/metadata", generateMetadataController);
router.post("/youtube/upload", uploadController);
router.get("/youtube/upload-status/:projectId", getUploadStatusController);

export default router;
