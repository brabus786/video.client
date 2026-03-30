# Video Call Client

Frontend for video calls built with Next.js, WebRTC, and Socket.IO.

## Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - type safety
- **Socket.IO Client** - WebSocket communication
- **WebRTC API** - peer-to-peer video/audio

## Installation

```bash
yarn install
```

## Setup

Create a `.env.local` file:

```bash
cp .env.local.example .env.local
```

Set your backend URL and WebRTC credentials in `.env.local`:

```env
NEXT_PUBLIC_API_URL=your_api_url
NEXT_PUBLIC_STUN_URL_1=your_stun_url_1
NEXT_PUBLIC_STUN_URL_2=your_stun_url_2
NEXT_PUBLIC_TURN_URL=your_turn_url
NEXT_PUBLIC_TURN_USERNAME=your_turn_username
NEXT_PUBLIC_TURN_PASSWORD=your_turn_password
```

## Running

### Development
```bash
yarn dev
```
App will open at [http://localhost:3001](http://localhost:3001)

### Production

⚠️ **IMPORTANT:** Do **NOT** use `yarn dev` in production! This will cause WebSocket errors.

```bash
# Build for production
yarn build

# Start production server
yarn start
```

## Usage

### 1. Create a Room

1. Open the main page
2. Click "Create Room"
3. Copy the link
4. Share it with your peer

### 2. Join a Call

1. Open the link from your peer
2. Allow camera/microphone access
3. Wait for the second participant to join

### 3. Call Controls

- **🎤** - Toggle microphone
- **📹** - Toggle camera
- **📞** - End call

## Project Structure

```
app/
├── layout.tsx              # Root layout
├── globals.css             # Global styles
├── page.tsx                # Main page (room creation)
├── page.module.css
└── room/
    └── [token]/
        ├── page.tsx        # Video call page
        └── room.module.css

lib/
├── api.ts                  # REST API client
├── socket.ts               # Socket.IO configuration
└── webrtc.ts               # WebRTC manager
```

## Architecture

### WebRTC Flow

```
User 1                        Server                        User 2
   |                             |                             |
   |------ join-room ----------->|                             |
   |<----- success --------------|                             |
   |                             |<----- join-room ------------|
   |                             |------ success ------------->|
   |                             |                             |
   |                             |------ user-joined ----------|
   |                                                           |
   |------------------ offer (via server) -------------------->|
   |<------------------ answer (via server) -------------------|
   |<------------> ICE candidates exchange <------------------>|
   |                                                           |
   |<=================== P2P Video/Audio =====================>|
```

### Components

**WebRTCManager** (`lib/webrtc.ts`)
- MediaStream management
- SDP (offer/answer) creation/handling
- ICE candidates exchange
- Audio/video track management

**Socket** (`lib/socket.ts`)
- Socket.IO singleton pattern
- Auto-reconnect
- Lifecycle management

**API Client** (`lib/api.ts`)
- REST requests to backend
- Typed responses
- Error handling

## Features

✅ Peer-to-peer video calls  
✅ Microphone/camera control  
✅ Responsive design  
✅ Connection status  
✅ Automatic disconnect handling  
✅ TypeScript typing  

## Production Checklist

- [ ] **Use `npm run build && npm start` instead of `npm run dev`** ⚠️
- [ ] Set the `NEXT_PUBLIC_API_URL` environment variable
- [ ] Test connectivity across different networks
- [ ] Enable HTTPS (required for WebRTC)
- [ ] Optimize bundle size
- [ ] Add error monitoring (e.g., Sentry)
- [ ] Set CSP headers
- [ ] Add tests

## Browser Support

WebRTC is supported in:
- Chrome/Edge 56+
- Firefox 52+
- Safari 11+
- Opera 43+

Mobile browsers:
- Chrome Android
- Safari iOS 11+

## Troubleshooting

### Camera/microphone not working

- Check browser permissions
- HTTPS required (or localhost)
- Close other apps using the camera

### Can't connect to peer

**Works on one computer but not between devices?**

This is a **NAT traversal** issue — you need a TURN server!

**Current state:** Only STUN is used by default

**Debug in console:**
- Check `🧊 ICE connection state`
- If `failed` — TURN server is needed
- Look for `🔥 relay (TURN)` in ICE candidates — means TURN is working

**Other reasons:**
- Make sure both users are online
- Check that the backend is running
- Check server firewall

### Token invalid

- Tokens are valid for 15 minutes
- Create a new room

## License

ISC
