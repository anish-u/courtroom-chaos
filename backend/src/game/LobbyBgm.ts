import { GoogleGenAI } from '@google/genai';

const LOBBY_BGM_PROMPT = [
  'Create a 30-second instrumental background track for a comedic courtroom waiting room.',
  'Light tension, subtle pizzicato strings and soft woodwinds, steady mid-tempo around 90 BPM,',
  'slightly quirky legal-drama mood, not dark or scary.',
  'Even energy throughout so it can loop smoothly. Instrumental only, no vocals.',
].join(' ');

let cached: Buffer | null = null;
let inflight: Promise<Buffer> | null = null;

async function generateLobbyBgmBytes(): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const model = process.env.GEMINI_BGM_MODEL || 'lyria-3-clip-preview';
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: LOBBY_BGM_PROMPT,
    config: {
      responseModalities: ['AUDIO', 'TEXT'],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts?.length) {
    throw new Error('Lyria returned no content parts');
  }

  let audioB64: string | null = null;
  for (const part of parts) {
    const data = part.inlineData?.data;
    if (data) audioB64 = data;
  }

  if (!audioB64) {
    throw new Error('Lyria response had no audio inline data');
  }

  return Buffer.from(audioB64, 'base64');
}

/** Single in-process cache + single-flight generation for lobby BGM (Lyria 3 Clip). */
export function getOrGenerateLobbyBgm(): Promise<Buffer> {
  if (cached) {
    return Promise.resolve(cached);
  }
  if (inflight) {
    return inflight;
  }

  inflight = generateLobbyBgmBytes()
    .then((buf) => {
      cached = buf;
      return buf;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
