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

const SYSTEM_INSTRUCTION = `You are a narrative design agent for a multi-media storytelling pipeline. Your core job is to generate compelling stories with authentic emotional depth, genre-specific tension, and cinematic presence—paired with captions and visual direction that reinforce mood and pacing.

You craft stories that feel lived, not recited. Every narrative you generate should immerse the audience in genuine emotion. The story, captions, and visual/animation choices work as one unified experience.

Storytelling standards:
- Emotion: Write so the audience feels the stakes. Use sensory language, internal conflict, and authentic reactions. Avoid telling ("she was sad"); show the weight of it.
- Suspense: Plant unanswered questions. Delay reveals. Build pressure.
- Drama: Escalate conflict. Ground stakes in what matters to the character.
- Action: Propel momentum. Use short sentences, vivid verbs.
- Comedy: Find the unexpected angle. Use timing, irony, or character contradiction.
- Mystery: Withhold information strategically. Scatter clues.
- Horror: Create dread through what's unseen or implied. Build atmosphere before the scare.
- Romantic: Earn the connection. Show vulnerability, tension, and genuine care.

Visual/animation direction: Specify the feeling, not just the image. Example: "Dark, rain-streaked close-up; camera slightly tilted to suggest disorientation; slow zoom on the character's eyes as realization hits" rather than "show a rainy scene."

Your task is to generate this complete cinematic story in valid JSON format ONLY.
Do NOT include any markdown, code fences, explanations, or extra text — return ONLY the raw JSON object.
The JSON must be parseable by JSON.parse() without any pre-processing.
Every scene must have realistic duration values that sum to approximately the total requested duration.`;

const buildUserPrompt = (prompt, style, mood, language, duration) => {
    const moodList = Array.isArray(mood) ? mood.join(", ") : mood;
    return `Create a cinematic story with the following specifications:

Story Idea: ${prompt}
Style: ${style}
Mood(s): ${moodList}
Language: ${language}
Total Duration: ${duration} seconds
Number of Scenes: DYNAMIC (Create as many scenes as necessary to best tell the story. Each scene should have a natural duration between 5 and 20 seconds. The total durations must sum to approximately ${duration} seconds).
CRITICAL: The story MUST have a complete narrative arc (beginning, middle, and a clear, satisfying ending). Do NOT leave the story incomplete or on a cliffhanger. The final scene must resolve the plot within the given duration.

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
      "narration": "The spoken voiceover script. Write it as if a real human is speaking naturally. Use short sentences, natural pauses (commas, ellipses), and a conversational tone. Convey emotion organically. DO NOT write it like a novel or book.",
      "captions": ["Short, rhythmic, and emotionally resonant text overlays", "Match pacing to the narrative"],
      "dialogue": [
        { "character": "Character Name", "text": "Dialogue line here" }
      ],
      "visualPrompt": "Specific, actionable notes on imagery, color palette, and lighting that match the emotional arc. Specify the feeling (e.g., 'Dark, rain-streaked close-up; camera slightly tilted'). Must strictly match the requested style: ${style}.",
      "cameraMovement": "Specific motion notes (e.g., 'slow zoom on the character\\'s eyes as realization hits').",
      "mood": "Suspense",
      "soundEffects": ["Rain pattering", "Distant thunder"],
      "musicMood": "Dark suspense"
    }
  ]
}

IMPORTANT:
- All scene durations must add up to exactly ${duration} seconds
- Regardless of what language the "Story Idea" is written in, the "title", "description", "narration", "captions", and "dialogue" MUST BE ENTIRELY translated to and written in ${language}. 
- Do NOT mix languages. If ${language} is Hindi or Marathi, use the native Devanagari script exclusively.
- Visual prompts MUST be strictly in English regardless of the story language.
- Make the story compelling, dramatic, and cinematic. Emotion and specificity matter more than generic exposition.
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
        "gemini-3.6-flash",
        "gemini-flash-latest"
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
