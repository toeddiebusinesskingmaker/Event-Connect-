import * as fs from 'fs';
import * as path from 'path';

import { 
  User, 
  Event, 
  EventCheckIn, 
  Connection, 
  ConnectionNote, 
  Message, 
  Photo, 
  Report, 
  Block, 
  InterestTag,
  AuditLog,
  BroadcastMessage
} from '../types.ts';

const DB_FILE = path.join(process.cwd(), 'db.json');
let memoryCache: DatabaseSchema | null = null;
let saveTimeout: NodeJS.Timeout | null = null;
let pendingSave = false;

interface DatabaseSchema {
  users: User[];
  events: Event[];
  eventCheckIns: EventCheckIn[];
  connections: Connection[];
  connectionNotes: ConnectionNote[];
  messages: Message[];
  photos: Photo[];
  reports: Report[];
  blocks: Block[];
  interestTags: InterestTag[];
  auditLogs: AuditLog[];
  broadcastMessages: BroadcastMessage[];
}

const INITIAL_DB: DatabaseSchema = {
  users: [
    {
      id: 'demo-admin-1',
      name: 'Platform Admin',
      email: 'admin@eventconnect.com',
      passwordHash: '56a92959c56c5d90e23f5430b5aa0a688f85f40d2abe5afd397586fbf02f9087', // password123
      createdAt: new Date('2026-07-01T09:00:00Z').toISOString(),
      deletedAt: null,
      is_admin: true
    },
    {
      id: 'demo-user-1',
      name: 'Jane Doe (Organizer)',
      email: 'jane@eventconnect.com',
      passwordHash: '56a92959c56c5d90e23f5430b5aa0a688f85f40d2abe5afd397586fbf02f9087', // password123
      createdAt: new Date('2026-07-01T10:00:00Z').toISOString(),
      deletedAt: null,
      is_admin: true
    },
    {
      id: 'demo-user-2',
      name: 'Alex Rivera',
      email: 'alex@eventconnect.com',
      passwordHash: '56a92959c56c5d90e23f5430b5aa0a688f85f40d2abe5afd397586fbf02f9087',
      createdAt: new Date('2026-07-02T11:00:00Z').toISOString(),
      deletedAt: null
    },
    {
      id: 'demo-user-3',
      name: 'Taylor Chen',
      email: 'taylor@eventconnect.com',
      passwordHash: '56a92959c56c5d90e23f5430b5aa0a688f85f40d2abe5afd397586fbf02f9087',
      createdAt: new Date('2026-07-03T12:00:00Z').toISOString(),
      deletedAt: null
    }
  ],
  events: [
    {
      id: 'demo-event-1',
      organizerId: 'demo-user-1',
      name: 'Global Tech Summit 2026',
      date: '2026-07-15',
      location: 'Metropolitan Convention Center',
      checkInCode: 'TECH2026',
      createdAt: new Date('2026-07-01T10:30:00Z').toISOString()
    }
  ],
  eventCheckIns: [
    {
      id: 'checkin-1',
      eventId: 'demo-event-1',
      userId: 'demo-user-1',
      checkedInAt: new Date('2026-07-14T08:00:00Z').toISOString(),
      visibility: 'public',
      stillPresent: true
    },
    {
      id: 'checkin-2',
      eventId: 'demo-event-1',
      userId: 'demo-user-2',
      checkedInAt: new Date('2026-07-14T08:05:00Z').toISOString(),
      visibility: 'public',
      stillPresent: true
    },
    {
      id: 'checkin-3',
      eventId: 'demo-event-1',
      userId: 'demo-user-3',
      checkedInAt: new Date('2026-07-14T08:10:00Z').toISOString(),
      visibility: 'private',
      stillPresent: true
    }
  ],
  connections: [
    {
      id: 'conn-1-2',
      userOneId: 'demo-user-1',
      userTwoId: 'demo-user-2',
      senderUserId: 'demo-user-1',
      eventId: 'demo-event-1',
      status: 'accepted',
      sharingLevel: 'chat_and_contact',
      createdAt: new Date('2026-07-14T08:15:00Z').toISOString()
    }
  ],
  connectionNotes: [
    {
      id: 'note-1',
      connectionId: 'conn-1-2',
      authorUserId: 'demo-user-1',
      noteText: 'Met Alex near the front stage. Interested in React development.',
      createdAt: new Date('2026-07-14T08:20:00Z').toISOString()
    }
  ],
  messages: [
    {
      id: 'msg-1',
      connectionId: 'conn-1-2',
      senderUserId: 'demo-user-1',
      content: 'Hey Alex! Great meeting you here.',
      sentAt: new Date('2026-07-14T08:30:00Z').toISOString()
    },
    {
      id: 'msg-2',
      connectionId: 'conn-1-2',
      senderUserId: 'demo-user-2',
      content: 'Likewise! Your keynote was awesome.',
      sentAt: new Date('2026-07-14T08:31:00Z').toISOString()
    }
  ],
  photos: [
    {
      id: 'photo-1',
      eventId: 'demo-event-1',
      uploaderUserId: 'demo-user-1',
      fileUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&auto=format&fit=crop&q=60',
      uploadedAt: new Date('2026-07-14T08:45:00Z').toISOString(),
      hidden: false,
      hiddenAt: null
    },
    {
      id: 'photo-2',
      eventId: 'demo-event-1',
      uploaderUserId: 'demo-user-2',
      fileUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=600&auto=format&fit=crop&q=60',
      uploadedAt: new Date('2026-07-14T08:50:00Z').toISOString(),
      hidden: false,
      hiddenAt: null
    }
  ],
  reports: [],
  blocks: [],
  interestTags: [
    { id: 'tag-1', userId: 'demo-user-1', tagText: 'AI' },
    { id: 'tag-2', userId: 'demo-user-1', tagText: 'Networking' },
    { id: 'tag-3', userId: 'demo-user-2', tagText: 'React' },
    { id: 'tag-4', userId: 'demo-user-2', tagText: 'PWA' },
    { id: 'tag-5', userId: 'demo-user-3', tagText: 'Figma' }
  ],
  auditLogs: [],
  broadcastMessages: []
};

