import { GoogleGenAI } from '@google/genai';
import { CaseDetails } from '../types';

const CASE_POOL: CaseDetails[] = [
  {
    defendant: 'The Fridge Raider',
    crime: 'stealing the last slice of birthday cake from the office fridge',
    evidence: ['Chocolate fingerprints on the Tupperware', 'A sticky note that says "not yours"', 'Security cam catching someone in socks'],
  },
  {
    defendant: 'Captain Stinkfoot',
    crime: 'farting too much during a two-hour elevator ride',
    evidence: ['A can of air freshener used as a weapon', 'Witnesses crying', 'The elevator still marked as a hazmat zone'],
  },
  {
    defendant: 'Aunt Karen\'s Nephew',
    crime: 'using all the hot water so everyone else had cold showers for a week',
    evidence: ['A 45-minute shower playlist', 'Fogged-up bathroom mirror selfies', 'The water bill'],
  },
  {
    defendant: 'Wi-Fi Leech',
    crime: 'never paying for internet but using the neighbor\'s password for three years',
    evidence: ['Router logs at 3 AM', 'A thank-you note that was sarcastic', 'Streaming in 4K from their garage'],
  },
  {
    defendant: 'The Remote Hog',
    crime: 'hiding the TV remote during the big game',
    evidence: ['Couch cushions surgically opened', 'Batteries in the cereal box', 'Smug face during commercials'],
  },
  {
    defendant: 'Laundry Looter',
    crime: 'taking someone else\'s socks from the dryer and wearing them',
    evidence: ['One neon sock that isn\'t theirs', 'Lint as DNA', 'Instagram story "new drip"'],
  },
  {
    defendant: 'Snack Smuggler',
    crime: 'bringing loud crunchy chips to a library study session',
    evidence: ['Decibel readings', 'A trail of crumbs to their desk', 'Empty bag rustled on purpose'],
  },
  {
    defendant: 'Playlist Tyrant',
    crime: 'playing the same song on repeat for an entire road trip',
    evidence: ['Bluetooth history', 'Cousin\'s tears', 'The song is still stuck in everyone\'s head'],
  },
  {
    defendant: 'Thermostat Villain',
    crime: 'cranking the heat to 85 because "sweater weather is a mindset"',
    evidence: ['Sweating houseplants', 'Ice cubes melting in the freezer', 'The electric bill'],
  },
  {
    defendant: 'Leftover Bandit',
    crime: 'eating someone\'s labeled leftovers that clearly said "DO NOT TOUCH"',
    evidence: ['Empty container in the trash', 'Lies about "I thought it was communal"', 'Sauce on their chin'],
  },
  {
    defendant: 'Group Chat Menace',
    crime: 'sending 200 "good morning" stickers before 7 AM',
    evidence: ['Phone notifications as evidence', 'Coworkers with eye twitch', 'Mute button abuse'],
  },
  {
    defendant: 'Parking Spot Thief',
    crime: 'taking the spot someone was clearly waiting for with their blinker on',
    evidence: ['Dash cam drama', 'Honking symphony', 'Passive-aggressive note under the wiper'],
  },
  {
    defendant: 'Dishwasher Dodger',
    crime: 'leaving one fork in the sink for six months to avoid rotation duty',
    evidence: ['The fork has a name now', 'Roommate spreadsheet', 'Archaeological carbon dating of the cereal bowl'],
  },
  {
    defendant: 'Movie Spoiler',
    crime: 'yelling the twist ending in the theater lobby',
    evidence: ['Popcorn thrown as projectiles', 'Banned from the multiplex', 'Group chat exile'],
  },
  {
    defendant: 'Plant Neglecter Turned Overwaterer',
    crime: 'killing the office plant by "loving it too much" with daily floods',
    evidence: ['Muddy desk', 'A eulogy sticky note', 'The succulent is now soup'],
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
      model: process.env.GEMINI_CASE_MODEL || 'gemini-2.5-flash',
      contents: `Invent ONE silly, easy-to-understand dispute for a comedy courtroom. Keep it SHORT and relatable — everyday situations (roommates, office, family, neighbors, pets, food, bathrooms, Wi‑Fi, TV remote). Weird but obvious in one sentence. No elaborate lore, no sci‑fi, no epic fantasy.

Return ONLY valid JSON (no markdown fences):
{
  "defendant": "A short funny nickname or title for the accused (not a long name)",
  "crime": "One plain sentence: what they are accused of doing",
  "evidence": ["simple joke evidence 1", "simple joke evidence 2", "simple joke evidence 3"]
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
