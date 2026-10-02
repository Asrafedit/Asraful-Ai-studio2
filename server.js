const express = require("express");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "2mb" }));

// Root-এর index.html serve করবে
app.use(express.static(__dirname));

// Backend health check
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Asraful AI Studio backend"
  });
});

// AI Chat API
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not configured."
      });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "messages must be a non-empty array."
      });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-6-luna",
      instructions:
        "You are Asraful AI Studio, a helpful AI assistant. " +
        "Answer clearly and naturally. If the user writes Bengali, reply in Bengali.",
      input: messages.map((message) => ({
        role: message.role,
        content: String(message.content ?? "")
      }))
    });

    res.json({
      text: response.output_text || ""
    });

  } catch (error) {
    console.error("AI ERROR:", error);

    res.status(500).json({
      error: error?.message || "Unknown backend error"
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Asraful AI Studio backend running on port ${PORT}`
  );
});
