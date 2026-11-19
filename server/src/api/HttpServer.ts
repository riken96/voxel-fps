import http from 'http';
import fs from 'fs';
import path from 'path';
import { Database } from '../db/Database.ts';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

export class HttpServer {
  private db: Database;
  private clientDistPath: string;

  constructor(db: Database) {
    this.db = db;
    this.clientDistPath = path.resolve(process.cwd(), 'dist/client');
  }

  public handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // -------------------------------------------------------------
    // HEALTH CHECK (/health & /api/health for Docker & Cloud LBs)
    // -------------------------------------------------------------
    if (pathname === '/health' || pathname === '/api/health') {
      this.sendJSON(res, 200, {
        status: 'ok',
        version: '0.1.0',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: Date.now()
      });
      return;
    }

    // -------------------------------------------------------------
    // REST API ROUTES (/api/*)
    // -------------------------------------------------------------
    if (pathname.startsWith('/api/')) {
      this.handleApiRoute(req, res, pathname, url);
      return;
    }

    // -------------------------------------------------------------
    // STATIC ASSET SERVING (Production client hosting)
    // -------------------------------------------------------------
    this.serveStatic(req, res, pathname);
  }

  private handleApiRoute(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    url: URL
  ): void {
    // 1. Leaderboard
    if (pathname === '/api/leaderboard' && req.method === 'GET') {
      const top = this.db.getLeaderboard(25);
      this.sendJSON(res, 200, { leaderboard: top });
      return;
    }

    // 2. Maps List
    if (pathname === '/api/maps' && req.method === 'GET') {
      const search = url.searchParams.get('search') || undefined;
      const sort = (url.searchParams.get('sort') as 'popular' | 'latest') || 'latest';
      const maps = this.db.listMaps(search, sort);
      this.sendJSON(res, 200, { maps });
      return;
    }

    // 3. Single Map Get / Like
    if (pathname.startsWith('/api/maps/')) {
      const parts = pathname.split('/');
      const mapId = parts[3];

      if (parts[4] === 'like' && req.method === 'POST') {
        const liked = this.db.likeMap(mapId);
        this.sendJSON(res, liked ? 200 : 404, { success: liked });
        return;
      }

      if (req.method === 'GET' && mapId) {
        const map = this.db.getMap(mapId);
        if (map) {
          this.sendJSON(res, 200, { map, data: JSON.parse(map.dataJSON) });
        } else {
          this.sendJSON(res, 404, { error: 'Map not found' });
        }
        return;
      }
    }

    // 4. Publish Map
    if (pathname === '/api/maps' && req.method === 'POST') {
      this.readBody(req, (body) => {
        try {
          const { name, author, mapData } = JSON.parse(body);
          if (!mapData || !Array.isArray(mapData.blocks)) {
            this.sendJSON(res, 400, { error: 'Invalid map data' });
            return;
          }
          const record = this.db.publishMap(name, author, mapData);
          this.sendJSON(res, 201, { success: true, id: record.id });
        } catch (e) {
          this.sendJSON(res, 400, { error: 'Malformed JSON payload' });
        }
      });
      return;
    }

    // 5. Auth Register
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      this.readBody(req, (body) => {
        try {
          const { username, password } = JSON.parse(body);
          if (!username || !password || username.length < 3 || password.length < 4) {
            this.sendJSON(res, 400, { error: 'Username must be >= 3 chars, password >= 4 chars' });
            return;
          }
          const user = this.db.registerUser(username, password);
          if (!user) {
            this.sendJSON(res, 409, { error: 'Username already taken' });
            return;
          }
          this.sendJSON(res, 201, {
            success: true,
            user: { id: user.id, username: user.username, createdAt: user.createdAt }
          });
        } catch (e) {
          this.sendJSON(res, 400, { error: 'Malformed JSON payload' });
        }
      });
      return;
    }

    // 6. Auth Login
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      this.readBody(req, (body) => {
        try {
          const { username, password } = JSON.parse(body);
          const user = this.db.authenticateUser(username, password);
          if (!user) {
            this.sendJSON(res, 401, { error: 'Invalid username or password' });
            return;
          }
          this.sendJSON(res, 200, {
            success: true,
            user: {
              id: user.id,
              username: user.username,
              kills: user.kills,
              deaths: user.deaths,
              wins: user.wins,
              score: user.score
            }
          });
        } catch (e) {
          this.sendJSON(res, 400, { error: 'Malformed JSON payload' });
        }
      });
      return;
    }

    this.sendJSON(res, 404, { error: 'API endpoint not found' });
  }

  private serveStatic(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): void {
    if (!fs.existsSync(this.clientDistPath)) {
      // In dev mode without dist
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Voxel Strike Server is running. In development, launch client with "npm run dev".');
      return;
    }

    let filePath = path.join(this.clientDistPath, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath)) {
      // SPA Fallback to index.html
      filePath = path.join(this.clientDistPath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  }

  private readBody(req: http.IncomingMessage, callback: (body: string) => void): void {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        // Max 20MB payload protection
        req.destroy();
      }
    });
    req.on('end', () => callback(body));
  }

  private sendJSON(res: http.ServerResponse, status: number, data: object): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}
