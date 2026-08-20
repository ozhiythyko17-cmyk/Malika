# Malika
AI Agent for sales admin and Customer Service

## WhatsApp integration (Twilio + Claude)

This connects a WhatsApp number to Claude (Anthropic API) using Twilio as the WhatsApp gateway.
Every incoming WhatsApp message is sent to Claude, and the reply is sent back automatically.

### 1. Prerequisites

- Node.js 18+
- A [Twilio account](https://www.twilio.com/try-twilio) (free trial works for testing)
- An [Anthropic API key](https://console.anthropic.com/)

### 2. Set up the Twilio WhatsApp Sandbox (for testing)

1. In the [Twilio Console](https://console.twilio.com/), go to **Messaging → Try it out → Send a WhatsApp message**.
2. You'll get a sandbox number (e.g. `+1 415 523 8886`) and a join code like `join <two-words>`.
3. From your own WhatsApp, send that join code to the sandbox number to link your phone to the sandbox.
4. Note your **Account SID** and **Auth Token** from the Console dashboard.

For production, apply for a WhatsApp Business sender under **Messaging → Senders** instead of the sandbox.

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

```
ANTHROPIC_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
```

### 4. Install and run

```bash
npm install
npm start
```

This starts a webhook server on `http://localhost:3000/webhook/whatsapp`.

### 5. Expose the webhook and connect it to Twilio

Twilio needs a public HTTPS URL to reach your server. For local testing, use a tunnel like `ngrok`:

```bash
ngrok http 3000
```

Copy the `https://...ngrok...` URL, then in the Twilio Console:

1. Go to **Messaging → Try it out → Send a WhatsApp message → Sandbox settings**.
2. Set **"When a message comes in"** to `https://<your-ngrok-url>/webhook/whatsapp`, method `POST`.
3. Save.

Now send a WhatsApp message to the sandbox number — Claude will reply.

### 6. Deploying

Deploy `server.js` to any Node host (Railway, Render, Fly.io, a VPS, etc.), set the same environment
variables there, and point the Twilio webhook at your deployed URL instead of ngrok. Set
`NODE_ENV=production` so incoming requests are validated as genuinely coming from Twilio.

### Notes

- Conversation history is kept in memory per phone number and is lost on server restart. Swap
  `conversationsByPhone` in `server.js` for a database (e.g. Redis/Postgres) for persistence across
  restarts and multiple server instances.
- The system prompt in `server.js` (`SYSTEM_PROMPT`) is where you tune Malika's tone and behavior as a
  sales admin / customer service agent.
