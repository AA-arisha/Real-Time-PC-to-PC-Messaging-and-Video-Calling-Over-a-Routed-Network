# Real-Time PC-to-PC Messaging and Video Calling

A full-stack real-time communication application that allows users to join with a username, exchange private text messages, and make one-to-one video calls over a network. The React frontend communicates with the Node.js backend through Socket.IO, while browser-to-browser media is established with WebRTC.

## Features

- Real-time online-user presence
- Username-based network joining
- Private text messaging between selected users
- Incoming-call notifications
- Browser camera and microphone access
- One-to-one video and audio calling
- WebRTC ICE candidate exchange
- Call accept, decline, and end controls
- Connection and call error feedback

## Tech Stack

### Frontend

- React 19
- Vite
- Socket.IO Client
- WebRTC and browser `getUserMedia`
- Google STUN server
- ESLint

### Backend

- Node.js
- Express
- Socket.IO
- CORS
- dotenv
- Nodemon

## Project Structure

```text
Pc_communication/
├── backend/
│   ├── src/
│   │   └── server.js
│   └── package.json
└── frontend/
    ├── public/
    ├── src/
    │   ├── services/
    │   │   └── socket.js
    │   ├── App.jsx
    │   └── main.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## How It Works

### Messaging

1. A user enters a username and connects to the Socket.IO server.
2. The backend registers the socket and broadcasts the current online-user list.
3. Users select another online user and send text messages.
4. The backend validates the recipient and message, then sends the message to that socket only.

### Video Calling

1. The caller requests camera and microphone access.
2. A `RTCPeerConnection` creates a WebRTC offer.
3. The offer and ICE candidates are relayed through Socket.IO.
4. The receiving browser creates an answer and exchanges ICE candidates.
5. Browser media streams are displayed through the local and remote `<video>` elements.

The signaling server does not carry audio or video data. Media is exchanged directly between browsers using WebRTC.

## Prerequisites

- Node.js 18 or later
- npm
- A modern browser with WebRTC support
- Camera and microphone access

Camera and microphone access is only allowed on `localhost` or an HTTPS origin.

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/AA-arisha/Real-Time-PC-to-PC-Messaging-and-Video-Calling-Over-a-Routed-Network.git
cd Real-Time-PC-to-PC-Messaging-and-Video-Calling-Over-a-Routed-Network
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Install frontend dependencies

Open another terminal:

```bash
cd frontend
npm install
```

### 4. Configure the frontend server URL

Create `frontend/.env`:

```env
VITE_SERVER_URL=http://localhost:5000
```

If the backend runs on another computer or is exposed on a routed network, set this to that server's reachable address:

```env
VITE_SERVER_URL=http://192.168.1.100:5000
```

The current backend Socket.IO CORS configuration allows the deployed frontend origin:

```text
https://real-time-pc-to-pc-messaging-and-vi.vercel.app
```

For local or LAN development, update the `origin` value in `backend/src/server.js` to include the frontend origin, such as `http://localhost:5173` or your LAN frontend URL.

### 5. Start the backend

```bash
cd backend
npm run dev
```

The backend starts on port `5000` by default and listens on `0.0.0.0`.

Verify it in a browser:

```text
http://localhost:5000
```

### 6. Start the frontend

In another terminal:

```bash
cd frontend
npm run dev
```

Open the Vite URL printed in the terminal, usually:

```text
http://localhost:5173
```

Open the app in two browser tabs or on two devices. Enter different usernames, connect, select a user, and start chatting or calling.

## Environment Variables

### Backend

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | No | `5000` | HTTP and Socket.IO server port |

### Frontend

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_SERVER_URL` | Yes | Reachable URL of the backend Socket.IO server |

## Available Scripts

### Backend

From `backend/`:

```bash
npm run dev    # Start with Nodemon
npm start      # Start with Node.js
```

### Frontend

From `frontend/`:

```bash
npm run dev     # Start Vite development server
npm run build   # Create production build
npm run preview # Preview the production build
npm run lint    # Run ESLint
```

## Socket.IO Events

| Event | Direction | Purpose |
| --- | --- | --- |
| `register-user` | Client -> Server | Register a username and socket |
| `users-updated` | Server -> Client | Broadcast the online-user list |
| `send-message` | Client -> Server | Send a text message |
| `receive-message` | Server -> Client | Deliver an incoming message |
| `message-sent` | Server -> Sender | Confirm a sent message |
| `message-error` | Server -> Client | Report recipient or message validation errors |
| `call-user` | Client -> Server | Send a WebRTC offer |
| `incoming-call` | Server -> Client | Notify a recipient of an incoming call |
| `answer-call` | Client -> Server | Send a WebRTC answer |
| `call-answered` | Server -> Caller | Deliver the call answer |
| `ice-candidate` | Bidirectional | Exchange WebRTC network candidates |
| `call-ended` | Server -> Client | Notify a peer that the call ended |
| `call-error` | Server -> Client | Report call validation or signaling errors |

## Routed Network and Firewall Notes

The backend listens on all network interfaces, so it can be reached across a LAN or routed network. Ensure:

- Both clients can reach the backend IP and port.
- The backend port is allowed by Windows Firewall or another firewall.
- The browser can access the frontend through `localhost` or HTTPS.
- Devices are on networks that permit peer-to-peer WebRTC traffic.

WebRTC uses the Google STUN server for public network discovery. It does not include a TURN server, so a direct peer connection may fail when peers are behind restrictive NATs or symmetric firewalls.

## Deployment

The repository appears configured for a Vercel-hosted frontend and a separately hosted backend. The deployed frontend must set:

```env
VITE_SERVER_URL=<your-deployed-backend-url>
```

Before deploying, update the backend Socket.IO CORS origin if the frontend URL or domain changes. The backend also requires a reachable public port or hosting platform that supports WebSockets.

## Data and Security Notes

- Online users and chat messages are held in memory.
- Messages and user presence are lost when the backend restarts.
- There is no database, authentication, user persistence, or end-to-end encryption.
- This project is suitable as a networking demonstration or prototype, not a production messaging service.
