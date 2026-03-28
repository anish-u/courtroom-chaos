# Courtroom Chaos

A real-time multiplayer courtroom game where **Peter Griffin** is the AI judge. Players argue absurd cases using voice while Peter interrupts, laughs, goes on tangents, and delivers hilariously flawed verdicts.

Built with the [Gemini Live API](https://ai.google.dev/gemini-api/docs/live-api) for real-time AI voice interaction.

## How It Works

1. One player creates a room and shares the invite link
2. 3-6 players join the lobby
3. Host starts the game -- roles (Prosecutor, Defense, Defendant, Witnesses, Jury Foreman) are assigned randomly using real player names
4. Peter Griffin (AI) introduces the absurd case, calls on players to speak, interrupts constantly, and runs the entire trial
5. Players speak into their mic when called upon -- all players hear each other and the judge in real time
6. Peter delivers a verdict and scores each player on creativity, persuasiveness, and absurdity

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 8, Tailwind CSS 4, Zustand, Socket.IO Client |
| Backend | Node.js, Express 5, Socket.IO 4, TypeScript |
| AI | Google Gemini Live API (`gemini-3.1-flash-live-preview`), Fenrir voice |
| Audio | Web Audio API (PCM 16kHz capture/playback), real-time bidirectional streaming |

## Setup

### Prerequisites

- Node.js 20+
- A [Google AI Studio](https://aistudio.google.com/apikey) API key with Live API access

### Install & Run

```bash
# Clone and install
git clone <repo-url> && cd courtroom-chaos
cd backend && npm install
cd ../frontend && npm install

# Configure
cp backend/.env.example backend/.env   # or edit backend/.env directly

# Run (two terminals)
cd backend && npm run dev     # http://localhost:3001
cd frontend && npm run dev    # http://localhost:5173
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | -- | Google AI Studio API key (required) |
| `GEMINI_MODEL` | `gemini-3.1-flash-live-preview` | Gemini Live model name |
| `GEMINI_VOICE` | `Fenrir` | Voice preset (Excitable) |
| `GEMINI_CASE_MODEL` | `gemini-2.0-flash` | Text model for AI-generated case blurbs |
| `GEMINI_IMAGE_MODEL` | `imagen-3.0-generate-002` | Case cartoon image (optional; needs Imagen API access) |
| `PORT` | `3001` | Backend port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Frontend origin for CORS |

### Docker

```bash
cp env.example .env             # then set GEMINI_API_KEY
docker compose up --build      # http://localhost:3001
```

Single container -- the Node.js backend serves the compiled React frontend, Socket.IO, and the Gemini Live API all on port 3001.

## Project Structure

```
courtroom-chaos/
├── Dockerfile                    # Multi-stage: frontend build + backend build + production
├── docker-compose.yml
├── env.example
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express + Socket.IO server
│   │   ├── types.ts              # Shared types and enums
│   │   ├── gemini/
│   │   │   └── GeminiLiveProxy.ts  # Gemini Live API WebSocket wrapper
│   │   ├── rooms/
│   │   │   └── RoomManager.ts    # Room lifecycle and reconnection
│   │   ├── game/
│   │   │   ├── GameStateManager.ts # Phase and speaker management
│   │   │   ├── CaseGenerator.ts  # Simple silly cases + optional AI
│   │   │   ├── CaseIllustration.ts # Optional Imagen case cartoon
│   │   │   └── Scorer.ts         # Score parsing and computation
│   │   └── transcript/
│   │       └── TranscriptBuilder.ts
│   └── prompts/
│       └── judge-v1.txt          # Peter Griffin system prompt
├── frontend/
│   └── src/
│       ├── App.tsx               # Routes
│       ├── store/gameStore.ts    # Zustand global state
│       ├── hooks/
│       │   ├── useSocket.ts      # Socket.IO client + reconnect
│       │   ├── useAudioCapture.ts  # Mic → PCM base64
│       │   └── useAudioPlayback.ts # PCM base64 → speaker
│       └── views/
│           ├── LobbyView.tsx     # Create/join room, share link
│           ├── GameView.tsx      # Trial UI, mic, audio playback
│           └── VerdictView.tsx   # Scores and winner
```
