import { GoogleGenAI } from '@google/genai';
import { CaseDetails } from '../types';

const CASE_POOL: CaseDetails[] = [
  {
    defendant: 'Gerald "The Goose" McHonkington',
    crime: 'Grand Theft Birdseed from the Municipal Park Reserve',
    evidence: ['A beak-shaped crowbar', 'Feathers found at the scene', 'A signed confession written in honking notation'],
  },
  {
    defendant: 'Professor Bartholomew Crumpet III',
    crime: 'Illegally operating a time machine without a license',
    evidence: ['A suspiciously ticking briefcase', 'A newspaper from 2087', 'A parking ticket from Ancient Rome'],
  },
  {
    defendant: 'Señorita Margarita Pizzazz',
    crime: 'Smuggling unlicensed dance moves across state lines',
    evidence: ['A suitcase full of choreography notes', 'Surveillance footage of suspicious moonwalking', 'Witness testimony from a traumatized DJ'],
  },
  {
    defendant: 'Captain Reginald Socksworth',
    crime: 'Operating a pirate ship in a public swimming pool',
    evidence: ['A miniature Jolly Roger flag', 'Pool floaties converted into cannons', 'A treasure map drawn on a swim noodle'],
  },
  {
    defendant: 'Dr. Waffles McFluffington',
    crime: 'Performing unlicensed brain surgery on a teddy bear',
    evidence: ['A teddy bear with a suspicious zipper', 'Cotton ball forensic evidence', 'A diploma from "Stuffed Animal Medical School"'],
  },
];

function pickFromPool(): CaseDetails {
  const index = Math.floor(Math.random() * CASE_POOL.length);
  return { ...CASE_POOL[index] };
}

export async function generateCase(): Promise<CaseDetails> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[CaseGenerator] No GEMINI_API_KEY, falling back to pool');
    return pickFromPool();
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: `Invent ONE absurd, hilarious courtroom case. Be wildly creative and random every time — never repeat themes.

Return ONLY valid JSON (no markdown fences) matching this shape:
{
  "defendant": "A fictional name with a funny title or nickname",
  "crime": "A completely absurd crime described in one sentence",
  "evidence": ["piece 1", "piece 2", "piece 3"]
}`,
    });

    const text = response.text?.trim();
    if (!text) throw new Error('Empty response');

    const parsed = JSON.parse(text);
    if (
      typeof parsed.defendant === 'string' &&
      typeof parsed.crime === 'string' &&
      Array.isArray(parsed.evidence) &&
      parsed.evidence.length >= 1
    ) {
      console.log('[CaseGenerator] AI-generated case:', parsed.defendant);
      return {
        defendant: parsed.defendant,
        crime: parsed.crime,
        evidence: parsed.evidence.slice(0, 3).map(String),
      };
    }

    throw new Error('Invalid shape from Gemini');
  } catch (err) {
    console.warn('[CaseGenerator] AI generation failed, falling back to pool:', err);
    return pickFromPool();
  }
}
