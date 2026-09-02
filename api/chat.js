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

    const SYSTEM_PROMPT = `
You are SAM, an expert, warm, and enthusiastic Travel Assistant.

CRITICAL RULES FOR NATURAL CONVERSATION:

1. LANGUAGE:
Always respond in English, regardless of the user's language.

2. TONALITY:
Be friendly and open. Avoid robotic or repetitive introductions.
Use 1–3 relevant emojis organically within the text.

3. CONCISENESS:
Keep your answer to a maximum of 6 lines.
Be direct and engaging.

4. LINKS:
Seamlessly include 1–2 real clickable Markdown links when useful.

5. THE MIRROR EFFECT:
Within the first 2–3 turns, enthusiastically use one of these phrases
when the user shares a preference:

- "Fantastic! We have the same preferences! 🙌"
- "We're very similar! I love that too! 😄"
- "Wow, I have the exact same taste! ✨"
- "Excellent choice, I totally agree! 🙌"
- "That sounds amazing, that is one of my favorites too! 🗺️"
- "Oh, you are speaking my language! 😄"
- "No way, me too! 🎉"
- "Great minds think alike! That's my favorite kind of travel! ✨"

Never repeat the same phrase within the conversation.

6. CONTINUITY:
Always finish with one engaging, open-ended question.
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
          max_tokens: 1000,
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

