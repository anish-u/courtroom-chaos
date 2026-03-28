import { GoogleGenAI, Session, LiveConnectConfig, Modality } from '@google/genai';
import { JudgeMood, RoomState, CaseDetails, Role } from '../types';
import { TranscriptBuilder } from '../transcript/TranscriptBuilder';
import fs from 'fs';
import path from 'path';

export interface GeminiProxyCallbacks {
  onAudio: (base64Audio: string) => void;
  onText: (text: string) => void;
  onMoodChange: (mood: JudgeMood) => void;
  onScoreBlock: (text: string) => void;
  onSpeakerCall: (role: Role) => void;
  onReady: () => void;
  onError: (error: Error) => void;
}

export class GeminiLiveProxy {
  private ai: GoogleGenAI;
  private session: Session | null = null;
  private model: string;
  private voice: string;
  private callbacks: GeminiProxyCallbacks;
  private transcript: TranscriptBuilder;
  private currentMood: JudgeMood = JudgeMood.NEUTRAL;
  private accumulatedText: string = '';
  private isConnected: boolean = false;
  private isSetupComplete: boolean = false;
  private reconnectAttempted: boolean = false;
  private caseDetails: CaseDetails | null = null;
  private room: RoomState | null = null;

  constructor(
    apiKey: string,
    model: string,
    voice: string,
    callbacks: GeminiProxyCallbacks,
    transcript: TranscriptBuilder
  ) {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
    this.voice = voice;
    this.callbacks = callbacks;
    this.transcript = transcript;
  }

