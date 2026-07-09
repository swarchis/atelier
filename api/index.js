// api/index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const MODEL_NAME = "gemini-flash-lite-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;

function cleanAIJSON(text) {
  return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}

async function callGemini(prompt, imageBase64 = null) {
  const parts = [{ text: prompt }];
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: "image/png", data: imageBase64 } });
  }

  const payload = {
    contents: [{ parts }],
    generationConfig: { response_mime_type: "application/json" },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
    ]
  };

  const response = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `Gemini Error: ${response.status}`);
  
  const rawText = data.candidates[0].content.parts[0].text;
  return JSON.parse(cleanAIJSON(rawText));
}

// ---------------------------------------------------------
// 1. DESIGN & TECH PACK ENDPOINTS
// ---------------------------------------------------------

app.post('/api/analyze-design', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    const prompt = `Analyze this garment design. Return JSON { "score": number, "notes": [{ "severity": "string", "text": "string" }] }`;
    const analysis = await callGemini(prompt, imageBase64);
    res.json({ ok: true, analysis });
  } catch (error) { res.status(500).json({ ok: false, error: error.message }); }
});

app.post('/api/generate-tech-pack', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    const prompt = `Generate Tech Pack JSON { "bom": [], "measurements": [] } from this image.`;
    const techPackData = await callGemini(prompt, imageBase64);
    res.json({ ok: true, techPackData });
  } catch (error) { res.status(500).json({ ok: false, error: error.message }); }
});

// ---------------------------------------------------------
// 2. VENDOR SOURCING & OUTREACH ENDPOINTS
// ---------------------------------------------------------

app.post('/api/search-vendors', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ ok: false, error: 'No query provided' });

    const tavilyQuery = `${query} wholesale apparel manufacturer factory supplier B2B`;
    
    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: tavilyQuery,
        search_depth: "advanced",
        max_results: 10
      })
    });

    const tavilyData = await tavilyRes.json();
    const searchContext = tavilyData.results.map(r => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join('\n\n');

    const prompt = `Extract manufacturers. Return JSON { "recommended": [{ "name": "...", "category": "...", "location": "...", "description": "...", "sourceUrl": "...", "moq": number, "leadTime": "...", "specialties": [], "sourceType": "vendor" }], "broader": [] } from this data: ${searchContext}`;
    
    const extractedData = await callGemini(prompt);
    res.json({ ok: true, ...extractedData });

  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/parse-vendor', async (req, res) => {
  try {
    const { text } = req.body;
    const prompt = `Extract vendor JSON { "vendor": { "name": "string", "category": "string", "location": "string", "specialties": ["string"], "moq": number, "leadTime": "string" } } from this text: ${text}`;
    const result = await callGemini(prompt);
    res.json({ ok: true, ...result });
  } catch (error) { res.status(500).json({ ok: false, error: error.message }); }
});

// NEW: Draft Vendor Email Endpoint
app.post('/api/draft-vendor-email', async (req, res) => {
  console.log("📥 Received email drafting request...");
  try {
    const { vendorName, productName, garmentType, preferences, ask } = req.body;

    const prompt = `You are an independent fashion brand founder writing an outreach email to a clothing manufacturer.
    
Write a professional, concise, and polite Request for Quote (RFQ) email to a manufacturer.
Factories are busy and ignore long emails. Get straight to the point.

Details to include:
- Vendor Name: ${vendorName || 'the manufacturer'}
- Product: ${productName || 'a new design'} (${garmentType || 'clothing item'})
- Target Quantity (MOQ): ${preferences?.quantity || 'Not specified yet'}
- Target Unit Cost: ${preferences?.targetUnitCost ? '$' + preferences.targetUnitCost : 'Not specified yet'}
- Target Deadline: ${preferences?.deadline || 'Standard lead time'}
- Additional Founder Note/Ask: ${ask || 'Just looking for a general quote and capability match.'}

Return ONLY a JSON object with this exact structure (no markdown fences):
{
  "subject": "Clear, professional subject line",
  "body": "The full email body text. Use \\n for line breaks. Include a placeholder for the sender's name at the bottom."
}`;

    const draft = await callGemini(prompt);
    console.log("✅ Email drafted successfully");
    res.json({ ok: true, draft });

  } catch (error) {
    console.error('❌ Email Draft Error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🧠 Backend running on http://localhost:${PORT}`);
});