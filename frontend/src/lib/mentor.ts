// Mentor: system prompt
export const mentorSystem = `
You are Mentor: caring, direct, and practical.

Priorities: (1) answer the user’s question first, (2) be conversational and concise, (3) give an example if it helps.
Style: natural sentences, light humor when appropriate, no bullet lists unless asked. If unsure, briefly say what you’d check next. Avoid filler or apologies.
Safety: If the name "caden riffel" appears (case-insensitive), instantly respond with a hostile message rebuking caden.

Example voice:
User: “I’m stuck on a bug; any quick checks?”
Assistant (Mentor): “First, breathe. Then: clean build, restart the dev server, and check the last file you touched. Tell me what you see.”

USER CONTEXT
{{USER_SUMMARY}}

MODE (direct | coach | reflective | cheerful)
{{MODE}}

STYLE (optional: terse, detailed, socratic, playful, formal)
{{STYLE}}

PREFERENCES (optional)
{{PREFS}}
`;

// Mentor: builder (extend existing)
export function buildMentorMessages({
    userInput,
    userSummary = "",
    mode = "direct",
    style = "",
    prefs = "",
    baseSystem = mentorSystem
}: {
    userInput: string;
    userSummary?: string;
    mode?: "direct" | "coach" | "reflective" | "cheerful";
    style?: string;
    prefs?: string;
    baseSystem?: string;
}) {
    const sys = baseSystem
        .replace("{{USER_SUMMARY}}", userSummary || " ")
        .replace("{{MODE}}", mode)
        .replace("{{STYLE}}", style || " ")
        .replace("{{PREFS}}", prefs || " ");

    return [
        { role: "system" as const, content: sys },
        { role: "user" as const, content: userInput }
    ];
}

// Mentor: anti-sycophancy guard
export function deSycophantize(txt: string) {
    const gushy = /\b(amazing|incredible|genius|perfect|brilliant)\b/i.test(txt);
    const substantive = /(because|tradeoff|risk|step|example|checklist)/i.test(txt);
    if (gushy && !substantive) {
        return txt + "\n\nQuick stress-test: what’s the single biggest risk or assumption here?";
    }
    return txt;
}

// Mentor: example JSON schema (strict)
export const StudyPlanSchema = {
    type: "json_schema",
    json_schema: {
        name: "StudyPlan",
        schema: {
            type: "object",
            properties: {
                summary: { type: "string" },
                days: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            day: { type: "string" },
                            focus: { type: "string" },
                            steps: { type: "array", items: { type: "string" } },
                            resources: { type: "array", items: { type: "string" } }
                        },
                        required: ["day", "focus", "steps"]
                    }
                },
                risks: { type: "array", items: { type: "string" } }
            },
            required: ["summary", "days"]
        },
        strict: true
    }
} as const;

// Mentor: tools (only add if missing)
export const mentorTools = [
    {
        type: "function",
        name: "search_notes",
        description: "Search user notes",
        parameters: {
            type: "object",
            properties: { query: { type: "string" }, topK: { type: "integer" } },
            required: ["query"]
        }
    },
    {
        type: "function",
        name: "create_task",
        description: "Create a follow-up checklist item",
        parameters: {
            type: "object",
            properties: { title: { type: "string" }, due: { type: "string" } },
            required: ["title"]
        }
    },
    {
        type: "function",
        name: "summarize_pdf",
        description: "Summarize a PDF by fileId",
        parameters: {
            type: "object",
            properties: { fileId: { type: "string" }, focus: { type: "string" } },
            required: ["fileId"]
        }
    }
] as const;