  async connect(caseDetails: CaseDetails, room: RoomState): Promise<void> {
    this.caseDetails = caseDetails;
    this.room = room;
    this.isSetupComplete = false;
    const systemPrompt = this.loadSystemPrompt(caseDetails, room);

    console.log('[GeminiLive] Connecting to model:', this.model);
    console.log('[GeminiLive] System prompt length:', systemPrompt.length);

    const config: LiveConnectConfig = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: this.voice,
          },
        },
      },
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      outputAudioTranscription: {},
    };

    try {
      this.session = await this.ai.live.connect({
        model: this.model,
        config,
        callbacks: {
          onopen: () => {
            this.isConnected = true;
            console.log('[GeminiLive] WebSocket opened');
          },
          onmessage: (msg: any) => {
            this.handleMessage(msg);
          },
          onerror: (err: any) => {
            console.error('[GeminiLive] WebSocket error:', err?.message || err);
            this.callbacks.onError(new Error(String(err?.message || err)));
          },
          onclose: (ev: any) => {
            this.isConnected = false;
            this.isSetupComplete = false;
            console.log('[GeminiLive] WebSocket closed. Code:', ev?.code, 'Reason:', ev?.reason || '(none)');
            this.attemptReconnect();
          },
        },
      });
      console.log('[GeminiLive] Session object created');
    } catch (err: any) {
      console.error('[GeminiLive] Connection failed:', err?.message || err);
      throw err;
    }
  }

  sendAudio(base64Chunk: string): void {
    if (!this.session || !this.isConnected || !this.isSetupComplete) return;

    try {
      this.session.sendRealtimeInput({
        audio: {
          data: base64Chunk,
          mimeType: 'audio/pcm;rate=16000',
        },
      });
    } catch (err: any) {
      console.error('[GeminiLive] Send audio error:', err?.message || err);
    }
  }

  sendText(text: string): void {
    if (!this.session || !this.isConnected || !this.isSetupComplete) return;

    console.log('[GeminiLive] Sending text:', text.substring(0, 80));
    try {
      this.session.sendRealtimeInput({ text });
    } catch (err: any) {
      console.error('[GeminiLive] Send text error:', err?.message || err);
    }
  }

  private handleMessage(msg: any): void {
    // Setup complete -- session is ready to use
    if (msg.setupComplete) {
      this.isSetupComplete = true;
      console.log('[GeminiLive] Setup complete -- session ready');
      this.callbacks.onReady();
      return;
    }

    // GoAway -- server is about to close the connection
    if (msg.goAway) {
      console.log('[GeminiLive] GoAway received, time left:', msg.goAway.timeLeft);
      return;
    }

    // Tool calls (not used but log for debugging)
    if (msg.toolCall) {
      console.log('[GeminiLive] Tool call received (not handled):', JSON.stringify(msg.toolCall).substring(0, 200));
      return;
    }

    // Server content -- audio, text, transcriptions
    if (msg.serverContent) {
      const sc = msg.serverContent;

      // Model turn with parts (audio and/or text)
      if (sc.modelTurn?.parts) {
        for (const part of sc.modelTurn.parts) {
          if (part.inlineData?.data) {
            this.callbacks.onAudio(part.inlineData.data);
          }
          if (part.text) {
            this.accumulatedText += part.text;
            this.callbacks.onText(part.text);
            this.detectMoodChange(part.text);
            this.detectSpeakerCall(part.text);
            this.detectScoreBlock(this.accumulatedText);
          }
        }
      }

      // Output transcription (model's speech as text)
      if (sc.outputTranscription?.text) {
        const text = sc.outputTranscription.text;
        this.accumulatedText += text;
        this.callbacks.onText(text);
        this.detectMoodChange(text);
        this.detectSpeakerCall(text);
        this.detectScoreBlock(this.accumulatedText);
      }

      // Input transcription (user's speech as text -- for logging)
      if (sc.inputTranscription?.text) {
        console.log('[GeminiLive] User said:', sc.inputTranscription.text);
      }

      // Turn complete
      if (sc.turnComplete) {
        console.log('[GeminiLive] Turn complete');
      }
    }
  }

  private detectMoodChange(text: string): void {
    const moodMatch = text.match(/MOOD:(NEUTRAL|IMPRESSED|SCEPTICAL|OUTRAGED|AMUSED)/);
    if (moodMatch) {
      const mood = moodMatch[1] as JudgeMood;
      if (mood !== this.currentMood) {
        this.currentMood = mood;
        this.callbacks.onMoodChange(mood);
      }
    }
  }

  private detectSpeakerCall(text: string): void {
    const callMatch = text.match(/CALL:(PROSECUTOR|DEFENSE|DEFENDANT|WITNESS_1|WITNESS_2|JURY_FOREMAN)/);
    if (callMatch) {
      this.callbacks.onSpeakerCall(callMatch[1] as Role);
    }
  }

  private detectScoreBlock(text: string): void {
    if (text.includes('###SCORE_START###') && text.includes('###SCORE_END###')) {
      this.callbacks.onScoreBlock(text);
      this.accumulatedText = '';
    }
  }

  private loadSystemPrompt(caseDetails: CaseDetails, room: RoomState): string {
    const promptPath = process.env.JUDGE_PROMPT_PATH || './prompts/judge-v1.txt';
    let prompt: string;

    try {
      prompt = fs.readFileSync(path.resolve(promptPath), 'utf-8');
    } catch {
      prompt = this.getDefaultPrompt();
    }

    const byRole = (role: Role) =>
      room.players.find(p => p.role === role)?.name ?? 'N/A';

    const witness1 = room.players.find(p => p.role === Role.WITNESS_1);
    const witness2 = room.players.find(p => p.role === Role.WITNESS_2);
    const foreman = room.players.find(p => p.role === Role.JURY_FOREMAN);

    const witnessLine = [
      witness1 ? `Witness 1: ${witness1.name}` : '',
      witness2 ? `Witness 2: ${witness2.name}` : '',
    ].filter(Boolean).join('\n');

    const foremanLine = foreman ? `Jury Foreman: ${foreman.name}` : '';

    return prompt
      .replace(/\{\{DEFENDANT\}\}/g, caseDetails.defendant)
      .replace(/\{\{PROSECUTOR\}\}/g, byRole(Role.PROSECUTOR))
      .replace(/\{\{DEFENSE\}\}/g, byRole(Role.DEFENSE))
      .replace('{{WITNESS_LINE}}', witnessLine)
      .replace('{{FOREMAN_LINE}}', foremanLine)
      .replace('{{CRIME}}', caseDetails.crime)
      .replace('{{EVIDENCE}}', caseDetails.evidence.join('; '));
  }

  private getDefaultPrompt(): string {
    return `You are Peter Griffin from Family Guy, appointed as a judge. You talk exactly like Peter — catchphrases, tangents, "hehehehe" laughs.

CASE: {{DEFENDANT}} is charged with {{CRIME}}.
Prosecutor: {{PROSECUTOR}}. Defense Attorney: {{DEFENSE}}.
{{WITNESS_LINE}}
{{FOREMAN_LINE}}
EVIDENCE: {{EVIDENCE}}

Always use the players' REAL NAMES. Never invent character names.
You MUST use CALL:ROLE_NAME to designate who speaks next (e.g. CALL:PROSECUTOR).
Use MOOD:STATE when your mood changes.
Emit ###SCORE_START### and ###SCORE_END### for scoring at the end.
BEGIN by introducing yourself as Judge Peter Griffin and the case.`;
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempted || !this.caseDetails || !this.room) return;
    this.reconnectAttempted = true;

    console.log('[GeminiLive] Will attempt reconnect in 3s...');
    setTimeout(async () => {
      try {
        await this.connect(this.caseDetails!, this.room!);
        this.reconnectAttempted = false;
        console.log('[GeminiLive] Reconnected successfully');
      } catch (err: any) {
        console.error('[GeminiLive] Reconnect failed:', err?.message || err);
        this.callbacks.onError(new Error('Gemini reconnect failed'));
      }
    }, 3000);
  }

  async disconnect(): Promise<void> {
    this.reconnectAttempted = true; // prevent reconnect after intentional disconnect
    if (this.session) {
      try {
        this.session.close();
      } catch {
        // ignore close errors
      }
      this.session = null;
      this.isConnected = false;
      this.isSetupComplete = false;
    }
  }

  getIsConnected(): boolean {
    return this.isConnected && this.isSetupComplete;
  }

  resetAccumulatedText(): void {
    this.accumulatedText = '';
  }
}
