import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { VoxelMapData } from '../../../shared/world/MapFormat.ts';

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  matchesPlayed: number;
  kills: number;
  deaths: number;
  headshots: number;
  score: number;
  wins: number;
}

export interface MapRecord {
  id: string;
  name: string;
  author: string;
  createdAt: string;
  blockCount: number;
  dataJSON: string;
  downloads: number;
  likes: number;
}

/**
 * High-performance persistence manager.
 * Stores user profiles, career stats, and community maps.
 */
export class Database {
  private dataDir: string;
  private usersFile: string;
  private mapsFile: string;

  private users: Map<string, UserRecord> = new Map();
  private maps: Map<string, MapRecord> = new Map();

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.usersFile = path.join(this.dataDir, 'users.json');
    this.mapsFile = path.join(this.dataDir, 'maps.json');

    this.loadData();
  }

  private loadData(): void {
    // 1. Load Users
    if (fs.existsSync(this.usersFile)) {
      try {
        const raw = fs.readFileSync(this.usersFile, 'utf8');
        const list: UserRecord[] = JSON.parse(raw);
        for (const u of list) {
          this.users.set(u.username.toLowerCase(), u);
        }
      } catch (e) {
        console.warn('[DB] Failed to parse users.json, starting fresh:', e);
      }
    }

    // 2. Load Maps
    if (fs.existsSync(this.mapsFile)) {
      try {
        const raw = fs.readFileSync(this.mapsFile, 'utf8');
        const list: MapRecord[] = JSON.parse(raw);
        for (const m of list) {
          this.maps.set(m.id, m);
        }
      } catch (e) {
        console.warn('[DB] Failed to parse maps.json, starting fresh:', e);
      }
    }

    console.log(`[DB] Loaded ${this.users.size} user accounts and ${this.maps.size} community maps.`);
  }

  private saveUsers(): void {
    const list = Array.from(this.users.values());
    fs.writeFileSync(this.usersFile, JSON.stringify(list, null, 2), 'utf8');
  }

  private saveMaps(): void {
    const list = Array.from(this.maps.values());
    fs.writeFileSync(this.mapsFile, JSON.stringify(list, null, 2), 'utf8');
  }

  // -------------------------------------------------------------
  // USER ACCOUNTS & CAREER STATS
  // -------------------------------------------------------------
  public static hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password + '_voxel_salt_2026').digest('hex');
  }

  public registerUser(username: string, password: string): UserRecord | null {
    const key = username.trim().toLowerCase();
    if (this.users.has(key)) {
      return null; // Username already taken
    }

    const id = `u_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const user: UserRecord = {
      id,
      username: username.trim(),
      passwordHash: Database.hashPassword(password),
      createdAt: new Date().toISOString(),
      matchesPlayed: 0,
      kills: 0,
      deaths: 0,
      headshots: 0,
      score: 0,
      wins: 0
    };

    this.users.set(key, user);
    this.saveUsers();
    return user;
  }

  public authenticateUser(username: string, password: string): UserRecord | null {
    const key = username.trim().toLowerCase();
    const user = this.users.get(key);
    if (!user) return null;

    const hash = Database.hashPassword(password);
    if (user.passwordHash === hash) {
      return user;
    }
    return null;
  }

  public getUserByUsername(username: string): UserRecord | undefined {
    return this.users.get(username.trim().toLowerCase());
  }

  public recordMatchStats(
    username: string,
    kills: number,
    deaths: number,
    score: number,
    won: boolean
  ): void {
    const user = this.getUserByUsername(username);
    if (!user) return;

    user.matchesPlayed++;
    user.kills += kills;
    user.deaths += deaths;
    user.score += score;
    if (won) user.wins++;

    this.saveUsers();
  }

  public getLeaderboard(limit = 20): Array<{ username: string; kills: number; score: number; wins: number; matchesPlayed: number; kd: string }> {
    const list = Array.from(this.users.values()).map((u) => ({
      username: u.username,
      kills: u.kills,
      score: u.score,
      wins: u.wins,
      matchesPlayed: u.matchesPlayed,
      kd: u.deaths > 0 ? (u.kills / u.deaths).toFixed(2) : u.kills.toFixed(2)
    }));

    return list.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  // -------------------------------------------------------------
  // COMMUNITY MAPS REPOSITORY
  // -------------------------------------------------------------
  public publishMap(name: string, author: string, mapData: VoxelMapData): MapRecord {
    const id = `map_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const record: MapRecord = {
      id,
      name: name.trim() || 'Untitled Arena',
      author: author.trim() || 'Anonymous',
      createdAt: new Date().toISOString(),
      blockCount: mapData.blocks.length,
      dataJSON: JSON.stringify(mapData),
      downloads: 0,
      likes: 0
    };

    this.maps.set(id, record);
    this.saveMaps();
    console.log(`[DB] Published map "${record.name}" (${record.id}) by ${record.author}`);
    return record;
  }

  public getMap(id: string): MapRecord | undefined {
    const m = this.maps.get(id);
    if (m) {
      m.downloads++;
      this.saveMaps();
    }
    return m;
  }

  public likeMap(id: string): boolean {
    const m = this.maps.get(id);
    if (!m) return false;
    m.likes++;
    this.saveMaps();
    return true;
  }

  public listMaps(search?: string, sortBy: 'popular' | 'latest' = 'latest'): Array<Omit<MapRecord, 'dataJSON'>> {
    let list = Array.from(this.maps.values()).map((m) => ({
      id: m.id,
      name: m.name,
      author: m.author,
      createdAt: m.createdAt,
      blockCount: m.blockCount,
      downloads: m.downloads,
      likes: m.likes
    }));

    if (search && search.trim().length > 0) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.author.toLowerCase().includes(q));
    }

    if (sortBy === 'popular') {
      list.sort((a, b) => (b.likes * 2 + b.downloads) - (a.likes * 2 + a.downloads));
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return list;
  }
}
