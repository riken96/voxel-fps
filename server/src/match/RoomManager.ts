import { Room, ClientSession } from './Room.ts';
import { GameMode, RoomSummary } from '../../../shared/match/MatchTypes.ts';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private clientRoomMap: Map<string, string> = new Map();
  private nextRoomId = 1;

  constructor() {
    // Initialize default rooms
    this.createRoom('Public FFA Arena #1', GameMode.FFA, 'arena');
    this.createRoom('Competitive TDM #1', GameMode.TDM, 'arena');
    this.createRoom('Cyber Warehouse (TDM)', GameMode.TDM, 'warehouse');
  }

  public createRoom(
    name: string,
    mode = GameMode.FFA,
    mapTemplate: 'arena' | 'warehouse' = 'arena'
  ): Room {
    const id = `room_${this.nextRoomId++}`;
    const room = new Room(id, name, mode, mapTemplate, 10);
    this.rooms.set(id, room);
    console.log(`[RoomManager] Created room "${name}" (${id}) [${mode}]`);
    return room;
  }

  public getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  public getRoomForClient(clientId: string): Room | undefined {
    const roomId = this.clientRoomMap.get(clientId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  public joinRoom(session: ClientSession, roomId?: string): Room {
    // 1. Leave previous room if any
    this.leaveCurrentRoom(session.id);

    // 2. Select target room or best available
    let room: Room | undefined;
    if (roomId) {
      room = this.rooms.get(roomId);
    }

    if (!room) {
      // Find open public room
      for (const [, r] of this.rooms) {
        if (r.clients.size < r.maxPlayers) {
          room = r;
          break;
        }
      }
    }

    // Fallback: create fresh room if all are full
    if (!room) {
      room = this.createRoom(`Public Arena #${this.rooms.size + 1}`, GameMode.FFA, 'arena');
    }

    this.clientRoomMap.set(session.id, room.id);
    room.addClient(session);
    return room;
  }

  public leaveCurrentRoom(clientId: string): void {
    const roomId = this.clientRoomMap.get(clientId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.removeClient(clientId);
      }
      this.clientRoomMap.delete(clientId);
    }
  }

  public getSummaries(): RoomSummary[] {
    const list: RoomSummary[] = [];
    for (const [, r] of this.rooms) {
      list.push(r.getSummary());
    }
    return list;
  }

  public tickAll(): void {
    for (const [, room] of this.rooms) {
      room.tick();
    }
  }
}
