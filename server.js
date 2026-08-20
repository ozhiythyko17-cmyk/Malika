require('dotenv').config();

const express = require('express');
const twilio = require('twilio');
const Anthropic = require('@anthropic-ai/sdk');

const PORT = process.env.PORT || 3000;
const MAX_HISTORY_MESSAGES = 20;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Malika, an AI agent handling sales admin and customer service over WhatsApp.
Be concise, friendly, and helpful. Reply in the same language the customer uses.`;

// conversationsByPhone: WhatsApp number -> array of {role, content} turns
const conversationsByPhone = new Map();

const app = express();
app.use(express.urlencoded({ extended: false }));

app.post(
  '/webhook/whatsapp',
  twilio.webhook({ validate: process.env.NODE_ENV === 'production' }),
  async (req, res) => {
    const from = req.body.From;
    const incomingText = (req.body.Body || '').trim();
    const twiml = new twilio.twiml.MessagingResponse();

    if (!from || !incomingText) {
      res.type('text/xml').send(twiml.toString());
      return;
    }

    const history = conversationsByPhone.get(from) || [];
    history.push({ role: 'user', content: incomingText });

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: history,
      });

      const replyText = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim() || 'Maaf, saya belum bisa memproses pesan itu.';

      history.push({ role: 'assistant', content: replyText });
      conversationsByPhone.set(from, history.slice(-MAX_HISTORY_MESSAGES));

      twiml.message(replyText);
    } catch (err) {
      console.error('Claude API error:', err);
      twiml.message('Maaf, terjadi kendala teknis. Coba lagi sebentar lagi ya.');
    }

    res.type('text/xml').send(twiml.toString());
  }
);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Malika WhatsApp webhook listening on port ${PORT}`);
});
