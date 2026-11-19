# Voxel Strike - 3D Voxel Multiplayer FPS (.io Style)

A high-performance, fast-paced browser 3D voxel multiplayer FPS and community map platform inspired by **Krunker.io**, **Kirka.io**, and **Protox.io**.

---

## 🚀 Key Features Across All 6 Phases

1. **Local Player & Voxel Engine (Phase 1)**
   - Custom swept-AABB collision detection vs voxel block grid with 0.55m stair auto-step.
   - Mikola Lysenko greedy meshing combining coplanar faces across X, Y, Z (85-92% triangle reduction).
   - Dynamic chunk loading and dirty-chunk-only re-meshing.
   - Zero-allocation Quake/Krunker movement physics (air-acceleration, slide boosts, consecutive bunny-hopping).
   - Procedural Web Audio API sound effects (no external WAV/MP3 files required).

2. **Authoritative Server & Network Architecture (Phase 2)**
   - Fixed 60Hz server tick loop (`Node.js` + `ws`).
   - Client-side prediction with sequence-numbered input buffer.
   - Server reconciliation replay on state mismatch (0.0000m convergence drift).
   - Remote entity snapshot interpolation (70ms buffer, hermite/lerp blending) with animated 3D voxel avatars.
   - Synchronized real-time voxel world editing.

3. **Competitive Combat System (Phase 3)**
   - Complete hitscan arsenal: **Assault Rifle**, **Sniper Rifle** (with ADS zoom scope), **Shotgun** (8-pellet cone spread), and **Combat Pistol**.
   - Server-side lag compensation with 60-tick historical buffer rewind & headshot/bodyshot hitbox testing.
   - First-person 3D voxel viewmodels with procedural sway, recoil kickback, and reload animations.
   - Instant 3D bullet tracer beams, spark impact debris, audio-visual hitmarkers, and live esports kill feed.

4. **Protox.io Mapmaker & Gameplay Sandbox (https://mapmaker.protox.io/ Parity)**
   - **Dual-Mode System**: Instant switch between **Builder Free-Fly Mode** (noclip 3D camera with `Q`/`E` elevation and `Shift` boost) and **FPS Playtest Mode** (`H` key).
   - **Interactive Gameplay Blocks**:
     - 🚀 **Jump Pads**: High vertical spring launch impulse ($19.5\text{m/s}$) with synthesized audio swoosh.
     - ⚡ **Speed Boost Pads**: Horizontal speed surge corridors (up to $28\text{m/s}$).
     - 🔥 **Hazard Lava**: Boiling molten blocks with burn contact detection and sizzle audio.
     - 🛡️ **Invisible Barriers**: Solid colliders that bound arenas without obstructing sightlines.
     - 🎯 **Spawn Markers**: Dedicated `FFA Spawn` (Green), `Red Team Spawn` (Red), and `Blue Team Spawn` (Blue).
   - **Atmosphere & Environment Engine**: 7 dynamic lighting presets (`Day`, `Dusk`, `Golden Hour`, `Night`, `Toxic`, `Cyber / Neon`, `Hell`) controlling sun angle, sky color, ambient light, and fog.
   - **Protox Single-Line Map Codes**: Instant 1-click clipboard copy (`[📋 Copy Code]`) and paste dialog (`[📥 Import]`) compatible with base64 encoded strings.
   - **Bundled Protox Templates**: *Protox Neon Jump Arena*, *Cyber Warehouse*, and *Default Arena*.

5. **Rooms & Matchmaking (Phase 5)**
   - Multi-room manager supporting **Free For All (FFA)** and **Team Deathmatch (TDM)** modes.
   - Automated TDM team balancing (Red vs Blue) with friendly-fire damage protection.
   - Match lifecycle state machine (`WAITING` $\to$ `PLAYING` $\to$ `ENDED` $\to$ `WAITING`).
   - TAB scoreboard with real-time K/D/A and ping, top match banner timer, winner podium spotlight, and room browser.

6. **Persistence, Community Maps API & Deployment (Phase 6)**
   - Salted SHA-256 user authentication, career stats tracking (Kills, Deaths, Wins, Score), and global top-100 leaderboard.
   - Community map repository REST API with fuzzy search, download counters, and upvoting/liking.
   - Unified single-port HTTP + WebSocket server with static client asset serving on port 8080.
   - Multi-stage `Dockerfile` and `docker-compose.yml` for instant one-command containerized production deployment.

---

## 🎮 Controls

### Combat Mode
- **W, A, S, D**: Move / Strafe
- **Mouse**: Aim & Look (Pointer Lock)
- **Left Click**: Fire Active Weapon
- **Right Click**: Aim Down Sights (ADS Zoom)
- **R**: Reload Active Weapon
- **1, 2, 3, 4**: Switch Weapon (Rifle, Sniper, Shotgun, Pistol)
- **Space**: Jump / Bunny-hop
- **Shift**: Sprint
- **C / Ctrl**: Slide / Crouch
- **Tab**: Open In-Game Scoreboard & Ping Matrix
- **L**: Open Server Lobby & Room Browser
- **U**: Open Player Profile & Authentication Modal
- **M**: Open Community Maps Repository
- **K**: Open In-Game Settings Menu (Volume, Sensitivity, FOV, Bloom Toggle)
- **B**: Toggle Mapmaker Studio (`mapmaker.protox.io` mode)
- **H**: Instant Toggle between Free-Fly Builder and FPS Playtest mode
- **P / F3**: Toggle Real-Time Performance & Debug Overlay

### Protox Mapmaker Studio (`B` to enter / `H` to playtest)
- **Left Click**: Place Block (with active brush tool)
- **Right Click**: Remove Block
- **Middle Click / Q**: Eyedropper / Pick Block from World
- **W, A, S, D**: Fly in Look Direction
- **Space / C**: Fly Up / Fly Down (Vertical Elevation)
- **Shift**: Fast Flight Boost (32 m/s)
- **H**: Seamlessly drop into **FPS Playtest Mode** to test slide-hopping, jump pads, and combat
- **Ctrl + Z**: Undo last modification
- **Ctrl + Y**: Redo last reverted modification
- **Top Bar**: Set Map Name, Atmosphere Preset (Day, Dusk, Golden Hour, Night, Toxic, Cyber, Hell), Copy Map Code, Import, Load Templates
- **Bottom Dock**: Choose between `🚀 Utilities` (Jump Pads, Speed Pads, Lava, Barriers, Spawns), `✨ Neon`, `🧱 Solids`, and `🖌️ Brushes`
- **Escape**: Release Mouse Cursor

---

## 🛠️ Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run All Automated Test Suites
Runs deterministic physics, client prediction/reconciliation, combat/lag compensation, map editor serialization, room matchmaking, and persistence tests:
```bash
npm test
```

### 3. Start Unified Server & Client
```bash
# In Terminal 1: Run the Authoritative Server (Port 8080)
npm run server

# In Terminal 2: Run the Vite Development Client (Port 3000)
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🐳 Production Deployment (Docker)

To run the production build in a self-contained container with unified static serving on port 8080:

```bash
# Build and run with Docker Compose
docker compose up --build -d

# Check server logs
docker compose logs -f
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## 🧪 Verification Commands

| Command | Purpose |
|---|---|
| `npm test` | Runs all 6 end-to-end verification suites (Physics, Netcode, Combat, Editor, Match, Persistence) |
| `npm run typecheck` | Strict TypeScript compiler check (`tsc --noEmit`) |
| `npm run build` | Compiles client assets to production bundle via Vite (`dist/client`) |
| `npm start` | Boots production server serving both REST API, WebSockets, and static client files |
