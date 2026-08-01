/**
 * Processes and enriches scene data objects
 */

/**
 * Build scene objects with computed metadata
 * @param {Array} scenes - Raw scenes from Gemini
 * @param {string} style - Story style
 * @returns {Array} Enriched scene objects
 */
export const buildScenes = (scenes, style) => {
    return scenes.map((scene, index) => ({
        ...scene,
        sceneNumber: scene.sceneNumber || index + 1,
        duration: scene.duration || 10,
        narration: scene.narration || "",
        dialogue: scene.dialogue || [],
        visualPrompt: enrichVisualPrompt(scene.visualPrompt || "", style),
        cameraMovement: scene.cameraMovement || getDefaultCameraMove(index),
        mood: scene.mood || "Dramatic",
        soundEffects: scene.soundEffects || [],
        musicMood: scene.musicMood || "Dramatic",
        cinematicEffect: getCinematicEffect(index),
    }));
};

/**
 * Enrich visual prompt with cinematic quality tags
 */
const enrichVisualPrompt = (prompt, style) => {
    const styleTag =
        style === "Anime"
            ? "anime style, detailed illustration"
            : style === "Documentary"
            ? "documentary style, realistic photography"
            : "cinematic film still, photorealistic, dramatic lighting";

    if (prompt.toLowerCase().includes("cinematic")) return prompt;
    return `${prompt}, ${styleTag}, 4K, high quality, detailed`;
};

/**
 * Get a cinematic effect for each scene based on position
 */
export const getCinematicEffect = (index) => {
    const effects = [
        "zoom_in",
        "zoom_out",
        "pan_right",
        "pan_left",
        "ken_burns",
        "zoom_in",
        "zoom_out",
        "pan_right",
    ];
    return effects[index % effects.length];
};

/**
 * Get default camera movement for a scene
 */
const getDefaultCameraMove = (index) => {
    const moves = [
        "Slow tracking shot",
        "Static wide shot",
        "Handheld close-up",
        "Dolly push in",
        "Pan left to right",
        "Overhead aerial shot",
        "Low angle looking up",
        "Dutch angle",
    ];
    return moves[index % moves.length];
};

/**
 * Get total duration of all scenes in seconds
 */
export const getTotalDuration = (scenes) =>
    scenes.reduce((sum, s) => sum + (s.duration || 10), 0);
