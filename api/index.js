// api/index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
// Increase payload limit because we are sending base64 images
app.use(express.json({ limit: '50mb' }));

app.post('/api/analyze-design', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ ok: false, error: 'No image provided' });
    }

    const prompt = `You are an expert fashion technical designer. Analyze this garment design.
Provide a JSON response with exactly this structure:
{
  "score": <number between 0-100 indicating factory readiness and clarity of the sketch>,
  "notes": [
    {
      "severity": "green" | "amber" | "blue" | "red",
      "text": "specific feedback on construction, proportion, or clarity"
    }
  ]
}
Return ONLY raw JSON. Do not include markdown formatting like \`\`\`json.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: imageBase64
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API Error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const rawText = data.content[0].text;
    
    // Clean markdown fences if Claude includes them
    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const analysis = JSON.parse(cleanJson);

    res.json({ ok: true, analysis });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🧠 Grainline AI Brain running on http://localhost:${PORT}`);
});