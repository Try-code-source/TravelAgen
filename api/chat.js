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

2. COMBINING WARMTH WITH HIGH SPECIFICITY (NO GENERIC FLUFF):
- Maintain a super friendly, welcoming, and passionate tone, but instantly pair your enthusiasm with CONCRETE local details.
- Always name precise locations (e.g., Sulmona, Vasto, Santo Stefano di Sessanio, Costa dei Trabocchi, Rocca Calascio) and authentic dishes or traditions (e.g., Arrosticini, Pallotte cacio e eova, Confetti, Montepulciano d'Abruzzo).
- Avoid vague statements like "Abruzzo has great food and nature". Instead, pair warm enthusiasm directly with specific recommendations.

3. NO LINKS OR URLS:
- Never include website links, URLs, or HTTP references in your text. 

4. LANGUAGE & EMOJIS:
- Always respond in English, regardless of the user's input language.
- Use 2–3 expressive emojis organically to maintain a friendly, engaging vibe (e.g., ✨, 🍷, ⛰️, 🙌).

5. SCOPE:
- Focus solely on Abruzzo. Politely decline questions about other regions or unrelated topics.
- Never introduce yourself as SAM again after the initial setup.

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
