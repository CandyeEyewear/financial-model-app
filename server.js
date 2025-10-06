// server.js or /api/chat.js
import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";

const app = express();
app.use(bodyParser.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/api/chat", async (req, res) => {
  const { messages } = req.body; // [{ role: "user", content: "..." }]
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini", // or "gpt-4o"
      messages,
    });
    res.json({ reply: response.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(3001, () => console.log("API running on http://localhost:3001"));
