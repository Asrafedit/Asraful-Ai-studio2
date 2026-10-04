const express = require("express");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;
const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.use(express.json({ limit: "12mb" }));
app.use(express.static(__dirname));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "Asraful AI Studio",
    keyConfigured: !!client,
    model: MODEL
  });
});

function validContent(content) {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const clean = [];

  for (const part of content) {
    if (!part || typeof part !== "object") continue;

    if (
      part.type === "input_text" &&
      typeof part.text === "string"
    ) {
      clean.push({
        type: "input_text",
        text: part.text.slice(0, 12000)
      });
    }

    if (
      part.type === "input_image" &&
      typeof part.image_url === "string"
    ) {
      if (
        !/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(
          part.image_url
        )
      ) {
        throw new Error("Unsupported image format.");
      }

      if (part.image_url.length > 11000000) {
        throw new Error("Image is too large. Use an image under 8 MB.");
      }

      clean.push({
        type: "input_image",
        image_url: part.image_url
      });
    }
  }

  return clean.length ? clean : null;
}

app.post("/api/chat", async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({
        error: "OPENAI_API_KEY is not configured."
      });
    }

    if (
      !Array.isArray(req.body?.messages) ||
      req.body.messages.length === 0
    ) {
      return res.status(400).json({
        error: "messages must be a non-empty array."
      });
    }

    const cleanMessages = [];

    for (const item of req.body.messages.slice(-30)) {
      if (
        !item ||
        !["user", "assistant"].includes(item.role)
      ) {
        continue;
      }

      const content = validContent(item.content);

      if (content !== null) {
        cleanMessages.push({
          role: item.role,
          content
        });
      }
    }

    if (!cleanMessages.length) {
      return res.status(400).json({
        error: "No valid messages were supplied."
      });
    }

    const response = await client.responses.create({
      model: MODEL,
      input: cleanMessages
    });

    const answer = response.output_text || "";

    res.json({
      ok: true,
      text: answer,
      reply: answer,
      message: answer,
      content: answer,
      model: MODEL,
      responseId: response.id
    });

  } catch (err) {
    console.error("Chat endpoint error:", err);

    res.status(500).json({
      error: "AI request failed.",
      details: err.message || "Unknown server error"
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Asraful AI Studio listening on ${PORT}`);
});
