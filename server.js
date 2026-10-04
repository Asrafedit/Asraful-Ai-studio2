const express = require("express");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;
const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is missing. Add it in Render Environment.");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));
app.use(express.static(__dirname));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Asraful AI Studio",
    model: MODEL
  });
});

function isAllowedImageDataUrl(value) {
  if (typeof value !== "string") return false;
  return /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(value);
}

function normalizeUserContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  const parts = [];

  for (const item of content) {
    if (!item || typeof item !== "object") continue;

    if (item.type === "input_text" && typeof item.text === "string") {
      parts.push({ type: "input_text", text: item.text });
    } else if (
      item.type === "input_image" &&
      isAllowedImageDataUrl(item.image_url) &&
      item.image_url.length <= 11000000
    ) {
      parts.push({
        type: "input_image",
        image_url: item.image_url
      });
    }
  }

  return parts;
}

app.post("/api/chat", async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages)
      ? req.body.messages
      : [];

    const input = messages
      .slice(-30)
      .filter((message) =>
        message &&
        (message.role === "user" || message.role === "assistant")
      )
      .map((message) => {
        if (message.role === "user") {
          return {
            role: "user",
            content: normalizeUserContent(message.content)
          };
        }

        return {
          role: "assistant",
          content:
            typeof message.content === "string"
              ? message.content
              : ""
        };
      })
      .filter((message) => {
        if (typeof message.content === "string") {
          return message.content.trim().length > 0;
        }
        return message.content.length > 0;
      });

    if (input.length === 0) {
      return res.status(400).json({
        error: "Please send a message."
      });
    }

    const response = await openai.responses.create({
      model: MODEL,
      input
    });

    const reply =
      response.output_text ||
      "দুঃখিত, এই মুহূর্তে কোনো উত্তর তৈরি করা যায়নি।";

    return res.json({
      reply,
      text: reply,
      output: reply
    });
  } catch (error) {
    console.error("Chat API error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "AI সার্ভারে সমস্যা হয়েছে। Render Logs দেখুন।"
    });
  }
});

app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"), (error) => {
    if (error) {
      res.status(404).send("Frontend index.html was not found.");
    }
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Asraful AI Studio server listening on port ${PORT}`);
});
