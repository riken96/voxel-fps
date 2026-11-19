export enum GameMode {
  FFA = 'Free For All',
  TDM = 'Team Deathmatch'
}

export enum MatchState {
  WAITING = 0,   // Waiting for players
  WARMUP = 1,    // 10s pre-round warmup
  PLAYING = 2,   // Active match
  ENDED = 3      // Post-match podium / scoreboard (10s before restart)
}

export enum Team {
  NONE = 0,
  RED = 1,
  BLUE = 2
}

export interface PlayerScore {
  id: string;
  username: string;
  team: Team;
  kills: number;
  deaths: number;
  score: number;
  ping: number;
}

export interface RoomSummary {
  id: string;
  name: string;
  mode: GameMode;
  mapName: string;
  playerCount: number;
  maxPlayers: number;
  state: MatchState;
  timeRemaining: number;
}

export interface MatchStatusData {
  roomId: string;
  roomName: string;
  mode: GameMode;
  state: MatchState;
  timeRemaining: number;
  scoreLimit: number;
  scores: PlayerScore[];
  teamScores: { red: number; blue: number };
}

export interface MatchOverData {
  winnerId: string | null;
  winnerName: string;
  winningTeam: Team;
  mvp: PlayerScore | null;
  scores: PlayerScore[];
  nextRoundCountdown: number;
}
