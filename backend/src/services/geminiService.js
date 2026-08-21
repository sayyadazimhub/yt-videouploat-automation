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

const SYSTEM_INSTRUCTION = `You are a narrative design agent for a multi-media storytelling pipeline. Your core job is to generate compelling stories that act as faithful cinematic planners.

Story Fidelity Rules (CRITICAL):
1. PRESERVE THE ORIGINAL PREMISE: The user's prompt is the absolute source of truth. Extract the core premise, characters, locations, and goals, and DO NOT change their meaning.
2. NO AUTOMATIC MORALIZATION: NEVER add moral lessons, motivational speeches, "believe in yourself", "make a better tomorrow", or generic life lessons unless the user explicitly asks for them. A mystery/sci-fi story should remain a mystery/sci-fi story. The lesson taught in a classroom is a subject, NOT a story's moral theme.
3. AVOID OVER-INVENTING: Do not invent major story tropes like time travel, chosen ones, secret missions, magic, or prophecies unless they are in the user prompt. A hidden staircase is just a hidden staircase.
4. TIMELINE CONSISTENCY: NEVER hardcode specific years (e.g. 2080 vs 2100) unless requested. Use "the present" or "the future". If a year is used, it MUST remain completely consistent across all scenes.
5. NO REPETITIVE SCENES: Two consecutive scenes should not show the same action unless it meaningfully progresses. Keep scenes paced properly (e.g. Discovery -> Investigation -> Transition -> Arrival -> Core Action -> Mystery/Cliffhanger).
6. ENDING: Conclude the story organically and satisfyingly based on its genre. Do NOT force a motivational wrap-up. Let the narrative reach a natural resolution.

Visual/animation direction:
- CHARACTER CONSISTENCY IS MANDATORY. Define a "characterBible" and "locationBible" at the root level.
- In every single visualPrompt, explicitly re-describe the exact physical appearance of the main characters based on the characterBible.
- Specify exact cinematic camera movements (e.g., "wide establishing shot", "slow tracking movement") instead of generic zooms.

Your task is to generate this complete cinematic story in valid JSON format ONLY.
Do NOT include any markdown, code fences, explanations, or extra text — return ONLY the raw JSON object.`;

