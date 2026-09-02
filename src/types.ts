export interface User {
  id: string;
  name: string;
  email: string; // If deleted, we can blank it or make it empty
  passwordHash: string;
  phone_number?: string;
  createdAt: string;
  deletedAt: string | null;
  is_admin?: boolean;
  suspended?: boolean;
  socialLinks?: {
    whatsapp?: string;
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    twitter?: string;
  };
}

export interface InterestTag {
  id: string;
  userId: string;
  tagText: string;
}

export interface Event {
  id: string;
  organizerId: string;
  name: string;
  date: string;
  location: string;
  checkInCode: string;
  createdAt: string;
  deactivated?: boolean;
  hidden?: boolean;
  feedbackFormUrl?: string;
}

export interface EventCheckIn {
  id: string;
  eventId: string;
  userId: string;
  checkedInAt: string;
  visibility: 'public' | 'private';
  stillPresent: boolean;
  historicalName?: string;
  historicalEmail?: string;
  historicalPhone?: string;
  historicalTags?: string;
}

export interface Connection {
  id: string;
  userOneId: string; // Ordered alphabetically or lexicographically to prevent duplicates
  userTwoId: string;
  senderUserId?: string;
  eventId: string; // Event where they met
  status: 'pending' | 'accepted' | 'declined';
  sharingLevel: 'chat_only' | 'chat_and_contact';
  createdAt: string;
}

export interface ConnectionNote {
  id: string;
  connectionId: string;
  authorUserId: string;
  noteText: string;
  createdAt: string;
}

export interface Message {
  id: string;
  connectionId: string;
  senderUserId: string;
  content: string;
  sentAt: string;
}

export interface Photo {
  id: string;
  eventId: string;
  uploaderUserId: string;
  fileUrl: string; // Base64 or local URL
  caption?: string;
  uploadedAt: string;
  hidden: boolean;
  hiddenAt: string | null;
}

export interface Report {
  id: string;
  reporterUserId: string;
  targetType: 'user' | 'photo';
  targetId: string; // ID of the user or photo being reported
  reason: string;
  createdAt: string;
  reviewed: boolean;
}

export interface Block {
  id: string;
  blockerUserId: string;
  blockedUserId: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  admin_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  created_at: string;
}


export interface BroadcastMessage {
  id: string;
  eventId: string;
  senderId: string;
  message: string;
  sentAt: string;
}
