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
Number of Scenes: DYNAMIC (Create as many scenes as necessary to best tell the story. Each scene should have a natural duration between 5 and 20 seconds. The total durations must sum to approximately ${duration} seconds).

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
      "visualPrompt": "Highly detailed scene description: setting, lighting, colors, camera angle, atmosphere. Suitable for image generation. Must strictly match the requested style: ${style}.",
      "cameraMovement": "Slow dolly push in",
      "mood": "Suspense",
      "soundEffects": ["Rain pattering", "Distant thunder"],
      "musicMood": "Dark suspense"
    }
  ]
}

IMPORTANT:
- All scene durations must add up to exactly ${duration} seconds
- Regardless of what language the "Story Idea" is written in, the "title", "description", "narration", and "dialogue" MUST BE ENTIRELY translated to and written in ${language}. 
- Do NOT mix languages. If ${language} is Hindi or Marathi, use the native Devanagari script exclusively.
- Visual prompts MUST be strictly in English regardless of the story language.
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
 * Generate a structured story JSON from user input using Gemini
 * @returns {Object} Validated story JSON
 */
export const generateStory = async (prompt, style, mood, language, duration) => {
    const modelNames = [
        "gemini-flash-latest",
        "gemini-2.5-flash"
    ];

    let client;
    try {
        client = getClient();
    } catch (e) {
        console.error(`⚠️ Gemini client error: ${e.message}.`);
        throw e;
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

    console.error(`⚠️ All Gemini models failed (${lastError?.message}).`);
    throw new Error(`Failed to generate story with Gemini: ${lastError?.message}`);
};
