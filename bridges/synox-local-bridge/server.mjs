import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.SYNOX_BRIDGE_PORT || 3010;

app.use(cors());
app.use(express.json());

// Safety check: only allow localhost
app.use((req, res, next) => {
  const remoteAddress = req.socket.remoteAddress;
  if (remoteAddress !== '127.0.0.1' && remoteAddress !== '::1' && remoteAddress !== '::ffff:127.0.0.1') {
    return res.status(403).json({ error: 'Access denied: Localhost only.' });
  }
  next();
});

const CONFIG = {
  provider: process.env.SYNOX_PROVIDER || 'lmstudio', // 'lmstudio' or 'ollama'
  model: process.env.SYNOX_MODEL || 'qwen2.5-coder:14b',
  lmstudioBaseUrl: process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
};

// GET /health
app.get('/health', async (req, res) => {
  const status = {
    ok: true,
    service: 'synox-local-bridge',
    provider: CONFIG.provider,
    model: CONFIG.model,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };

  try {
    if (CONFIG.provider === 'lmstudio') {
      const resp = await fetch(`${CONFIG.lmstudioBaseUrl}/models`, { signal: AbortSignal.timeout(2000) });
      status.providerOnline = resp.ok;
    } else if (CONFIG.provider === 'ollama') {
      const resp = await fetch(`${CONFIG.ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
      status.providerOnline = resp.ok;
    }
  } catch (err) {
    status.providerOnline = false;
    status.error = err.message;
  }

  res.json(status);
});

// GET /models
app.get('/models', async (req, res) => {
  try {
    if (CONFIG.provider === 'lmstudio') {
      const resp = await fetch(`${CONFIG.lmstudioBaseUrl}/models`);
      const data = await resp.json();
      return res.json(data);
    } else if (CONFIG.provider === 'ollama') {
      const resp = await fetch(`${CONFIG.ollamaBaseUrl}/api/tags`);
      const data = await resp.json();
      return res.json(data);
    }
    res.status(400).json({ error: 'Unsupported provider' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /reason
app.post('/reason', async (req, res) => {
  const { mode, question, context, safety } = req.body;
  const startTime = Date.now();

  if (!safety?.advisoryOnly) {
    return res.status(400).json({ error: 'Bridge only supports advisory-only requests.' });
  }

  const systemPrompt = `You are Matterhorn, the advisory agent for NStep AI. You are powered by Synox context. 
You are a reasoning engine, NOT an execution agent.

CORE RULES:
- Never claim to execute commands, modify files, or deploy.
- Always provide grounded recommendations based on provided context.
- If context is missing or insufficient, state it clearly.
- Maintain a professional, executive tone.

RESPONSE FORMAT:
1. **Direct Answer**: Concise summary.
2. **Evidence**: What Synox sources were used.
3. **Risk & Confidence**: Assess the situation.
4. **Recommended Manual Steps**: Actionable advice for the admin.
5. **Safe Prompt**: (Optional) Text to copy-paste into Codex/Terminal.

CONTEXT SUMMARY:
${context?.summary || 'No context provided.'}

SOURCES USED:
${(context?.sources || []).join(', ')}

SAFETY BOUNDARIES:
- ADVISORY ONLY.
- NO EXECUTION.
- NO REPO MUTATION.
- NO DEPLOYMENT.`;

  try {
    let answer = '';
    if (CONFIG.provider === 'lmstudio') {
      const resp = await fetch(`${CONFIG.lmstudioBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CONFIG.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question }
          ],
          temperature: 0.2
        })
      });
      const data = await resp.json();
      answer = data.choices[0].message.content;
    } else if (CONFIG.provider === 'ollama') {
      const resp = await fetch(`${CONFIG.ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CONFIG.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question }
          ],
          stream: false
        })
      });
      const data = await resp.json();
      answer = data.message.content;
    }

    res.json({
      ok: true,
      provider: CONFIG.provider,
      model: CONFIG.model,
      answer,
      sourcesUsed: context?.sources || [],
      warnings: ['Manual review required'],
      latencyMs: Date.now() - startTime
    });
  } catch (err) {
    console.error('[Bridge Error]', err);
    res.status(502).json({
      ok: false,
      error: 'Bridge provider unavailable',
      details: err.message,
      fallbackRecommended: true
    });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Synox Local Reasoning Bridge active on http://localhost:${PORT}`);
  console.log(`📡 Provider: ${CONFIG.provider} | Model: ${CONFIG.model}`);
});
