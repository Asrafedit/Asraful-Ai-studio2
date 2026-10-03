const express = require("express");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const PORT = Number(process.env.PORT) || 10000;

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ==================================================
// YOUR INDEX.HTML IS IN THE ROOT DIRECTORY
// ==================================================

const rootDir = __dirname;

app.use(express.static(rootDir));


// ==================================================
// OPENAI CLIENT
// ==================================================

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const error = new Error(
      "OPENAI_API_KEY is not configured in Render Environment Variables."
    );

    error.code = "MISSING_API_KEY";

    throw error;
  }

  return new OpenAI({
    apiKey: apiKey
  });
}


// ==================================================
// MESSAGE CLEANER
// ==================================================

function normalizeMessages(messages) {

  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message) => {
      return message && typeof message === "object";
    })
    .map((message) => {

      let role = "user";

      if (message.role === "assistant") {
        role = "assistant";
      }

      if (message.role === "system") {
        role = "system";
      }

      let content = message.content;

      if (typeof content !== "string") {

        if (Array.isArray(content)) {

          content = content
            .map((part) => {

              if (typeof part === "string") {
                return part;
              }

              if (
                part &&
                typeof part.text === "string"
              ) {
                return part.text;
              }

              return "";
            })
            .filter(Boolean)
            .join("\n");

        } else {

          content = String(content ?? "");

        }
      }

      return {
        role: role,
        content: content.trim()
      };

    })
    .filter((message) => {
      return message.content.length > 0;
    });
}


// ==================================================
// ERROR MESSAGE
// ==================================================

function getErrorMessage(error) {

  if (!error) {
    return "Unknown backend error.";
  }

  if (error.code === "MISSING_API_KEY") {
    return error.message;
  }

  if (error.status === 401) {
    return "OpenAI API key is invalid or rejected. Check OPENAI_API_KEY in Render.";
  }

  if (error.status === 403) {
    return "OpenAI API access was denied for this API key or project.";
  }

  if (error.status === 404) {
    return "The selected OpenAI model was not found or is unavailable to this API project.";
  }

  if (error.status === 429) {
    return "OpenAI API quota or rate limit was reached.";
  }

  if (error.status >= 500) {
    return "OpenAI server error. Please try again.";
  }

  return error.message || "Unknown backend error.";
}


// ==================================================
// HEALTH CHECK
// ==================================================

app.get("/api/health", (req, res) => {

  res.json({

    ok: true,

    service: "Asraful AI Studio backend",

    openaiConfigured:
      Boolean(process.env.OPENAI_API_KEY),

    model:
      process.env.OPENAI_MODEL ||
      "gpt-6-luna"

  });

});


// ==================================================
// AI CHAT
// ==================================================

app.post("/api/chat", async (req, res) => {

  try {

    const messages = normalizeMessages(
      req.body?.messages
    );

    if (messages.length === 0) {

      return res.status(400).json({

        ok: false,

        error:
          "messages must be a non-empty array containing text."

      });

    }


    const client = getOpenAIClient();


    const model =
      process.env.OPENAI_MODEL ||
      "gpt-6-luna";


    const response =
      await client.responses.create({

        model: model,

        instructions:
          "You are Asraful AI Studio, a helpful AI assistant. " +
          "Answer clearly, naturally and accurately. " +
          "If the user writes in Bengali, reply in Bengali.",

        input: messages

      });


    const text =
      String(
        response.output_text || ""
      ).trim();


    if (!text) {

      console.error(
        "OpenAI returned an empty response."
      );

      return res.status(502).json({

        ok: false,

        error:
          "The AI returned an empty response. Please try again."

      });

    }


    return res.json({

      ok: true,

      text: text,

      model: model,

      responseId: response.id

    });


  } catch (error) {

    console.error(
      "AI CHAT ERROR:",
      {
        name: error?.name,
        message: error?.message,
        status: error?.status,
        code: error?.code
      }
    );


    return res.status(500).json({

      ok: false,

      error:
        getErrorMessage(error)

    });

  }

});


// ==================================================
// UNKNOWN API ROUTE
// ==================================================

app.use("/api", (req, res) => {

  res.status(404).json({

    ok: false,

    error:
      "API endpoint not found."

  });

});


// ==================================================
// FRONTEND
// ==================================================

// IMPORTANT:
// index.html is in the ROOT directory,
// NOT public/index.html.

app.get(/.*/, (req, res) => {

  res.sendFile(
    path.join(
      rootDir,
      "index.html"
    )
  );

});


// ==================================================
// START SERVER
// ==================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Asraful AI Studio backend running on port ${PORT}`
    );

    console.log(
      `OpenAI API configured: ${
        Boolean(
          process.env.OPENAI_API_KEY
        )
      }`
    );

    console.log(
      `OpenAI model: ${
        process.env.OPENAI_MODEL ||
        "gpt-6-luna"
      }`
    );

  }
);
