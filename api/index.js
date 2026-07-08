const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

async function callGemini(prompt, imageBase64) {
  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: "image/png",
            data: imageBase64
          }
        }
      ]
    }],
    generationConfig: {
      response_mime_type: "application/json",
    }
  };

  const response = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API Error: ${response.status} ${err}`);
  }

  const data = await response.json();
  // Gemini returns JSON inside a specific candidate structure
  const rawJson = data.candidates[0].content.parts[0].text;
  return JSON.parse(rawJson);
}

// 1. Endpoint for Design Analysis
app.post('/api/analyze-design', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ ok: false, error: 'No image provided' });

    const prompt = `You are an expert fashion technical designer. Analyze this garment design.
Provide a JSON response with exactly this structure:
{
  "score": <number between 0-100 indicating factory readiness>,
  "notes": [
    {
      "severity": "green" | "amber" | "blue" | "red",
      "text": "specific feedback on construction, proportion, or clarity"
    }
  ]
}`;

    const analysis = await callGemini(prompt, imageBase64);
    res.json({ ok: true, analysis });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 2. Endpoint for Tech Pack Generation
app.post('/api/generate-tech-pack', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ ok: false, error: 'No image provided' });

    const prompt = `You are an expert technical fashion designer. Look at this design sketch.
Create a realistic technical Bill of Materials (BOM) and a base Measurements chart for Size Medium.
Return a JSON object with this exact structure:
{
  "bom": [
    { "id": "bom-1", "material": "string", "supplier": "string", "qtyPerUnit": "string", "unitCost": "string" }
  ],
  "measurements": [
    { "id": "meas-1", "size": "S", "chest": "string", "length": "string", "sleeve": "string" },
    { "id": "meas-2", "size": "M", "chest": "string", "length": "string", "sleeve": "string" },
    { "id": "meas-3", "size": "L", "chest": "string", "length": "string", "sleeve": "string" }
  ]
}`;

    const techPackData = await callGemini(prompt, imageBase64);
    res.json({ ok: true, techPackData });

  } catch (error) {
    console.error('Tech Pack error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🧠 Grainline AI (Gemini) running on http://localhost:${PORT}`);
});