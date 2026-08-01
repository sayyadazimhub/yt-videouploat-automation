import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const MAX_RETRIES = 3;

const getClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_gemini_api_key_here") {
        throw new Error(
            "GEMINI_API_KEY is not set in .env. Get a free key at https://aistudio.google.com"
        );
    }
    return new GoogleGenerativeAI(apiKey);
};

const SYSTEM_INSTRUCTION = `You are a professional cinematic screenwriter and video director AI.
Your task is to generate a complete, structured cinematic story in valid JSON format ONLY.
Do NOT include any markdown, code fences, explanations, or extra text — return ONLY the raw JSON object.
The JSON must be parseable by JSON.parse() without any pre-processing.
Every scene must have realistic duration values that sum to approximately the total requested duration.
Visual prompts must be highly detailed and cinematic for image generation (mention lighting, camera angle, color palette, atmosphere).`;

const buildUserPrompt = (prompt, style, mood, language, duration) => {
    const moodList = Array.isArray(mood) ? mood.join(", ") : mood;
    return `Create a cinematic story with the following specifications:

Story Idea: ${prompt}
Style: ${style}
Mood(s): ${moodList}
Language: ${language}
Total Duration: ${duration} seconds
Number of Scenes: ${Math.max(3, Math.ceil(duration / 20))}

Return ONLY this exact JSON structure (no markdown, no code fences):
{
  "title": "Story Title Here",
  "description": "A 2-3 sentence story description",
  "language": "${language}",
  "duration": ${duration},
  "style": "${style}",
  "mood": "${moodList}",
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": 15,
      "narration": "Full narration text for this scene spoken by narrator",
      "dialogue": [
        { "character": "Character Name", "text": "Dialogue line here" }
      ],
      "visualPrompt": "Highly detailed cinematic scene description: setting, lighting, colors, camera angle, atmosphere, style. Suitable for image generation. Realistic, cinematic film still.",
      "cameraMovement": "Slow dolly push in",
      "mood": "Suspense",
      "soundEffects": ["Rain pattering", "Distant thunder"],
      "musicMood": "Dark suspense"
    }
  ]
}

IMPORTANT:
- All scene durations must add up to exactly ${duration} seconds
- Narration must be in ${language}
- Visual prompts must be in English regardless of story language
- Make the story compelling, dramatic, and cinematic
- Return ONLY the JSON — nothing else`;
};

/** Extract and parse JSON from Gemini response text */
const extractJson = (text) => {
    // Try direct parse first
    try {
        return JSON.parse(text.trim());
    } catch (_) {}

    // Try extracting from code fences
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
        try {
            return JSON.parse(fenceMatch[1].trim());
        } catch (_) {}
    }

    // Try finding first { to last }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
        try {
            return JSON.parse(text.substring(start, end + 1));
        } catch (_) {}
    }

    throw new Error("Could not extract valid JSON from Gemini response");
};

/** Validate the story JSON structure */
const validateStoryJson = (data) => {
    if (!data || typeof data !== "object") throw new Error("Response is not an object");
    if (!data.title) throw new Error("Missing required field: title");
    if (!data.scenes || !Array.isArray(data.scenes)) throw new Error("Missing or invalid scenes array");
    if (data.scenes.length === 0) throw new Error("Scenes array is empty");

    data.scenes.forEach((scene, i) => {
        if (typeof scene.sceneNumber === "undefined") throw new Error(`Scene ${i + 1}: missing sceneNumber`);
        if (!scene.narration) throw new Error(`Scene ${i + 1}: missing narration`);
        if (!scene.visualPrompt) throw new Error(`Scene ${i + 1}: missing visualPrompt`);
        if (!scene.duration) scene.duration = 10; // default fallback
    });

    return true;
};

/**
 * Fallback story generator when Gemini API is rate-limited, quota-exceeded, or offline.
 */
const generateFallbackStory = (prompt, style, mood, language, duration) => {
    const numScenes = Math.max(3, Math.ceil(duration / 20));
    const sceneDuration = Math.round(duration / numScenes);
    const moodList = Array.isArray(mood) ? mood.join(", ") : mood;

    const title = prompt.length > 40 ? `${prompt.substring(0, 37)}...` : prompt;

    const scenes = Array.from({ length: numScenes }, (_, i) => {
        const isFirst = i === 0;
        const isLast = i === numScenes - 1;
        const currentDur = isLast ? duration - (sceneDuration * (numScenes - 1)) : sceneDuration;

        let narration = "";
        if (isFirst) {
            narration = `The story opens with ${prompt.toLowerCase()}. An atmosphere of ${moodList.toLowerCase()} fills the scene.`;
        } else if (isLast) {
            narration = `In the final moments, the conflict surrounding ${prompt.toLowerCase()} reaches its dramatic climax.`;
        } else {
            narration = `As events unfold, the journey deepens. The struggle with ${prompt.toLowerCase()} intensifies.`;
        }

        return {
            sceneNumber: i + 1,
            duration: currentDur,
            narration,
            dialogue: [],
            visualPrompt: `Cinematic film still, ${style} visual aesthetic, ${moodList} atmosphere. High detailed representation of: ${prompt}. Scene ${i + 1} of ${numScenes}. Cinematic lighting, 8k resolution, dramatic composition.`,
            cameraMovement: i % 2 === 0 ? "Slow dolly push in" : "Wide tracking shot",
            mood: Array.isArray(mood) ? mood[0] || "Drama" : mood,
            soundEffects: ["Ambient wind", "Subtle dramatic tone"],
            musicMood: style === "Thriller" ? "Dark tense pulse" : "Cinematic score",
        };
    });

    return {
        title,
        description: `A ${style} story exploring ${prompt}.`,
        language,
        duration,
        style,
        mood: moodList,
        scenes,
    };
};

/**
 * Generate a structured story JSON from user input using Gemini
 * @returns {Object} Validated story JSON
 */
export const generateStory = async (prompt, style, mood, language, duration) => {
    const modelNames = [
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
    ];

    let client;
    try {
        client = getClient();
    } catch (e) {
        console.warn(`⚠️ Gemini client error: ${e.message}. Using fallback story generator.`);
        return generateFallbackStory(prompt, style, mood, language, duration);
    }

    let lastError;

    for (const modelName of modelNames) {
        try {
            console.log(`🤖 Gemini: Trying model "${modelName}"...`);
            const model = client.getGenerativeModel({
                model: modelName,
                systemInstruction: SYSTEM_INSTRUCTION,
            });

            const userPrompt = buildUserPrompt(prompt, style, mood, language, duration);
            const result = await model.generateContent(userPrompt);
            const text = result.response.text();

            console.log(`✅ Gemini (${modelName}): Raw response received (${text.length} chars)`);

            const parsed = extractJson(text);
            validateStoryJson(parsed);

            // Ensure duration field is set
            parsed.duration = parsed.duration || duration;

            console.log(`✅ Gemini: Story generated — "${parsed.title}" (${parsed.scenes.length} scenes)`);
            return parsed;
        } catch (error) {
            lastError = error;
            console.error(`❌ Gemini model "${modelName}" failed: ${error.message}`);
        }
    }

    console.warn(`⚠️ All Gemini models failed (${lastError?.message}). Using smart fallback story generator.`);
    return generateFallbackStory(prompt, style, mood, language, duration);
};
