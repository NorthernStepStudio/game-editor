# Synox Local Reasoning Bridge

This bridge connects **Matterhorn** and **Studio Intelligence** to local AI models for grounded reasoning without sending operational data to third-party cloud providers (optional fallback to Gemini remains).

## Prerequisites

- **LM Studio** (Recommended) or **Ollama**
- Local model downloaded (e.g., `qwen2.5-coder:14b` or `llama3.1:8b`)

## Setup

1. **Configure Environment**:
   Create a `.env` file in this directory based on `.env.example`.

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Bridge**:
   ```bash
   npm start
   ```

The bridge will listen on `http://localhost:3010` by default.

## Safety & Boundaries

- **Localhost Only**: The server only binds to `127.0.0.1`.
- **Advisory Only**: Matterhorn cannot execute commands or modify files through this bridge.
- **No Persistence**: The bridge does not store chat history or secrets.

## API Endpoints

- `GET /health`: Check service and provider status.
- `GET /models`: List available models from the provider.
- `POST /reason`: Generate grounded advisory reasoning.

## Troubleshooting

- **Provider Offline**: Ensure LM Studio or Ollama server is running.
- **Connection Refused**: Check if the port matches `SYNOX_BRIDGE_PORT`.
- **Latency**: Large models may take several seconds to respond locally.
