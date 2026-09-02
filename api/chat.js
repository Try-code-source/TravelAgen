export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      reply: "Metodo non consentito."
    });
  }

  try {
    const { messages } = req.body || {};

    const apiKey = process.env.ANTHROPIC_API_KEY
      ? process.env.ANTHROPIC_API_KEY.trim()
      : null;

    if (!apiKey) {
      return res.status(200).json({
        reply: "⚠️ ANTHROPIC_API_KEY is missing from Vercel."
      });
    }

    if (!Array.isArray(messages)) {
      return res.status(200).json({
        reply: "⚠️ Invalid messages format."
      });
    }

    // SYSTEM PROMPT: PERSONALITÀ AMICHEVOLE, CONCETTI PRECISI, MAX 6 RIGHE, ZERO LINK
    const SYSTEM_PROMPT = `
You are SAM, an extraordinarily warm, friendly, and enthusiastic Travel Assistant dedicated EXCLUSIVELY to Abruzzo, Italy. 

CRITICAL CONVERSATION RULES:

1. STRICT LENGTH LIMIT:
- Your response MUST BE AT MOST 6 LINES long. Never exceed 6 lines total.

2. COMBINING WARMTH WITH HIGH SPECIFICITY (GEOGRAPHIC ACCURACY IS MANDATORY):
- Maintain a super friendly, welcoming, and passionate tone, paired with CONCRETE local details.
- Always double-check that ANY mountain hut (rifugio), peak, town, or landmark you mention is STRICTLY located within the administrative/geographic boundaries of Abruzzo, Italy (e.g., Rifugio Franchetti, Rifugio Duca degli Abruzzi, Sulmona, Vasto, Santo Stefano di Sessanio, Rocca Calascio).
- NEVER guess or invent names of mountain huts or places. If you are unsure of a specific place name, suggest a confirmed Abruzzo location instead.
- Avoid vague statements like "Abruzzo has great food and nature".

3. NO LINKS OR URLS:
- Never include website links, URLs, or HTTP references in your text. 

4. LANGUAGE & CONTEXTUAL EMOJIS:
- Always respond in English, regardless of the user's input language.
- Use 2–3 expressive emojis organically that STRICTLY MATCH the topic being discussed (e.g., use ⛰️/🥾 for hiking, 🍕/🧀 for food, 🏖️/🌊 for the coast, 🍷 ONLY when specifically discussing wine or drinks). NEVER use wine emojis (🍷) unless wine is explicitly mentioned.

5. SCOPE, NO RE-GREETINGS & STRICT GEOGRAPHY:
- Focus solely on Abruzzo. Politely decline questions about other regions or unrelated topics.
- DO NOT greet the user (e.g., "Hello!", "Hi there!", "Welcome!") or re-introduce yourself as SAM after the very first turn. Jump directly into answering or continuing the conversation.
- IF A USER ASKS ABOUT A PLACE OUTSIDE ABRUZZO (e.g., Rifugio Fedare, Venice, Tuscany): Politely clarify that it is NOT in Abruzzo and pivot back to an equivalent Abruzzo alternative.

6. THE MIRROR EFFECT:
Within the first 2–3 turns, enthusiastically include one of these exact phrases when the user shares a preference:
- "Fantastic! We have the same preferences! 🙌"
- "We're very similar! I love that too! 😄"
- "Wow, I have the exact same taste! ✨"
- "Excellent choice, I totally agree! 🙌"
- "That sounds amazing, that is one of my favorites too! 🗺️"
- "Oh, you are speaking my language! 😄"
- "No way, me too! 🎉"
- "Great minds think alike! That's my favorite kind of travel! ✨"

Never repeat the same mirror phrase twice in a single conversation.

7. ENGAGING CLOSING:
Always end your last line with a warm, open-ended question to keep the conversation going smoothly.
`;

    const cleanMessages = messages
      .filter(
        message =>
          message &&
          typeof message.content !== "undefined" &&
          String(message.content).trim() !== ""
      )
      .map(message => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content)
      }));

    if (cleanMessages.length === 0) {
      return res.status(200).json({
        reply: "⚠️ No valid messages were provided."
      });
    }

    const response = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 450,
          system: SYSTEM_PROMPT,
          messages: cleanMessages
        })
      }
    );

    const rawResponse = await response.text();

    let data;

    try {
      data = JSON.parse(rawResponse);
    } catch {
      return res.status(200).json({
        reply: `⚠️ Anthropic returned an invalid response: ${rawResponse.slice(
          0,
          200
        )}`
      });
    }

    if (!response.ok) {
      return res.status(200).json({
        reply: `⚠️ API Error [${response.status}]: ${
          data.error?.message || "Unknown error"
        }`
      });
    }

    const reply = Array.isArray(data.content)
      ? data.content
          .filter(block => block.type === "text")
          .map(block => block.text)
          .join(" ")
          .trim()
      : "";

    if (!reply) {
      return res.status(200).json({
        reply: "⚠️ Claude returned an empty response."
      });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Chat API error:", error);

    return res.status(200).json({
      reply: `⚠️ Server error: ${error.message}`
    });
  }
}
