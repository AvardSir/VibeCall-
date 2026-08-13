# VibeCall

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js)
![License](https://img.shields.io/badge/license-MIT-green)

VibeCall is a web application for video conferencing without registration.

Create a room, share a link, and start a call. The application supports video and audio calls, screen sharing, chat, file sharing, device selection, and host controls.

**React · TypeScript · Node.js · Express · Socket.IO · LiveKit Cloud**

Desktop-first · Up to 4 participants · No registration

🔗 **[Video chat without registration (with VPN for Russians, 40-second cold start))](https://vibecall-frontend-9m76.onrender.com/)**


---

## Motivation

I built VibeCall to understand real-time communication systems — SFU architecture, WebRTC media routing, and separating control plane from media plane in a production-like setup, rather than building another CRUD app.

---

## Screenshots

**Landing**
<img width="1920" height="953" alt="image" src="https://github.com/user-attachments/assets/ffe61fe5-83ee-4611-93a2-6221d8147915" />


**Pre-join**
<img width="960" height="961" alt="image" src="https://github.com/user-attachments/assets/a205308f-db3d-482a-8b49-7ad28effa4ff" />

**Video conference**
<img width="1280" height="635" alt="image" src="https://github.com/user-attachments/assets/b64bce5a-08d4-48a3-ab0c-0b34a5ab28a5" />


**Chat and screen sharing**
<img width="1280" height="635" alt="image" src="https://github.com/user-attachments/assets/f2b5b689-77f1-4800-a140-b2215ed8608a" />

<img width="1280" height="635" alt="image" src="https://github.com/user-attachments/assets/6a7701d7-1d10-4092-8681-81dd3c2e6849" />



---

## Features

- Video and audio calls for up to 4 participants
- Rooms without registration
- Shareable room links
- Host and guest roles
- Camera and microphone controls
- Device selection
- Screen sharing
- Real-time text chat
- File sharing
- Host participant management
- Room ending by the host
- Grace period for temporary host disconnections
- Real-time room state synchronization
- English and Russian localization

---

## How It Works

```
Create room
     │
     ▼
Backend creates room and host credentials
     │
     ▼
User receives a shareable room link
     │
     ▼
Participant joins the room
     │
     ▼
Backend validates access and issues a LiveKit token
     │
     ▼
Browser connects directly to LiveKit Cloud
     │
     ▼
Audio / Video / Screen Sharing
```

The backend manages rooms, authorization, lifecycle and control events, while LiveKit Cloud handles WebRTC media.

Media traffic does not pass through the application backend.

---

## Architecture

```
                         ┌─────────────────────┐
                         │       Browser       │
                         │                     │
                         │ React + TypeScript  │
                         │ LiveKit Components  │
                         └──────────┬──────────┘
                                    │
                           HTTP / Socket.IO
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │       Backend       │
                         │                     │
                         │ Node.js + Express   │
                         │ Room management     │
                         │ Authorization       │
                         │ Lifecycle           │
                         └──────────┬──────────┘
                                    │
                           LiveKit Server SDK
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    LiveKit Cloud    │
                         │                     │
                         │     WebRTC / SFU    │
                         └─────────────────────┘
```

| Component | Responsibility |
|---|---|
| React | UI and client-side application state |
| Node.js / Express | Rooms, authorization, tokens and lifecycle |
| Socket.IO | Real-time control-plane events |
| LiveKit Cloud | WebRTC media and SFU |
| Render | Production hosting |

---

## Engineering Highlights

### Control Plane / Media Plane

The application separates application logic from real-time media.

The backend is responsible for:

- room management;
- participant roles;
- authorization;
- LiveKit token generation;
- room lifecycle;
- real-time control events;
- attachment authorization;
- LiveKit webhooks.

LiveKit Cloud is responsible for the actual audio, video and screen-sharing media.

This keeps the application backend independent from WebRTC media routing.

### Room Lifecycle

Rooms have an explicit lifecycle:

```
                         host disconnects
                                │
                                ▼
                           ┌─────────┐
                           │  grace  │
                           └────┬────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
             host reconnects             timeout
                    │                       │
                    ▼                       ▼
                ┌────────┐              ┌────────┐
                │ active │              │ ended  │
                └────────┘              └────────┘
```

A temporary host disconnection does not immediately destroy the room. The backend starts a grace period and synchronizes the countdown with connected clients.

If the host reconnects, the room returns to active. If the timeout expires, the room is ended.

### Real-Time Synchronization

Socket.IO is used for application-level real-time events such as:

- chat messages;
- grace period updates;
- room ending;
- participant removal;
- screen-sharing state.

LiveKit webhooks are used by the backend to react to changes in the actual media room state.

### Access Control

Different credentials are used for different operations:

- **Host token** — authorizes host-only operations.
- **Member token** — identifies a participant and authorizes access to attachments.
- **LiveKit access token** — allows the browser to connect to the media room.

Host credentials are generated using cryptographically secure random values.

### Screen Sharing Coordination

Screen sharing is coordinated through backend room state.

The room tracks the identity of the current screen sharer and prevents multiple participants from starting screen sharing simultaneously.

When the active sharer leaves, the state is cleared based on LiveKit events.

---

## Challenges

- **Host disconnects.** A dropped connection shouldn't kill the room instantly — added a grace-period state machine so temporary disconnects don't end active calls.
- **Screen-share races.** Moved the "who is sharing" decision to backend room state instead of trusting the client, avoiding conflicts between participants.
- **Control vs. media plane.** Delegated WebRTC/SFU work to LiveKit Cloud and kept the backend focused on authorization and lifecycle — simpler to reason about and closer to real production architectures.

---

## Tech Stack

**Frontend**
- React
- TypeScript
- Vite
- Tailwind CSS
- LiveKit Components React SDK
- Socket.IO Client
- react-i18next

**Backend**
- Node.js
- TypeScript
- Express
- Socket.IO
- LiveKit Server SDK
- Zod
- Multer
- Pino

**Infrastructure**
- LiveKit Cloud
- Render
- Docker
- GitHub

---

## Local Development

### Requirements

- Node.js 22+
- Docker
- Docker Compose

### Run

```bash
docker compose up --build
```

Local services:

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:3000 |
| LiveKit | ws://localhost:7880 |

Local development uses a self-hosted LiveKit instance running through Docker Compose.

Environment variables are provided in the project's `.env.example` files.

---

## Production

The current production architecture is:

```
GitHub
   │
   ▼
Render
   ├── Frontend
   │
   └── Backend
          │
          ▼
     LiveKit Cloud
```

**Frontend** — deployed as a Render Static Site.

**Backend** — deployed as a Docker service on Render.

**LiveKit** — Production uses LiveKit Cloud for WebRTC media infrastructure. The browser connects to LiveKit directly, while the backend provides authorization and access tokens.

### Deployment Flow

```
Push to GitHub
      │
      ▼
   Render
      │
      ├── Build frontend
      └── Build and deploy backend
```

The current deployment does not use the previous GitLab-based deployment pipeline.

---

## API

Main room endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/rooms` | Create a room |
| GET | `/rooms/:roomId` | Get room status |
| POST | `/rooms/:roomId/join` | Join a room |
| POST | `/rooms/:roomId/end` | End a room |
| POST | `/rooms/:roomId/remove` | Remove a participant |
| POST | `/rooms/:roomId/attachments` | Upload an attachment |

---

## Limitations

The current version is intentionally scoped as an MVP:

- Maximum 4 participants per room
- Desktop-first interface
- Room state is stored in memory
- Active rooms are lost after a backend restart
- File storage depends on backend persistent storage
- Production media infrastructure depends on LiveKit Cloud

These are deliberate scope and architecture trade-offs for the current version.

---

## Project Structure

```
VibeCall/
│
├── backend/
│   └── src/
│       ├── routes/
│       │   └── rooms/
│       ├── attachments.ts
│       ├── chat.ts
│       ├── config.ts
│       ├── grace.ts
│       ├── identity.ts
│       ├── livekitAdmin.ts
│       ├── livekitTokens.ts
│       ├── rooms.ts
│       ├── socket.ts
│       ├── webhooks.ts
│       ├── app.ts
│       └── server.ts
│
├── frontend/
│   └── src/
│       ├── features/
│       │   ├── call/
│       │   ├── chat/
│       │   ├── preferences/
│       │   ├── prejoin/
│       │   └── room-states/
│       ├── pages/
│       └── shared/
│
├── docs/
│   └── screenshots/
│
├── docker-compose.yml
└── package.json
```

---