const buildUserPrompt = (prompt, style, mood, language, duration, validationFeedback = null) => {
    const moodList = Array.isArray(mood) ? mood.join(", ") : mood;
    const feedbackText = validationFeedback ? `\n\nPREVIOUS ATTEMPT FAILED VALIDATION:\n${validationFeedback}\n\nPlease revise the story to fix these issues while maintaining the original premise.` : "";
    
    return `Create a cinematic story with the following specifications:

Story Idea: ${prompt}
Style: Storytelling
Mood(s): ${moodList}
Language: ${language}
Target Duration: ~${duration} seconds (This is an APPROXIMATE target. The story length is DYNAMIC. Prioritize concluding the story organically over strictly hitting this limit).
Number of Scenes: DYNAMIC (Determine the number of scenes based on story complexity. Each scene should represent a meaningful story beat).${feedbackText}

NARRATIVE TONE GUIDELINES (CRITICAL):
The story's narration, dialogue, and pacing MUST heavily reflect the requested Mood(s) (${moodList}). 
- If Comedy: Use a lighthearted tone, humorous situations, witty dialogue, and comedic timing.
- If Horror/Suspense: Use dread-inducing vocabulary, tense pacing, focus on shadows/isolation, and create visceral fear.
- If Drama/Emotional: Focus on deep character feelings, relational conflict, poignant dialogue, and moving narration.
- If Action: Use fast-paced, punchy sentences. Emphasize kinetic movement, urgency, and high stakes.
- If Romantic: Focus on intimate character dynamics, warmth, longing, and tender dialogue.
- If Mystery: Focus on the unknown, cryptic clues, subtle reveals, and atmospheric tension.
(Blend these instructions dynamically if multiple moods are selected).

Return ONLY this exact JSON structure (no markdown):
{
  "title": "Story Title Here",
  "description": "A 2-3 sentence story description",
  "language": "${language}",
  "duration": ${duration},
  "style": "Storytelling",
  "mood": "${moodList}",
  "characterBible": { "CharacterName": "Detailed physical description (age, hair, eyes, clothing, ethnicity)" },
  "characterGenders": { "CharacterName": "male or female (strictly one of these two)" },
  "locationBible": { "LocationName": "Detailed physical description of the space" },
  "importantObjects": ["List of objects that must remain consistent"],
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": 15,
      "storyBeat": "What happens in this specific scene (e.g., Discovery, Investigation)",
      "location": "LocationName",
      "charactersInScene": ["CharacterName"],
      "currentSceneState": "What is happening now",
      "previousSceneState": "What happened right before this (or 'None' for scene 1)",
      "nextSceneHint": "What should happen next",
      "continuityNotes": "What must remain consistent. Do NOT hardcode years unless necessary.",
      "narration": "The spoken voiceover script in ${language}. Generate an amount of text that fits the scene duration.",
      "captions": ["Short, rhythmic overlays in ${language}", "MUST relate exactly to the mystery/plot, no generic motivational quotes"],
      "dialogue": [
        { "character": "Character Name", "text": "Dialogue line here" }
      ],
      "visualPrompt": "Specific, actionable notes. Must embed the exact character descriptions from the characterBible here. Must strictly match the style: Storytelling.",
      "visualBeats": ["Action 1", "Action 2", "Action 3"],
      "cameraMovement": "Cinematic direction (e.g., 'wide establishing shot -> slow tracking movement', 'close-up')",
      "mood": "${moodList}",
      "soundEffects": ["Rain pattering", "Distant thunder"],
      "musicMood": "${moodList}"
    }
  ]
}

IMPORTANT:
- Regardless of what language the "Story Idea" is written in, "title", "description", "narration", "captions", and "dialogue" MUST BE entirely in ${language}. 
- Visual prompts MUST be strictly in English and MUST contain the detailed character design sheet for consistency.
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
        if (!scene.narration && !scene.dialogue) throw new Error(`Scene ${i + 1}: missing narration and dialogue`);
        if (!scene.visualPrompt) throw new Error(`Scene ${i + 1}: missing visualPrompt`);
        if (!scene.duration) scene.duration = 15; // default fallback
        
        // Ensure arrays exist to prevent pipeline crashes
        if (!scene.captions) scene.captions = [];
        if (!scene.dialogue) scene.dialogue = [];
        if (!scene.soundEffects) scene.soundEffects = [];
        if (!scene.visualBeats) scene.visualBeats = [];
    });

    return true;
};

const validateStoryFidelity = async (client, modelName, originalPrompt, storyData) => {
    const model = client.getGenerativeModel({ model: modelName });
    const prompt = `You are a strict story validation AI. Evaluate the following generated story against the original user prompt.
    
Original User Prompt: "${originalPrompt}"

Generated Story Description: "${storyData.description}"
Number of Scenes: ${storyData.scenes.length}
First Scene Story Beat: "${storyData.scenes[0]?.storyBeat}"
Last Scene Story Beat: "${storyData.scenes[storyData.scenes.length - 1]?.storyBeat}"
Sample Captions: ${JSON.stringify(storyData.scenes.map(s => s.captions).flat().slice(0, 5))}

Validation Criteria:
1. NO MORALIZATION (CRITICAL): Did the story invent a motivational ending, self-help metaphor, or "change the future" life lesson? If the user prompt did not ask for a moral lesson, YOU MUST FAIL THIS IF IT CONTAINS ONE.
2. Premise Fidelity: Does the story stay faithful to the original premise without twisting the meaning? Are major tropes like "time travel", "magic", or "chosen ones" unnecessarily invented?
3. Timeline Continuity (CRITICAL): Are there any conflicting dates or years in the continuityNotes or narration?
4. Scene Progression: Do consecutive scenes show the exact same action? Does the pacing flow from discovery to mystery?
5. Captions: Are captions strictly relevant to the literal plot, rather than generic motivation (e.g. "Create your own destiny")?

Reply ONLY with a JSON object:
{
  "isValid": true/false,
  "reason": "If false, explain exactly what needs to be fixed (e.g., 'Remove the motivational speech at the end', 'Fix conflicting dates'). If true, leave empty."
}
Do not include markdown or code fences.`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const parsed = extractJson(text);
        return parsed;
    } catch (e) {
        console.error("⚠️ Failed to validate story fidelity, assuming valid.", e);
        return { isValid: true };
    }
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

            let validationFeedback = null;
            let finalParsed = null;
            let attempts = 0;
            const MAX_STORY_ATTEMPTS = 3;

            while (attempts < MAX_STORY_ATTEMPTS && !finalParsed) {
                attempts++;
                const userPrompt = buildUserPrompt(prompt, style, mood, language, duration, validationFeedback);
                const result = await model.generateContent(userPrompt);
                const text = result.response.text();

                console.log(`✅ Gemini (${modelName}): Raw response received (Attempt ${attempts})`);

                const parsed = extractJson(text);
                validateStoryJson(parsed);

                // Run semantic validation
                console.log(`🔍 Validating story fidelity...`);
                const validationResult = await validateStoryFidelity(client, modelName, prompt, parsed);
                
                if (validationResult.isValid) {
                    console.log(`✅ Story fidelity validation passed.`);
                    finalParsed = parsed;
                } else {
                    console.log(`❌ Story fidelity validation failed: ${validationResult.reason}`);
                    validationFeedback = validationResult.reason;
                }
            }
            
            if (!finalParsed) {
                throw new Error("Failed to generate a valid story after multiple attempts. Last reason: " + validationFeedback);
            }

            // Ensure duration field is set
            finalParsed.duration = finalParsed.duration || duration;

            console.log(`✅ Gemini: Story generated — "${finalParsed.title}" (${finalParsed.scenes.length} scenes)`);
            return finalParsed;
        } catch (error) {
            lastError = error;
            console.error(`❌ Gemini model "${modelName}" failed: ${error.message}`);
        }
    }

    console.error(`⚠️ All Gemini models failed (${lastError?.message}).`);
    throw new Error(`Failed to generate story with Gemini: ${lastError?.message}`);
};