export class JsonDb {

  private static restSyncUrl: string | null = null;

  public static async initializeFirestoreSync() {
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const configRaw = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configRaw);
        
        const projectId = config.projectId;
        const databaseId = config.firestoreDatabaseId || '(default)';
        const apiKey = config.apiKey;
        
        this.restSyncUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/system/database?key=${apiKey}`;

        console.log('Firebase initialized. Fetching persistent DB state from REST API...');
        
        const res = await fetch(this.restSyncUrl);
        if (res.ok) {
          const docData = await res.json();
          if (docData && docData.fields && docData.fields.dbState && docData.fields.dbState.stringValue) {
             const data = docData.fields.dbState.stringValue;
             fs.writeFileSync(DB_FILE, data, 'utf-8');
             memoryCache = JSON.parse(data);
             console.log('Restored Database from Firestore!');
          } else {
             throw new Error('Document fields structure is incorrect');
          }
        } else if (res.status === 404) {
          console.log('No DB in Firestore, using local/initial state.');
          const currentData = this.load();
          await fetch(this.restSyncUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                dbState: { stringValue: JSON.stringify(currentData, null, 2) }
              }
            })
          });
          console.log('Saved initial state to Firestore.');
        } else {
           console.error('Failed to fetch from Firestore:', res.status, await res.text());
        }
      } else {
        console.warn('No firebase-applet-config.json found, skipping Firestore sync.');
      }
    } catch (e) {
      console.error('Error initializing Firebase sync:', e);
    }
  }

  private static load(): DatabaseSchema {
    if (memoryCache) return memoryCache;
    try {
      if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
        memoryCache = INITIAL_DB;
        return INITIAL_DB;
      }
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw) as DatabaseSchema;
      let dirty = false;
      if (!data.auditLogs) {
        data.auditLogs = [];
        dirty = true;
      }
      // Ensure Platform Admin exists so we can log in
      if (!data.users.some(u => u.id === 'demo-admin-1' || u.email === 'admin@eventconnect.com')) {
        data.users.push({
          id: 'demo-admin-1',
          name: 'Platform Admin',
          email: 'admin@eventconnect.com',
          passwordHash: '56a92959c56c5d90e23f5430b5aa0a688f85f40d2abe5afd397586fbf02f9087',
          createdAt: new Date('2026-07-01T09:00:00Z').toISOString(),
          deletedAt: null,
          is_admin: true
        });
        dirty = true;
      }
      // Ensure at least one admin is enabled
      const hasJane = data.users.find(u => u.email === 'jane@eventconnect.com');
      if (hasJane && !hasJane.is_admin) {
        hasJane.is_admin = true;
        dirty = true;
      }
      // Auto-promote testing and feedback emails to admin
      const adminEmails = ['toeddiebusiness@gmail.com', 'zerojoy97@gmail.com', 'admin@eventconnect.com'];
      data.users.forEach(u => {
        if (u.email && adminEmails.includes(u.email.toLowerCase()) && !u.is_admin) {
          u.is_admin = true;
          dirty = true;
        }
      });
      
      // Ensure connections have senderUserId for backward compatibility
      if (data.connections) {
        data.connections.forEach(c => {
          if (!c.senderUserId) {
            c.senderUserId = c.userOneId;
            dirty = true;
          }
        });
      }

      if (dirty) {
        this.save(data);
      }
      memoryCache = data;
      return data;
    } catch (e) {
      console.error('Error loading JSON database, using initial fallback', e);
      memoryCache = INITIAL_DB;
      return INITIAL_DB;
    }
  }

  private static save(data: DatabaseSchema): void {
    memoryCache = data;
    
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(() => {
      try {
        const jsonStr = JSON.stringify(memoryCache, null, 2);
        fs.writeFileSync(DB_FILE, jsonStr, 'utf-8');
        
        // Async save to firestore using REST API
        if (this.restSyncUrl) {
          fetch(this.restSyncUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                dbState: { stringValue: jsonStr }
              }
            })
          }).catch(e => console.error('Failed to sync to Firestore:', e));
        }
      } catch (e) {
        console.error('Error saving JSON database', e);
      }
    }, 2000); // Batch saves every 2 seconds
  }

  // Generic DB Accessors
  public static getUsers(): User[] {
    return this.load().users;
  }

  public static getEvents(): Event[] {
    return this.load().events;
  }

  public static getCheckIns(): EventCheckIn[] {
    return this.load().eventCheckIns;
  }

  public static getConnections(): Connection[] {
    return this.load().connections;
  }

  public static getConnectionNotes(): ConnectionNote[] {
    return this.load().connectionNotes;
  }

  public static getMessages(): Message[] {
    return this.load().messages;
  }

  public static getPhotos(): Photo[] {
    return this.load().photos;
  }

  public static getReports(): Report[] {
    return this.load().reports;
  }

  public static getBlocks(): Block[] {
    return this.load().blocks;
  }

  public static getInterestTags(): InterestTag[] {
    return this.load().interestTags;
  }

  // Insert methods
  public static insertUser(user: User, tags: string[]): void {
    const db = this.load();
    db.users.push(user);
    tags.forEach(tag => {
      db.interestTags.push({
        id: Math.random().toString(36).substring(2, 9),
        userId: user.id,
        tagText: tag
      });
    });
    this.save(db);
  }

  public static updateSocialLinks(userId: string, socialLinks: User['socialLinks']): void {
    const db = this.load();
    const user = db.users.find(u => u.id === userId);
    if (user) {
      user.socialLinks = socialLinks;
      this.save(db);
    }
  }

  public static addInterestTag(userId: string, tagText: string): void {
    const db = this.load();
    db.interestTags.push({
      id: Math.random().toString(36).substring(2, 9),
      userId,
      tagText
    });
    this.save(db);
  }

  public static removeInterestTag(userId: string, tagText: string): void {
    const db = this.load();
    db.interestTags = db.interestTags.filter(t => !(t.userId === userId && t.tagText.toLowerCase() === tagText.toLowerCase()));
    this.save(db);
  }

  public static insertEvent(event: Event): void {
    const db = this.load();
    db.events.push(event);
    this.save(db);
  }

  public static updateEvent(event: Event): void {
    const db = this.load();
    const index = db.events.findIndex(e => e.id === event.id);
    if (index !== -1) {
      db.events[index] = event;
      this.save(db);
    }
  }

  public static insertCheckIn(checkIn: EventCheckIn): void {
    const db = this.load();
    // Remove duplicate active checkin for this user/event if any
    db.eventCheckIns = db.eventCheckIns.filter(c => !(c.eventId === checkIn.eventId && c.userId === checkIn.userId));
    db.eventCheckIns.push(checkIn);
    this.save(db);
  }

  public static insertConnection(conn: Connection): void {
    const db = this.load();
    // Remove if there's any pending/declined connection
    db.connections = db.connections.filter(c => 
      !((c.userOneId === conn.userOneId && c.userTwoId === conn.userTwoId) || 
        (c.userOneId === conn.userTwoId && c.userTwoId === conn.userOneId))
    );
    db.connections.push(conn);
    this.save(db);
  }

  public static acceptConnection(connectionId: string, sharingLevel: 'chat_only' | 'chat_and_contact'): Connection | null {
    const db = this.load();
    const conn = db.connections.find(c => c.id === connectionId);
    if (conn) {
      conn.status = 'accepted';
      conn.sharingLevel = sharingLevel;
      this.save(db);
      return conn;
    }
    return null;
  }

  public static insertConnectionNote(note: ConnectionNote): void {
    const db = this.load();
    // Replace duplicate note by the same author for the same connection
    db.connectionNotes = db.connectionNotes.filter(n => !(n.connectionId === note.connectionId && n.authorUserId === note.authorUserId));
    db.connectionNotes.push(note);
    this.save(db);
  }

  public static insertMessage(msg: Message): void {
    const db = this.load();
    db.messages.push(msg);
    this.save(db);
  }

  public static insertPhoto(photo: Photo): void {
    const db = this.load();
    db.photos.push(photo);
    this.save(db);
  }

  public static flagPhoto(photoId: string, reporterUserId: string, reason: string): void {
    const db = this.load();
    const photo = db.photos.find(p => p.id === photoId);
    if (photo) {
      photo.hidden = true;
      photo.hiddenAt = new Date().toISOString();
    }
    db.reports.push({
      id: Math.random().toString(36).substring(2, 9),
      reporterUserId,
      targetType: 'photo',
      targetId: photoId,
      reason,
      createdAt: new Date().toISOString(),
      reviewed: false
    });
    this.save(db);
  }

  public static insertBlock(block: Block): void {
    const db = this.load();
    db.blocks.push(block);
    
    // Break active connection in BOTH directions
    db.connections = db.connections.filter(c => 
      !((c.userOneId === block.blockerUserId && c.userTwoId === block.blockedUserId) || 
        (c.userOneId === block.blockedUserId && c.userTwoId === block.blockerUserId))
    );
    this.save(db);
  }

  public static getBroadcastMessages(): BroadcastMessage[] {
    return this.load().broadcastMessages || [];
  }
  public static insertBroadcastMessage(msg: BroadcastMessage): void {
    const db = this.load();
    db.broadcastMessages.push(msg);
    this.save(db);
  }
  
  public static insertReport(report: Report): void {
    const db = this.load();
    db.reports.push(report);
    this.save(db);
  }

  // CASCADING PERMANENT DELETE (Phase 2 & GDPR Privacy Compliance)
  public static deleteAccount(userId: string): void {
    const db = this.load();

    // 1. Anonymize shared chat logs
    db.messages = db.messages.map(m => {
      if (m.senderUserId === userId) {
        return { ...m, content: '[Message deleted by user]' };
      }
      return m;
    });

    // 2. Cascade delete direct connection notes authored by the user
    db.connectionNotes = db.connectionNotes.filter(n => n.authorUserId !== userId);

    // 3. Keep check-ins to preserve historical attendee records for events
    // db.eventCheckIns = db.eventCheckIns.filter(c => c.userId !== userId);

    // 4. Keep interest tags to preserve historical event tags
    // db.interestTags = db.interestTags.filter(t => t.userId !== userId);

    // 5. Delete photos uploaded by this user
    db.photos = db.photos.filter(p => p.uploaderUserId !== userId);

    // 6. Delete direct connections
    db.connections = db.connections.filter(c => c.userOneId !== userId && c.userTwoId !== userId);

    // 7. Remove any blocks/reports involving this user
    db.blocks = db.blocks.filter(b => b.blockerUserId !== userId && b.blockedUserId !== userId);
    db.reports = db.reports.filter(r => r.reporterUserId !== userId);

    // 8. Soft delete / anonymize user profile to prevent broken database joins
    db.users = db.users.map(u => {
      if (u.id === userId) {
        return {
          id: u.id,
          name: 'Deleted Profile',
          email: `deleted-${userId}@eventconnect.com`, // Unique string to prevent unique constraint blocks
          passwordHash: '',
          createdAt: u.createdAt,
          deletedAt: new Date().toISOString()
        };
      }
      return u;
    });

    this.save(db);
  }

  public static getAuditLogs(): AuditLog[] {
    return this.load().auditLogs || [];
  }

  public static insertAuditLog(log: AuditLog): void {
    const db = this.load();
    if (!db.auditLogs) {
      db.auditLogs = [];
    }
    db.auditLogs.push(log);
    this.save(db);
  }

  public static updateUserAdminStatus(userId: string, is_admin: boolean): void {
    const db = this.load();
    db.users = db.users.map(u => {
      if (u.id === userId) {
        return { ...u, is_admin };
      }
      return u;
    });
    this.save(db);
  }

  public static updateUserSuspensionStatus(userId: string, suspended: boolean): void {
    const db = this.load();
    db.users = db.users.map(u => {
      if (u.id === userId) {
        return { ...u, suspended };
      }
      return u;
    });
    this.save(db);
  }

  public static updateReportStatus(reportId: string, reviewed: boolean): void {
    const db = this.load();
    db.reports = db.reports.map(r => {
      if (r.id === reportId) {
        return { ...r, reviewed };
      }
      return r;
    });
    this.save(db);
  }

  public static unhidePhoto(photoId: string): void {
    const db = this.load();
    db.photos = db.photos.map(p => {
      if (p.id === photoId) {
        return { ...p, hidden: false, hiddenAt: null };
      }
      return p;
    });
    this.save(db);
  }

  public static deletePhotoPermanently(photoId: string): void {
    const db = this.load();
    db.photos = db.photos.filter(p => p.id !== photoId);
    db.reports = db.reports.filter(r => !(r.targetType === 'photo' && r.targetId === photoId));
    this.save(db);
  }

  public static closeEventManually(eventId: string): void {
    const db = this.load();
    // 1. set still_present = FALSE for all check-ins of this event
    db.eventCheckIns = db.eventCheckIns.map(c => {
      if (c.eventId === eventId) {
        return { ...c, stillPresent: false };
      }
      return c;
    });
    // 2. set deactivated = TRUE on the event
    db.events = db.events.map(e => {
      if (e.id === eventId) {
        return { ...e, deactivated: true };
      }
      return e;
    });
    this.save(db);
  }

  public static reactivateEventManually(eventId: string): void {
    const db = this.load();
    db.events = db.events.map(e => {
      if (e.id === eventId) {
        return { ...e, deactivated: false };
      }
      return e;
    });
    this.save(db);
  }

  public static deleteEventManually(eventId: string): void {
    const db = this.load();
    const eventPhotoIds = new Set(db.photos.filter(p => p.eventId === eventId).map(p => p.id));
    db.events = db.events.filter(e => e.id !== eventId);
    db.eventCheckIns = db.eventCheckIns.filter(c => c.eventId !== eventId);
    db.photos = db.photos.filter(p => p.eventId !== eventId);
    db.reports = db.reports.filter(r => !(r.targetType === 'photo' && eventPhotoIds.has(r.targetId)));
    this.save(db);
  }

  public static toggleHideEventManually(eventId: string, hidden: boolean): void {
    const db = this.load();
    db.events = db.events.map(e => {
      if (e.id === eventId) {
        return { ...e, hidden };
      }
      return e;
    });
    this.save(db);
  }
}
