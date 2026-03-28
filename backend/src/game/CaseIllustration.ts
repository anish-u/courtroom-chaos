import { GoogleGenAI } from '@google/genai';
import { CaseDetails } from '../types';

/**
 * Gemini native image generation (Nano Banana / Gemini 3 image models).
 * @see https://ai.google.dev/gemini-api/docs/image-generation#javascript
 */
export async function generateCaseIllustration(
  apiKey: string,
  model: string,
  details: CaseDetails
): Promise<{ dataUrl: string } | { error: string }> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = [
      'Single cartoon illustration: bold black outlines, flat bright colors, simple exaggerated shapes,',
      'suburban American animated sitcom comedy style (generic cartoon people, not any specific TV show characters).',
      'PG-13, comedic, no readable text in the image.',
      `Scene inspired by this silly dispute: someone accused of "${details.crime}".`,
      `Alleged culprit vibe: ${details.defendant}.`,
      `Silly props suggesting: ${details.evidence.join('; ')}.`,
      'Wide 16:9 style composition, courtroom or living-room chaos.',
    ].join(' ');

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: '16:9',
          imageSize: '1K',
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts?.length) {
      return { error: 'No image candidates (check GEMINI_IMAGE_MODEL and API access)' };
    }

    let lastNonThought: { mime: string; b64: string } | null = null;
    let lastAny: { mime: string; b64: string } | null = null;

    for (const part of parts) {
      const data = part.inlineData?.data;
      if (!data) continue;
      const mime = part.inlineData?.mimeType || 'image/png';
      lastAny = { mime, b64: data };
      if (!part.thought) {
        lastNonThought = { mime, b64: data };
      }
    }

    const picked = lastNonThought ?? lastAny;
    if (!picked) {
      return { error: 'No inline image in response (model may have returned text only)' };
    }

    return { dataUrl: `data:${picked.mime};base64,${picked.b64}` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}
