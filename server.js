const express = require("express");
const path = require("path");
const OpenAI = require("openai");

const app = express();

// ===============================
// CONFIG
// ===============================
const PORT = process.env.PORT || 10000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";

// ===============================
// OPENAI CLIENT
// ===============================
const openai = OPENAI_API_KEY
  ? new OpenAI({
      apiKey: OPENAI_API_KEY,
    })
  : null;

// ===============================
// MIDDLEWARE
// ===============================
app.use(express.json({ limit: "2mb" }));

// Serve files from repository root
app.use(express.static(__dirname));

// ===============================
// HEALTH CHECK
// ===============================
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Asraful AI Studio backend",
    openaiConfigured: !!OPENAI_API_KEY,
    model: MODEL,
  });
});

// ===============================
// AI CHAT API
// ===============================
app.post("/api/chat", async (req, res) => {
  try {
    // Check API key
    if (!OPENAI_API_KEY || !openai) {
      return res.status(500).json({
        ok: false,
        error: "OPENAI_API_KEY is not configured on the server.",
      });
    }

    // Get messages from frontend
    const messages = req.body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "No messages were provided.",
      });
    }

    // Clean and validate messages
    const cleanMessages = messages
      .filter((msg) => msg && typeof msg === "object")
      .map((msg) => ({
        role:
          msg.role === "assistant" ||
          msg.role === "system" ||
          msg.role === "user"
            ? msg.role
            : "user",
        content:
          typeof msg.content === "string"
            ? msg.content
            : String(msg.content ?? ""),
      }))
      .filter((msg) => msg.content.trim().length > 0);

    if (cleanMessages.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "No valid message content was provided.",
      });
    }

    // ===============================
    // OPENAI RESPONSES API
    // ===============================
    const response = await openai.responses.create({
      model: MODEL,
      input: cleanMessages,
    });

    // Get generated text
    const text =
      typeof response.output_text === "string"
        ? response.output_text.trim()
        : "";

    // Make sure we actually received a response
    if (!text) {
      return res.status(502).json({
        ok: false,
        error: "The AI returned an empty response.",
        responseId: response.id || null,
      });
    }

    // ===============================
    // IMPORTANT:
    // The frontend accepts reply/message/content.
    // We return all aliases for compatibility.
    // ===============================
    return res.json({
      ok: true,

      // Main response
      text: text,

      // Frontend compatibility
      reply: text,
      message: text,
      content: text,

      // Extra information
      model: MODEL,
      responseId: response.id || null,
    });
  } catch (error) {
    console.error("OPENAI ERROR:", error);

    const status =
      Number.isInteger(error?.status) && error.status >= 400
        ? error.status
        : 500;

    return res.status(status).json({
      ok: false,
      error: error?.message || "Unknown backend error.",
      details: error?.message || "Unknown backend error.",
    });
  }
});

// ===============================
// FRONTEND FALLBACK
// ===============================
// index.html is in the ROOT of the repository,
// not inside /public.
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ===============================
// START SERVER
// ===============================
app.listen(PORT, "0.0.0.0", () => {
  console.log("======================================");
  console.log("Asraful AI Studio backend started");
  console.log(`Port: ${PORT}`);
  console.log(`Model: ${MODEL}`);
  console.log(`OpenAI configured: ${!!OPENAI_API_KEY}`);
  console.log("======================================");
});
