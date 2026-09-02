import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import * as crypto from 'crypto';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import { JsonDb } from './src/db/jsonDb.ts';
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
  InterestTag 
} from './src/types.ts';

const app = express();
const PORT = 3000;

// Body parsing
app.use(express.json({ limit: '10mb' }));

// Mailer Setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendWelcomeEmail(to: string, name: string) {
  if (!process.env.SMTP_USER) {
    console.log(`[Email Mock] Welcome email to ${name} (${to}) not sent because SMTP_USER is not configured.`);
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"EventConnect" <adogaeddie@gmail.com>',
      to,
      subject: 'Welcome to EventConnect! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #2563eb;">Welcome to EventConnect, ${name}!</h2>
          <p>We're thrilled to have you join our community. Get ready to discover amazing events, connect with fellow attendees, and make the most out of your experiences.</p>
          <p>Here are a few things you can do to get started:</p>
          <ul>
            <li>Browse upcoming events and check in.</li>
            <li>Connect with other attendees.</li>
            <li>Share photos in the event feed.</li>
          </ul>
          <p>If you have any questions or need help, just reply to this email!</p>
          <p>Cheers,<br/>The EventConnect Team</p>
        </div>
      `,
    });
    console.log(`Welcome email sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send welcome email to ${to}:`, error);
  }
}

// In-memory Session Store: Maps token -> user ID
const sessions = new Map<string, string>();

// Helper for hashing password (using Node's built-in crypto)
function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, 'salt-eventconnect-2026', 1000, 32, 'sha256').toString('hex');
}

// Authentication Middleware
export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: User;
}

const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Sign in is required to perform this action.' });
  }

  let userId = sessions.get(token);
  
  // Robust stateless parsing fallback if session mapping is lost on reboot/refresh
  if (!userId && token.startsWith('token-')) {
    const withoutPrefix = token.substring(6); // remove 'token-'
    const lastDashIndex = withoutPrefix.lastIndexOf('-');
    if (lastDashIndex !== -1) {
      const parsedUserId = withoutPrefix.substring(0, lastDashIndex);
      // Validate that this parsed userId actually exists in the db
      const userExists = JsonDb.getUsers().some(u => u.id === parsedUserId && !u.deletedAt);
      if (userExists) {
        userId = parsedUserId;
        sessions.set(token, userId); // Restore mapping in sessions map
      }
    }
  }

  if (!userId) {
    return res.status(403).json({ error: 'Session expired or invalid.' });
  }

  const user = JsonDb.getUsers().find(u => u.id === userId && !u.deletedAt);
  if (!user) {
    return res.status(403).json({ error: 'User account not found or deleted.' });
  }

  if (user.suspended) {
    return res.status(403).json({ error: 'Your account has been suspended by an administrator.' });
  }

  req.userId = userId;
  req.user = user;
  next();
};

const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.suspended) {
    return res.status(403).json({ error: 'Your account has been suspended by an administrator.' });
  }
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  next();
};

// --- AUTH API ROUTES ---

// 1. Register User
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, email, password, phone_number, interestTags } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = JsonDb.getUsers().find(u => u.email === normalizedEmail);
  if (existing) {
    return res.status(400).json({ error: 'Email already registered.' });
  }

  const userId = 'user-' + Math.random().toString(36).substring(2, 15);
  const userObj: User = {
    id: userId,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    phone_number: phone_number?.trim(),
    createdAt: new Date().toISOString(),
    deletedAt: null
  };

  const parsedTags = Array.isArray(interestTags) 
    ? interestTags.map((t: string) => t.trim()).filter((t: string) => t.length > 0)
    : [];

  JsonDb.insertUser(userObj, parsedTags);

  const token = 'token-' + userId + '-' + crypto.randomBytes(16).toString('hex');
  sessions.set(token, userId);

  // Send welcome email asynchronously
  sendWelcomeEmail(normalizedEmail, userObj.name).catch(console.error);

  res.status(201).json({
    token,
    user: {
      id: userObj.id,
      name: userObj.name,
      email: userObj.email,
      interestTags: parsedTags
    }
  });
});

// 2. Login User
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = JsonDb.getUsers().find(u => u.email === normalizedEmail && !u.deletedAt);

  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(400).json({ error: 'Invalid email or password.' });
  }

  if (user.suspended) {
    return res.status(403).json({ error: 'This account has been suspended by an administrator.' });
  }

  const token = 'token-' + user.id + '-' + crypto.randomBytes(16).toString('hex');
  sessions.set(token, user.id);

  const userTags = JsonDb.getInterestTags()
    .filter(t => t.userId === user.id)
    .map(t => t.tagText);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      interestTags: userTags,
      is_admin: !!user.is_admin,
      suspended: !!user.suspended
    }
  });
});

// 3. Get Current User
app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const userTags = JsonDb.getInterestTags()
    .filter(t => t.userId === user.id)
    .map(t => t.tagText);

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    interestTags: userTags,
    socialLinks: user.socialLinks || {},
    is_admin: !!user.is_admin,
    suspended: !!user.suspended
  });
});

// 4. Delete Account (GDPR Compliance / Relational Cascade)
app.delete('/api/auth/delete', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  
  // Trigger cascades on JSON database
  JsonDb.deleteAccount(userId);

  // Clear server session
  for (const [t, uid] of sessions.entries()) {
    if (uid === userId) {
      sessions.delete(t);
    }
  }

  res.json({ success: true, message: 'Account deleted successfully. All data purged or anonymized.' });
});

// 5. Add Interest Tag
app.post('/api/user/tags', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const { tag } = req.body;
  if (!tag || tag.trim().length === 0) {
    return res.status(400).json({ error: 'Tag cannot be empty' });
  }
  
  const tags = JsonDb.getInterestTags().filter(t => t.userId === userId);
  if (tags.some(t => t.tagText.toLowerCase() === tag.trim().toLowerCase())) {
    return res.status(400).json({ error: 'Tag already exists' });
  }

  JsonDb.addInterestTag(userId, tag.trim());
  res.json({ success: true, message: 'Tag added', tag: tag.trim() });
});

// 6. Remove Interest Tag
app.delete('/api/user/tags/:tag', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const tag = req.params.tag;
  
  if (!tag) {
    return res.status(400).json({ error: 'Tag is required' });
  }

  JsonDb.removeInterestTag(userId, tag);
  res.json({ success: true, message: 'Tag removed' });
});

// 7. Update Social Links
app.put('/api/user/social', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const { socialLinks } = req.body;
  JsonDb.updateSocialLinks(userId, socialLinks);
  res.json({ success: true, message: 'Social links updated' });
});

// --- EVENT API ROUTES ---

// 1. List Events
app.get('/api/events', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const events = JsonDb.getEvents();
  if (req.user?.is_admin) {
    return res.json(events);
  }
  const visibleEvents = events.filter(e => !e.hidden || e.organizerId === req.userId);
  res.json(visibleEvents);
});

// 2. Create Event
app.post('/api/events/create', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { name, date, location, checkInCode } = req.body;
  if (!name || !date || !location || !checkInCode) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const upperCode = checkInCode.trim().toUpperCase();
  const existingCode = JsonDb.getEvents().find(e => e.checkInCode === upperCode);
  if (existingCode) {
    return res.status(400).json({ error: 'Check-in code is already in use.' });
  }

  const event: Event = {
    id: 'event-' + Math.random().toString(36).substring(2, 15),
    organizerId: req.userId!,
    name: name.trim(),
    date,
    location: location.trim(),
    checkInCode: upperCode,
    createdAt: new Date().toISOString()
  };

  JsonDb.insertEvent(event);
  res.status(201).json(event);
});

// Update event
app.put('/api/events/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const eventId = req.params.id;
  const events = JsonDb.getEvents();
  const eventIndex = events.findIndex(e => e.id === eventId);
  
  if (eventIndex === -1) {
    return res.status(404).json({ error: 'Event not found.' });
  }
  
  const event = events[eventIndex];
  if (event.organizerId !== req.userId) {
    return res.status(403).json({ error: 'Only the organizer can update this event.' });
  }

  const { feedbackFormUrl } = req.body;
  if (feedbackFormUrl !== undefined) {
    event.feedbackFormUrl = feedbackFormUrl;
  }

  JsonDb.updateEvent(event);
  res.json(event);
});

// 3. Check-In to Event (with privacy visibility toggle)
app.post('/api/events/checkin', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { checkInCode, visibility } = req.body;
  if (!checkInCode) {
    return res.status(400).json({ error: 'Check-in code is required.' });
  }

  const upperCode = checkInCode.trim().toUpperCase();
  const event = JsonDb.getEvents().find(e => e.checkInCode === upperCode);
  if (!event) {
    return res.status(404).json({ error: 'Event not found. Double check your code.' });
  }

  if (event.deactivated) {
    return res.status(400).json({ error: 'This event venue has been deactivated or closed by the organizer/administrator.' });
  }

  const user = JsonDb.getUsers().find(u => u.id === req.userId!);
  const userTags = JsonDb.getInterestTags().filter(t => t.userId === req.userId!).map(t => t.tagText).join(', ');

  const checkIn: EventCheckIn = {
    id: 'ci-' + Math.random().toString(36).substring(2, 15),
    eventId: event.id,
    userId: req.userId!,
    checkedInAt: new Date().toISOString(),
    visibility: (visibility === 'private') ? 'private' : 'public',
    stillPresent: true,
    historicalName: user?.name || '',
    historicalEmail: user?.email || '',
    historicalPhone: user?.phone_number || '',
    historicalTags: userTags || ''
  };

  JsonDb.insertCheckIn(checkIn);
  res.json({ success: true, checkIn, event });
});

// 4. Check-Out / Leave Event
app.post('/api/events/:id/checkout', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const eventId = req.params.id;
  const userId = req.userId!;

  const checkins = JsonDb.getCheckIns();
  const found = checkins.find(c => c.eventId === eventId && c.userId === userId && c.stillPresent);

  if (found) {
    found.stillPresent = false;
    // Save changes
    const db = (JsonDb as any).load();
    const saveCheckin = db.eventCheckIns.find((c: any) => c.id === found.id);
    if (saveCheckin) {
      saveCheckin.stillPresent = false;
    }
    (JsonDb as any).save(db);
    return res.json({ success: true, message: 'Successfully checked out.' });
  }

  res.status(404).json({ error: 'No active check-in found for this event.' });
});

// 5. Get Event Directory (Respecting Privacy, Consent, and Blocklists)
// Broadcast messages
app.get('/api/events/:id/broadcasts', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const eventId = req.params.id;
  const broadcasts = JsonDb.getBroadcastMessages().filter(b => b.eventId === eventId);
  res.json(broadcasts.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()));
});

app.post('/api/events/:id/broadcast', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const eventId = req.params.id;
  const userId = req.userId!;
  const { message } = req.body;
  
  const event = JsonDb.getEvents().find(e => e.id === eventId);
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  
  if (event.organizerId !== userId && !req.user?.is_admin) {
    return res.status(403).json({ error: 'Access denied: Only organizers or administrators can broadcast.' });
  }
  
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  const broadcast = {
    id: Math.random().toString(36).substring(2, 9),
    eventId,
    senderId: userId,
    message: message.trim(),
    sentAt: new Date().toISOString()
  };
  
  JsonDb.insertBroadcastMessage(broadcast);
  res.json(broadcast);
});

app.get('/api/events/:id/directory', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const eventId = req.params.id;
  const userId = req.userId!;

  // Verify caller is checked in themselves
  const userCheckIn = JsonDb.getCheckIns().find(c => c.eventId === eventId && c.userId === userId && c.stillPresent);
  if (!userCheckIn) {
    return res.status(403).json({ error: 'You must check in to see other attendees.' });
  }

  // Get blockers & blocked list
  const blocks = JsonDb.getBlocks();
  const excludedUserIds = new Set<string>();
  blocks.forEach(b => {
    if (b.blockerUserId === userId) excludedUserIds.add(b.blockedUserId);
    if (b.blockedUserId === userId) excludedUserIds.add(b.blockerUserId);
  });

  // Get connections to know who we are connected with (to reveal private profiles)
  const connections = JsonDb.getConnections();
  const connectedUserIds = new Set<string>();
  connections.forEach(c => {
    if (c.status === 'accepted') {
      if (c.userOneId === userId) connectedUserIds.add(c.userTwoId);
      if (c.userTwoId === userId) connectedUserIds.add(c.userOneId);
    }
  });

  // Filter attendees checked into this event, currently still present, not blocked
  const checkedInUsers = JsonDb.getCheckIns()
    .filter(c => c.eventId === eventId && c.userId !== userId && !excludedUserIds.has(c.userId))
    .map(c => {
      const userObj = JsonDb.getUsers().find(u => u.id === c.userId && !u.deletedAt && !u.suspended);
      if (!userObj) return null;

      // Show interest tags
      const tags = JsonDb.getInterestTags()
        .filter(t => t.userId === userObj.id)
        .map(t => t.tagText);

      // Check current connection status
      const existingConn = connections.find(conn => 
        (conn.userOneId === userId && conn.userTwoId === userObj.id) || 
        (conn.userOneId === userObj.id && conn.userTwoId === userId)
      );

      // Privacy logic: if user is 'private', they only appear if they have a mutual 'accepted' connection.
      // Exception: If there is a pending request, we can show basic card to let them process it.
      const isConnected = connectedUserIds.has(userObj.id);
      if (c.visibility === 'private' && !isConnected && (!existingConn || existingConn.status !== 'pending')) {
        return null;
      }

      return {
        id: userObj.id,
        name: userObj.name,
        interestTags: tags,
        socialLinks: isConnected ? userObj.socialLinks : undefined,
        visibility: c.visibility,
        stillPresent: c.stillPresent,
        connectionStatus: existingConn ? existingConn.status : 'none',
        connectionId: existingConn ? existingConn.id : null,
        connectionSender: existingConn ? (existingConn.senderUserId === userId ? 'me' : 'them') : null,
        sharingLevel: existingConn ? existingConn.sharingLevel : null
      };
    })
    .filter(item => item !== null);

  res.json(checkedInUsers);
});


// --- CONNECTIONS & PRIVATE NOTES & MESSAGES ---

// 1. List connections (cross-event history)
app.get('/api/connections', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const conns = JsonDb.getConnections()
    .filter(c => c.userOneId === userId || c.userTwoId === userId)
    .map(c => {
      const peerId = c.userOneId === userId ? c.userTwoId : c.userOneId;
      const peer = JsonDb.getUsers().find(u => u.id === peerId);
      const event = JsonDb.getEvents().find(e => e.id === c.eventId);
      
      const peerTags = peer ? JsonDb.getInterestTags().filter(t => t.userId === peer.id).map(t => t.tagText) : [];
      const privateNote = JsonDb.getConnectionNotes().find(n => n.connectionId === c.id && n.authorUserId === userId);

      // Fetch last message for this connection
      const chats = JsonDb.getMessages()
        .filter(m => m.connectionId === c.id)
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
      const lastMessage = chats[chats.length - 1] ? {
        id: chats[chats.length - 1].id,
        senderUserId: chats[chats.length - 1].senderUserId,
        content: chats[chats.length - 1].content,
        sentAt: chats[chats.length - 1].sentAt
      } : null;

      return {
        id: c.id,
        status: c.status,
        senderUserId: c.senderUserId,
        sharingLevel: c.sharingLevel,
        createdAt: c.createdAt,
        eventId: c.eventId,
        eventName: event ? event.name : 'Unknown Event',
        peer: peer ? {
          id: peer.id,
          name: peer.name,
          email: c.sharingLevel === 'chat_and_contact' ? peer.email : undefined,
          phone_number: c.sharingLevel === 'chat_and_contact' ? peer.phone_number : undefined,
          interestTags: peerTags,
          socialLinks: c.status === 'accepted' ? peer.socialLinks : undefined,
          isDeleted: !!peer.deletedAt
        } : { id: peerId, name: 'Deleted User', email: undefined, interestTags: [], isDeleted: true },
        privateNote: privateNote ? privateNote.noteText : '',
        lastMessage
      };
    });

  res.json(conns);
});

// 2. Request Connection
app.post('/api/connections/request', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { peerId, eventId, sharingLevel } = req.body;
  const userId = req.userId!;

  if (!peerId || !eventId) {
    return res.status(400).json({ error: 'Peer ID and Event ID are required.' });
  }

  // Double block check
  const isBlocked = JsonDb.getBlocks().some(b => 
    (b.blockerUserId === userId && b.blockedUserId === peerId) || 
    (b.blockerUserId === peerId && b.blockedUserId === userId)
  );
  if (isBlocked) {
    return res.status(403).json({ error: 'Cannot connect with this user.' });
  }

  // Ensure lexicographical order to prevent double requests
  const [userOneId, userTwoId] = [userId, peerId].sort();

  const existing = JsonDb.getConnections().find(c => 
    c.userOneId === userOneId && c.userTwoId === userTwoId
  );

  if (existing) {
    if (existing.status === 'accepted') {
      return res.status(400).json({ error: 'You are already connected.' });
    }
    if (existing.status === 'pending') {
      // If the other person already requested, auto-accept!
      const otherRequested = (existing.userOneId === peerId && userId === existing.userTwoId) || 
                             (existing.userTwoId === peerId && userId === existing.userOneId);
      if (otherRequested) {
        JsonDb.acceptConnection(existing.id, sharingLevel || 'chat_only');
        return res.json({ success: true, connection: existing, message: 'Connection accepted!' });
      }
      return res.status(400).json({ error: 'Connect request is already pending.' });
    }
  }

  const conn: Connection = {
    id: 'conn-' + Math.random().toString(36).substring(2, 15),
    userOneId,
    userTwoId,
    senderUserId: userId,
    eventId,
    status: 'pending',
    sharingLevel: sharingLevel || 'chat_only',
    createdAt: new Date().toISOString()
  };

  JsonDb.insertConnection(conn);
  res.status(201).json({ success: true, connection: conn });
});

// 3. Respond to Connection Request
app.post('/api/connections/:id/respond', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const connectionId = req.params.id;
  const { accept, sharingLevel } = req.body;
  const userId = req.userId!;

  const conn = JsonDb.getConnections().find(c => c.id === connectionId);
  if (!conn) {
    return res.status(404).json({ error: 'Connection request not found.' });
  }

  // Ensure this user is part of the request
  if (conn.userOneId !== userId && conn.userTwoId !== userId) {
    return res.status(403).json({ error: 'Unauthorized to respond to this request.' });
  }

  // Prevent sender from responding to their own request
  if (conn.senderUserId === userId) {
    return res.status(403).json({ error: 'You cannot respond to a connection request you sent.' });
  }

  if (accept) {
    const updated = JsonDb.acceptConnection(connectionId, sharingLevel || 'chat_only');
    res.json({ success: true, connection: updated });
  } else {
    // Decline / delete request
    const db = (JsonDb as any).load();
    db.connections = db.connections.filter((c: any) => c.id !== connectionId);
    (JsonDb as any).save(db);
    res.json({ success: true, message: 'Request declined.' });
  }
});

// 4. Update Private Note on a connection (Phase 3 Note-Taking Feature)
app.post('/api/connections/:id/notes', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const connectionId = req.params.id;
  const { noteText } = req.body;
  const userId = req.userId!;

  const conn = JsonDb.getConnections().find(c => c.id === connectionId && c.status === 'accepted');
  if (!conn) {
    return res.status(404).json({ error: 'Accepted connection not found.' });
  }

  if (conn.userOneId !== userId && conn.userTwoId !== userId) {
    return res.status(403).json({ error: 'Unauthorized.' });
  }

  const note: ConnectionNote = {
    id: 'note-' + Math.random().toString(36).substring(2, 15),
    connectionId,
    authorUserId: userId,
    noteText: noteText || '',
    createdAt: new Date().toISOString()
  };

  JsonDb.insertConnectionNote(note);
  res.json({ success: true, note });
});

// 5. Get Connection Chat Messages
app.get('/api/connections/:id/chat', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const connectionId = req.params.id;
  const userId = req.userId!;

  const conn = JsonDb.getConnections().find(c => c.id === connectionId && c.status === 'accepted');
  if (!conn) {
    return res.status(404).json({ error: 'Connection not active or found.' });
  }

  if (conn.userOneId !== userId && conn.userTwoId !== userId) {
    return res.status(403).json({ error: 'Unauthorized to view these messages.' });
  }

  const chats = JsonDb.getMessages()
    .filter(m => m.connectionId === connectionId)
    .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

  res.json(chats);
});

// 6. Post Chat Message
app.post('/api/connections/:id/message', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const connectionId = req.params.id;
  const { content } = req.body;
  const userId = req.userId!;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Message content cannot be empty.' });
  }

  const conn = JsonDb.getConnections().find(c => c.id === connectionId && c.status === 'accepted');
  if (!conn) {
    return res.status(404).json({ error: 'Active connection not found.' });
  }

  if (conn.userOneId !== userId && conn.userTwoId !== userId) {
    return res.status(403).json({ error: 'Unauthorized.' });
  }

  const msg: Message = {
    id: 'msg-' + Math.random().toString(36).substring(2, 15),
    connectionId,
    senderUserId: userId,
    content: content.trim(),
    sentAt: new Date().toISOString()
  };

  JsonDb.insertMessage(msg);
  res.status(201).json(msg);
});


// --- SHARED PHOTO FEED API ROUTES ---

// 1. Get Event Photo Feed
app.get('/api/events/:id/photos', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const eventId = req.params.id;
  const userId = req.userId!;

  // Must be checked in to view photo feed
  const checkedIn = JsonDb.getCheckIns().find(c => c.eventId === eventId && c.userId === userId && c.stillPresent);
  if (!checkedIn) {
    return res.status(403).json({ error: 'You must check in to see the shared photo feed.' });
  }

  // Get blockers & blocked list
  const blocks = JsonDb.getBlocks();
  const excludedUserIds = new Set<string>();
  blocks.forEach(b => {
    if (b.blockerUserId === userId) excludedUserIds.add(b.blockedUserId);
    if (b.blockedUserId === userId) excludedUserIds.add(b.blockerUserId);
  });

  const photos = JsonDb.getPhotos()
    .filter(p => p.eventId === eventId && !p.hidden && !excludedUserIds.has(p.uploaderUserId))
    .map(p => {
      const uploader = JsonDb.getUsers().find(u => u.id === p.uploaderUserId);
      return {
        id: p.id,
        fileUrl: p.fileUrl,
        caption: p.caption,
        uploadedAt: p.uploadedAt,
        uploaderName: uploader ? uploader.name : 'Unknown User',
        uploaderId: p.uploaderUserId
      };
    })
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  res.json(photos);
});

// 2. Upload Event Photo
app.post('/api/events/:id/photos/upload', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const eventId = req.params.id;
  const { fileUrl, caption } = req.body; // Can be base64 or Unsplash URL
  const userId = req.userId!;

  if (!fileUrl) {
    return res.status(400).json({ error: 'Photo file source is required.' });
  }

  // Must be checked in to upload photo
  const checkedIn = JsonDb.getCheckIns().find(c => c.eventId === eventId && c.userId === userId && c.stillPresent);
  if (!checkedIn) {
    return res.status(403).json({ error: 'You must check in to upload a photo to the feed.' });
  }

  const photo: Photo = {
    id: 'photo-' + Math.random().toString(36).substring(2, 15),
    eventId,
    uploaderUserId: userId,
    fileUrl,
    caption,
    uploadedAt: new Date().toISOString(),
    hidden: false,
    hiddenAt: null
  };

  JsonDb.insertPhoto(photo);

  const uploader = JsonDb.getUsers().find(u => u.id === userId);
  res.status(201).json({
    id: photo.id,
    fileUrl: photo.fileUrl,
    caption: photo.caption,
    uploadedAt: photo.uploadedAt,
    uploaderName: uploader ? uploader.name : 'You',
    uploaderId: userId
  });
});

// 3. Flag Photo
app.post('/api/photos/:id/flag', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const photoId = req.params.id;
  const { reason } = req.body;
  const userId = req.userId!;

  if (!reason) {
    return res.status(400).json({ error: 'Reason for flagging is required.' });
  }

  JsonDb.flagPhoto(photoId, userId, reason);
  res.json({ success: true, message: 'Photo flagged and hidden. Undergoing organizer review.' });
});


// --- BLOCKS & REPORTS ---

// 1. Block User
app.post('/api/blocks/create', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { blockedUserId } = req.body;
  const userId = req.userId!;

  if (!blockedUserId) {
    return res.status(400).json({ error: 'Blocked user ID is required.' });
  }

  if (userId === blockedUserId) {
    return res.status(400).json({ error: 'You cannot block yourself.' });
  }

  // Avoid duplicate blocks
  const existing = JsonDb.getBlocks().find(b => b.blockerUserId === userId && b.blockedUserId === blockedUserId);
  if (existing) {
    return res.json({ success: true, message: 'User is already blocked.' });
  }

  const block: Block = {
    id: 'blk-' + Math.random().toString(36).substring(2, 15),
    blockerUserId: userId,
    blockedUserId,
    createdAt: new Date().toISOString()
  };

  JsonDb.insertBlock(block);
  res.json({ success: true, message: 'User successfully blocked.' });
});

// 2. Report User
app.post('/api/reports/create', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { targetType, targetId, reason } = req.body;
  const userId = req.userId!;

  if (!targetType || !targetId || !reason) {
    return res.status(400).json({ error: 'Target type, target ID, and reason are required.' });
  }

  const report: Report = {
    id: 'rep-' + Math.random().toString(36).substring(2, 15),
    reporterUserId: userId,
    targetType,
    targetId,
    reason,
    createdAt: new Date().toISOString(),
    reviewed: false
  };

  JsonDb.insertReport(report);
  res.json({ success: true, message: 'Report submitted. Organizer will review.' });
});


// --- ORGANIZER DASHBOARD & REPORTS (Phase 4 Features) ---

app.get('/api/events/:id/dashboard', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const eventId = req.params.id;
  const userId = req.userId!;

  const event = JsonDb.getEvents().find(e => e.id === eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found.' });
  }

  // Verify caller is the organizer (bypass if admin)
  if (event.organizerId !== userId && !req.user?.is_admin) {
    return res.status(403).json({ error: 'Access denied: Only organizers or administrators can view the live dashboard.' });
  }

  const checkins = JsonDb.getCheckIns().filter(c => c.eventId === eventId);
  const activeCheckIns = checkins.filter(c => c.stillPresent).length;
  const totalAttendance = checkins.length;

  const eventPhotos = JsonDb.getPhotos().filter(p => p.eventId === eventId);
  const totalPhotos = eventPhotos.length;
  const flaggedPhotos = eventPhotos.filter(p => p.hidden).length;

  // Active connections made during the event
  const eventConnections = JsonDb.getConnections().filter(c => c.eventId === eventId && c.status === 'accepted').length;

  // Interest tag aggregation
  const attendeeUserIds = checkins.map(c => c.userId);
  const tagsMap: { [key: string]: number } = {};

  JsonDb.getInterestTags()
    .filter(t => attendeeUserIds.includes(t.userId))
    .forEach(t => {
      const tagLower = t.tagText.trim().toLowerCase();
      if (tagLower) {
        tagsMap[tagLower] = (tagsMap[tagLower] || 0) + 1;
      }
    });

  const sortedTags = Object.entries(tagsMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const attendeesData = checkins.map(c => {
    // Rely primarily on snapshot data captured at the exact moment of check-in
    // This ensures data is permanently available for exports even if the user deletes their app/account.
    if (c.historicalName || c.historicalEmail) {
      const parts = (c.historicalName || '').trim().split(' ');
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      return {
        checkInTime: new Date(c.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        firstName: firstName || 'Unknown',
        lastName: lastName,
        email: c.historicalEmail || 'N/A',
        phone: c.historicalPhone || 'N/A',
        interest: c.historicalTags || 'N/A'
      };
    }

    // Fallback for any legacy checkins created before historical data was implemented
    const user = JsonDb.getUsers().find(u => u.id === c.userId);
    const userTags = JsonDb.getInterestTags().filter(t => t.userId === c.userId).map(t => t.tagText).join(', ');
    
    if (user) {
      const parts = user.name.trim().split(' ');
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      return {
        checkInTime: new Date(c.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        firstName,
        lastName,
        email: user.email,
        phone: user.phone_number || 'N/A',
        interest: userTags || 'N/A'
      };
    } else {
      return {
        checkInTime: new Date(c.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        firstName: 'Deleted',
        lastName: 'User',
        email: 'deleted@eventconnect.local',
        phone: 'N/A',
        interest: userTags || 'N/A'
      };
    }
  }).filter(Boolean);

  const timelineMap = new Map<string, number>();
  checkins.sort((a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime())
    .forEach(c => {
      const d = new Date(c.checkedInAt);
      const minutes = Math.floor(d.getMinutes() / 15) * 15;
      d.setMinutes(minutes, 0, 0);
      const timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      timelineMap.set(timeLabel, (timelineMap.get(timeLabel) || 0) + 1);
    });

  const timelineData: { time: string; count: number; cumulative: number }[] = [];
  let cumulative = 0;
  for (const [time, count] of timelineMap.entries()) {
    cumulative += count;
    timelineData.push({ time, count, cumulative });
  }

  res.json({
    eventName: event.name,
    eventCode: event.checkInCode,
    activeCheckIns,
    totalAttendance,
    totalPhotos,
    flaggedPhotos,
    eventConnections,
    interestTags: sortedTags,
    attendees: attendeesData,
    checkInTimeline: timelineData
  });
});


// --- PLATFORM ADMIN API ROUTES ---

// 1. Unified Moderation Queue
app.get('/api/admin/moderation', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const reports = JsonDb.getReports();
  const photos = JsonDb.getPhotos();
  const users = JsonDb.getUsers();
  const events = JsonDb.getEvents();

  const { status, targetType, eventId } = req.query;

  let items: any[] = [];

  // Add items from reports
  reports.forEach(r => {
    const reporter = users.find(u => u.id === r.reporterUserId);
    let targetName = '';
    let targetPreview = '';
    let itemEventId = '';
    let itemEventName = '';
    let uploaderName = '';
    let uploaderId = '';

    if (r.targetType === 'photo') {
      const p = photos.find(ph => ph.id === r.targetId);
      if (p) {
        targetPreview = p.fileUrl;
        itemEventId = p.eventId;
        const evt = events.find(e => e.id === p.eventId);
        itemEventName = evt ? evt.name : 'Unknown Event';
        const up = users.find(u => u.id === p.uploaderUserId);
        uploaderName = up ? up.name : 'Unknown';
        uploaderId = up ? up.id : '';
      }
    } else if (r.targetType === 'user') {
      const u = users.find(usr => usr.id === r.targetId);
      if (u) {
        targetPreview = u.name;
        targetName = u.name;
        uploaderName = u.name;
        uploaderId = u.id;
      }
    }

    items.push({
      id: `report-${r.id}`,
      itemType: 'report',
      reportId: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      reporter: reporter ? { id: reporter.id, name: reporter.name, email: reporter.email } : { id: r.reporterUserId, name: 'Unknown User', email: '' },
      reason: r.reason,
      createdAt: r.createdAt,
      reviewed: r.reviewed,
      targetPreview,
      targetName,
      eventId: itemEventId,
      eventName: itemEventName,
      uploader: { id: uploaderId, name: uploaderName }
    });
  });

  // Add photos that are hidden = TRUE and don't already have reports
  const reportedPhotoIds = new Set(reports.map(r => r.targetType === 'photo' ? r.targetId : ''));
  photos.forEach(p => {
    if (p.hidden && !reportedPhotoIds.has(p.id)) {
      const up = users.find(u => u.id === p.uploaderUserId);
      const evt = events.find(e => e.id === p.eventId);
      items.push({
        id: `photo-${p.id}`,
        itemType: 'photo_hidden',
        reportId: null,
        targetType: 'photo',
        targetId: p.id,
        reporter: { id: 'system', name: 'System Auto-Flag', email: '' },
        reason: 'Photo hidden by user flag or system review',
        createdAt: p.hiddenAt || p.uploadedAt,
        reviewed: false,
        targetPreview: p.fileUrl,
        targetName: '',
        eventId: p.eventId,
        eventName: evt ? evt.name : 'Unknown Event',
        uploader: { id: p.uploaderUserId, name: up ? up.name : 'Unknown' }
      });
    }
  });

  // Apply filters
  if (status === 'pending') {
    items = items.filter(item => !item.reviewed);
  } else if (status === 'reviewed') {
    items = items.filter(item => item.reviewed);
  }

  if (targetType) {
    items = items.filter(item => item.targetType === targetType);
  }

  if (eventId) {
    items = items.filter(item => item.eventId === eventId);
  }

  // Sort descending by creation date
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(items);
});

// 2. Moderation Actions
app.post('/api/admin/moderation/action', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { action, targetType, targetId, reportId } = req.body;
  const adminId = req.userId!;

  if (!action || !targetType || !targetId) {
    return res.status(400).json({ error: 'Missing required parameters: action, targetType, targetId.' });
  }

  // Mark report reviewed if reportId exists
  if (reportId) {
    JsonDb.updateReportStatus(reportId, true);
  }

  let details = '';

  if (action === 'dismiss') {
    if (targetType === 'photo') {
      JsonDb.unhidePhoto(targetId);
      details = `Dismissed report and unhidden photo ${targetId}`;
    } else {
      details = `Dismissed report for user ${targetId}`;
    }
    // Also, mark other reports for the same target as reviewed
    const targetReports = JsonDb.getReports().filter(r => r.targetType === targetType && r.targetId === targetId);
    targetReports.forEach(r => {
      JsonDb.updateReportStatus(r.id, true);
    });

  } else if (action === 'confirm_removal') {
    if (targetType === 'photo') {
      JsonDb.deletePhotoPermanently(targetId);
      details = `Permanently removed photo ${targetId}`;
    } else {
      JsonDb.updateUserSuspensionStatus(targetId, true);
      details = `Suspended user ${targetId} on report confirmation`;
    }

  } else if (action === 'warn') {
    details = `Issued formal warning to user ${targetId}`;

  } else if (action === 'suspend') {
    JsonDb.updateUserSuspensionStatus(targetId, true);
    details = `Suspended user account ${targetId}`;
  }

  // Log in Audit Log
  const auditId = Math.random().toString(36).substring(2, 9);
  JsonDb.insertAuditLog({
    id: auditId,
    admin_user_id: adminId,
    action: `MODERATION_${action.toUpperCase()}`,
    target_type: targetType,
    target_id: targetId,
    created_at: new Date().toISOString()
  });

  res.json({ success: true, details });
});

// 3. User List
app.get('/api/admin/users', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const users = JsonDb.getUsers();
  const search = typeof req.query.search === 'string' ? req.query.search.toLowerCase() : '';
  
  let result = users.map(u => {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      deletedAt: u.deletedAt,
      is_admin: !!u.is_admin,
      suspended: !!u.suspended
    };
  });

  if (search) {
    result = result.filter(u => 
      u.name.toLowerCase().includes(search) || 
      u.email.toLowerCase().includes(search)
    );
  }

  // Sort by createdAt descending
  result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(result);
});

// 4. User Detail View (Notes count only)
app.get('/api/admin/users/:userId/detail', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;
  const users = JsonDb.getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // Events attended
  const checkins = JsonDb.getCheckIns().filter(c => c.userId === userId);
  const events = JsonDb.getEvents();
  const attendedEvents = checkins.map(c => {
    const evt = events.find(e => e.id === c.eventId);
    return {
      eventId: c.eventId,
      eventName: evt ? evt.name : 'Unknown Event',
      checkedInAt: c.checkedInAt,
      stillPresent: c.stillPresent
    };
  });

  // Connections made
  const conns = JsonDb.getConnections().filter(c => c.userOneId === userId || c.userTwoId === userId);
  const connectionsMade = conns.map(c => {
    const otherId = c.userOneId === userId ? c.userTwoId : c.userOneId;
    const otherUser = users.find(u => u.id === otherId);
    return {
      connectionId: c.id,
      status: c.status,
      peerName: otherUser ? otherUser.name : 'Deleted Profile',
      createdAt: c.createdAt
    };
  });

  // Photos uploaded
  const photosUploaded = JsonDb.getPhotos()
    .filter(p => p.uploaderUserId === userId)
    .map(p => {
      const evt = events.find(e => e.id === p.eventId);
      return {
        id: p.id,
        fileUrl: p.fileUrl,
        uploadedAt: p.uploadedAt,
        hidden: p.hidden,
        eventName: evt ? evt.name : 'Unknown Event'
      };
    });

  // Reports filed against them
  const reportsAgainst = JsonDb.getReports()
    .filter(r => (r.targetType === 'user' && r.targetId === userId) || (r.targetType === 'photo' && photosUploaded.some(p => p.id === r.targetId)))
    .map(r => {
      const reporter = users.find(u => u.id === r.reporterUserId);
      return {
        id: r.id,
        reporterName: reporter ? reporter.name : 'Unknown User',
        targetType: r.targetType,
        reason: r.reason,
        createdAt: r.createdAt,
        reviewed: r.reviewed
      };
    });

  // Reports they've filed
  const reportsFiled = JsonDb.getReports()
    .filter(r => r.reporterUserId === userId)
    .map(r => {
      let targetName = 'Photo';
      if (r.targetType === 'user') {
        const targetU = users.find(u => u.id === r.targetId);
        targetName = targetU ? targetU.name : 'Deleted Profile';
      }
      return {
        id: r.id,
        targetType: r.targetType,
        targetName,
        reason: r.reason,
        createdAt: r.createdAt,
        reviewed: r.reviewed
      };
    });

  // Private notes count only
  const notesCount = JsonDb.getConnectionNotes().filter(n => n.authorUserId === userId).length;

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    deletedAt: user.deletedAt,
    is_admin: !!user.is_admin,
    suspended: !!user.suspended,
    attendedEvents,
    connectionsMade,
    photosUploaded,
    reportsAgainst,
    reportsFiled,
    notesCount
  });
});

// 5. User Account Management Actions
app.post('/api/admin/users/:userId/action', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;
  const { action, value } = req.body;
  const adminId = req.userId!;

  if (!action) {
    return res.status(400).json({ error: 'Missing action parameter.' });
  }

  const user = JsonDb.getUsers().find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  let actionLogged = '';

  if (action === 'suspend') {
    const isSuspended = value === true;
    JsonDb.updateUserSuspensionStatus(userId, isSuspended);
    actionLogged = isSuspended ? 'SUSPEND_USER' : 'REINSTATE_USER';
    
    if (isSuspended) {
      for (const [token, uid] of sessions.entries()) {
        if (uid === userId) {
          sessions.delete(token);
        }
      }
    }
  } else if (action === 'promote') {
    const isAdmin = value === true;
    JsonDb.updateUserAdminStatus(userId, isAdmin);
    actionLogged = isAdmin ? 'PROMOTE_ADMIN' : 'DEMOTE_ADMIN';
  } else if (action === 'force_delete') {
    JsonDb.deleteAccount(userId);
    actionLogged = 'FORCE_DELETE_USER';
    
    for (const [token, uid] of sessions.entries()) {
      if (uid === userId) {
        sessions.delete(token);
      }
    }
  } else {
    return res.status(400).json({ error: 'Invalid action.' });
  }

  // Insert audit log
  JsonDb.insertAuditLog({
    id: Math.random().toString(36).substring(2, 9),
    admin_user_id: adminId,
    action: actionLogged,
    target_type: 'user',
    target_id: userId,
    created_at: new Date().toISOString()
  });

  res.json({ success: true });
});

// 6. List All Events Across Organizers
app.get('/api/admin/events', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const events = JsonDb.getEvents();
  const checkins = JsonDb.getCheckIns();
  const photos = JsonDb.getPhotos();
  const reports = JsonDb.getReports();
  const users = JsonDb.getUsers();

  const list = events.map(e => {
    const eventCheckins = checkins.filter(c => c.eventId === e.id && c.stillPresent);
    const eventPhotos = photos.filter(p => p.eventId === e.id);
    const photoIds = new Set(eventPhotos.map(p => p.id));
    const pendingReports = reports.filter(r => !r.reviewed && r.targetType === 'photo' && photoIds.has(r.targetId)).length;
    const organizer = users.find(u => u.id === e.organizerId);

    return {
      id: e.id,
      name: e.name,
      date: e.date,
      location: e.location,
      checkInCode: e.checkInCode,
      createdAt: e.createdAt,
      deactivated: !!e.deactivated,
      hidden: !!e.hidden,
      organizerName: organizer ? organizer.name : 'Unknown Organizer',
      liveCheckinCount: eventCheckins.length,
      totalPhotos: eventPhotos.length,
      pendingReportsCount: pendingReports
    };
  });

  list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.json(list);
});

// Download Attendees CSV
app.get('/api/admin/events/:id/attendees.csv', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const eventId = req.params.id;
  const event = JsonDb.getEvents().find(e => e.id === eventId);
  if (!event) return res.status(404).json({ error: 'Event not found.' });

  const checkins = JsonDb.getCheckIns().filter(c => c.eventId === eventId);
  const users = JsonDb.getUsers();
  
  const activeCheckIns = checkins.filter(c => c.stillPresent).length;
  const totalAttendance = checkins.length;
  
  const eventPhotos = JsonDb.getPhotos().filter(p => p.eventId === eventId);
  const totalPhotos = eventPhotos.length;
  const flaggedPhotos = eventPhotos.filter(p => p.hidden).length;

  const eventConnections = JsonDb.getConnections().filter(conn => conn.eventId === eventId && conn.status === 'accepted').length;

  const tagCounts = new Map<string, number>();
  checkins.forEach(c => {
    const userTags = JsonDb.getInterestTags().filter(t => t.userId === c.userId);
    userTags.forEach(t => {
      const lower = t.tagText.toLowerCase();
      tagCounts.set(lower, (tagCounts.get(lower) || 0) + 1);
    });
  });
  const topTags = Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  let csvContent = 'EVENT CONNECT - RECAP REPORT\n\n';
  csvContent += `Event:,${event.name}\n`;
  csvContent += `Check-in Code:,${event.checkInCode}\n`;
  csvContent += `Generated At:,${new Date().toLocaleString()}\n\n`;

  csvContent += '--- LIVE STATS SUMMARY ---\n';
  csvContent += `Total Checked-In Attendance:,${totalAttendance}\n`;
  csvContent += `Active At This Moment:,${activeCheckIns}\n`;
  csvContent += `Connections Handshaked:,${eventConnections}\n`;
  csvContent += `Shared Live Photos Uploaded:,${totalPhotos}\n`;
  csvContent += `Flagged/Hidden Content:,${flaggedPhotos}\n\n`;

  csvContent += '--- ATTENDEES SUMMARY ---\n';
  if (checkins.length > 0) {
    csvContent += 'Serial Number,Check-in Time,First Name,Last Name,Email,Phone Number,Interest\n';
    csvContent += checkins.map((c, index) => {
      const checkInTime = new Date(c.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      if (c.historicalName) {
        const parts = c.historicalName.trim().split(' ');
        const firstName = `"${(parts[0] || '').replace(/"/g, '""')}"`;
        const lastName = `"${(parts.slice(1).join(' ') || '').replace(/"/g, '""')}"`;
        const email = `"${(c.historicalEmail || '').replace(/"/g, '""')}"`;
        const phone = `"${(c.historicalPhone || '').replace(/"/g, '""')}"`;
        const tags = `"${(c.historicalTags || 'N/A').replace(/"/g, '""')}"`;
        return `${index + 1},${checkInTime},${firstName},${lastName},${email},${phone},${tags}`;
      }
      
      const u = users.find(user => user.id === c.userId);
      if (!u) {
        const tags = `"${(JsonDb.getInterestTags().filter(t => t.userId === c.userId).map(t => t.tagText).join(', ') || 'N/A').replace(/"/g, '""')}"`;
        return `${index + 1},${checkInTime},"Deleted","User","deleted@eventconnect.local","N/A",${tags}`;
      }
      
      const parts = (u.name || '').trim().split(' ');
      const firstName = `"${(parts[0] || '').replace(/"/g, '""')}"`;
      const lastName = `"${(parts.slice(1).join(' ') || '').replace(/"/g, '""')}"`;
      const tags = `"${(JsonDb.getInterestTags().filter(t => t.userId === c.userId).map(t => t.tagText).join(', ') || 'N/A').replace(/"/g, '""')}"`;
      
      return `${index + 1},${checkInTime},${firstName},${lastName},"${u.email || ''}","${u.phone_number || 'N/A'}",${tags}`;
    }).filter(Boolean).join('\n');
    csvContent += '\n\n';
  } else {
    csvContent += 'No attendees checked in yet.\n\n';
  }

  csvContent += '--- TOP ATTENDEE INTEREST TAGS ---\n';
  if (topTags.length > 0) {
    topTags.forEach((t, i) => {
      csvContent += `${i + 1}. #${t.name},(${t.count} attendees)\n`;
    });
  } else {
    csvContent += 'No tags submitted by attendees.\n';
  }
  csvContent += '\n';

  csvContent += 'Event Connect GDPR & Privacy compliant recap.\n';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="event_${event.checkInCode}_attendees.csv"`);
  res.send(csvContent);
});

// 6. Close/Deactivate Event for Organizers
app.post('/api/events/:id/close', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const eventId = req.params.id;
  const userId = req.userId!;
  const event = JsonDb.getEvents().find(e => e.id === eventId);
  if (!event) return res.status(404).json({ error: 'Event not found.' });

  if (event.organizerId !== userId && !req.user?.is_admin) {
    return res.status(403).json({ error: 'Only the organizer or an administrator can deactivate this event.' });
  }

  JsonDb.closeEventManually(eventId);
  res.json({ success: true });
});

// 7. Close/Deactivate/Reactivate/Delete/Hide/Unhide Event Manually (Admin)
app.post('/api/admin/events/:eventId/action', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { eventId } = req.params;
  const { action } = req.body;
  const adminId = req.userId!;

  if (!['deactivate', 'reactivate', 'delete', 'hide', 'unhide'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action specified.' });
  }

  const events = JsonDb.getEvents();
  const event = events.find(e => e.id === eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found.' });
  }

  if (action === 'deactivate') {
    JsonDb.closeEventManually(eventId);
  } else if (action === 'reactivate') {
    JsonDb.reactivateEventManually(eventId);
  } else if (action === 'delete') {
    JsonDb.deleteEventManually(eventId);
  } else if (action === 'hide') {
    JsonDb.toggleHideEventManually(eventId, true);
  } else if (action === 'unhide') {
    JsonDb.toggleHideEventManually(eventId, false);
  }

  // Insert audit log
  JsonDb.insertAuditLog({
    id: Math.random().toString(36).substring(2, 9),
    admin_user_id: adminId,
    action: `${action.toUpperCase()}_EVENT`,
    target_type: 'event',
    target_id: eventId,
    created_at: new Date().toISOString()
  });

  res.json({ success: true });
});

// 8. View Audit Logs
app.get('/api/admin/audit-logs', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const logs = JsonDb.getAuditLogs();
  const users = JsonDb.getUsers();

  const formattedLogs = logs.map(l => {
    const admin = users.find(u => u.id === l.admin_user_id);
    return {
      id: l.id,
      adminId: l.admin_user_id,
      adminName: admin ? admin.name : 'Unknown Admin',
      action: l.action,
      targetType: l.target_type,
      targetId: l.target_id,
      createdAt: l.created_at
    };
  });

  formattedLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(formattedLogs);
});

// 9. Basic System Statistics
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const users = JsonDb.getUsers().filter(u => !u.deletedAt);
  const events = JsonDb.getEvents();
  const photos = JsonDb.getPhotos();
  const reports = JsonDb.getReports();

  const totalUsers = users.length;
  const totalEvents = events.length;
  const totalPhotos = photos.length;
  const pendingReports = reports.filter(r => !r.reviewed).length;
  const activeCheckins = JsonDb.getCheckIns().filter(c => c.stillPresent).length;

  res.json({
    totalUsers,
    totalEvents,
    totalPhotos,
    pendingReports,
    activeCheckins
  });
});


// --- VITE MIDDLEWARE SETUP & STATIC FILES ---

async function startServer() {
  await JsonDb.initializeFirestoreSync();
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
