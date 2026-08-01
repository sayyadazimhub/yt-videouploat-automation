import {
    getStoryPath,
    getScenePaths,
    saveJson,
    createProjectStructure,
} from "./fileService.js";

/**
 * Saves the complete story JSON and individual scene JSON files
 * @param {string} projectId
 * @param {Object} storyData - Validated story JSON from Gemini
 */
export const saveStoryFiles = (projectId, storyData) => {
    createProjectStructure(projectId);

    // Save main story.json
    const storyPath = getStoryPath(projectId);
    saveJson(storyPath, storyData);
    console.log(`💾 Saved story.json for project ${projectId}`);

    // Save individual scene JSON files
    storyData.scenes.forEach((scene) => {
        const paths = getScenePaths(projectId, scene.sceneNumber);
        saveJson(paths.json, scene);
    });

    console.log(`💾 Saved ${storyData.scenes.length} scene JSON files`);
    return storyPath;
};

/**
 * Normalizes scene durations so they sum to the target total
 * @param {Array} scenes
 * @param {number} targetDuration - in seconds
 * @returns {Array} scenes with corrected durations
 */
export const normalizeDurations = (scenes, targetDuration) => {
    const totalCurrent = scenes.reduce((sum, s) => sum + (s.duration || 10), 0);

    if (totalCurrent === 0) {
        const perScene = Math.floor(targetDuration / scenes.length);
        return scenes.map((s, i) => ({
            ...s,
            duration:
                i === scenes.length - 1
                    ? targetDuration - perScene * (scenes.length - 1)
                    : perScene,
        }));
    }

    const ratio = targetDuration / totalCurrent;
    const adjusted = scenes.map((s) => ({
        ...s,
        duration: Math.max(5, Math.round((s.duration || 10) * ratio)),
    }));

    // Fix rounding error on last scene
    const adjustedTotal = adjusted.reduce((sum, s) => sum + s.duration, 0);
    const diff = targetDuration - adjustedTotal;
    adjusted[adjusted.length - 1].duration = Math.max(
        5,
        adjusted[adjusted.length - 1].duration + diff
    );

    return adjusted;
};
