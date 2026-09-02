import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { 
  Users, 
  MapPin, 
  Calendar, 
  Lock, 
  Eye, 
  EyeOff, 
  Plus, 
  Image as ImageIcon, 
  MessageSquare, 
  LogOut, 
  Trash2, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle, 
  Clock, 
  Wifi, 
  WifiOff, 
  QrCode, 
  Share2, 
  User as UserIcon, 
  ChevronRight, 
  Send, 
  FileText, 
  TrendingUp, 
  Info,
  Camera,
  X,
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  CheckCheck,
  Phone,
  Video,
  MessageCircle,
  Search,
  MoreVertical,
  UserPlus,
  Sun,
  Moon
} from 'lucide-react';
import { getOfflineQueue, queueAction, removeQueuedAction, syncOfflineQueue, subscribeToQueue, QueuedAction } from './offlineStore.ts';
import QRScannerModal from './components/QRScannerModal.tsx';
import QRCodeModal from './components/QRCodeModal.tsx';
import AdminPanel from './components/AdminPanel.tsx';
import { initAuth, googleSignIn, getAccessToken } from './firebase.ts';

// Pre-defined list of lovely Unsplash stock photos for easy prototype photo feeding
const MOCK_EVENT_PHOTOS = [
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1505232458627-5ec90be5864c?w=600&auto=format&fit=crop&q=80'
];

async function safeParseJson(res: Response): Promise<any> {
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      return await res.json();
    } catch (e) {
      console.error('JSON parsing failed:', e);
      return { error: 'Failed to parse JSON response from server.' };
    }
  } else {
    try {
      const text = await res.text();
      console.error(`Received non-JSON response from ${res.url} (status ${res.status}):`, text.substring(0, 300));
    } catch (_) {}
    return { error: `Server returned an unexpected response format (Status ${res.status}).` };
  }
}

export default function App() {
  // Session & Authentication
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('ec_auth_token'));
  const [user, setUser] = useState<any | null>(() => {
    const saved = localStorage.getItem('ec_auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('ec_theme') === 'dark';
  });

  // Navigation State
  const [currentScreen, setCurrentScreen] = useState<'auth' | 'event-list' | 'event-hub' | 'profile'>(() => {
    const saved = localStorage.getItem('ec_current_screen');
    if (saved && localStorage.getItem('ec_auth_token')) {
      return saved as any;
    }
    return localStorage.getItem('ec_auth_token') ? 'event-list' : 'auth';
  });
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');

  const renderThemeToggle = () => (
    <button
      onClick={() => setIsDarkMode(!isDarkMode)}
      className="p-1.5 rounded-lg bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 text-white font-bold text-[9px] uppercase tracking-wider transition flex items-center gap-1 shadow-sm"
      title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );

  // UI State for forms
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPhoneError, setRegisterPhoneError] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [registerTags, setRegisterTags] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  // Social Links Form
  const [socialLinksForm, setSocialLinksForm] = useState({ whatsapp: '', instagram: '', facebook: '', linkedin: '', twitter: '', tiktok: '' });
  const [isEditingSocial, setIsEditingSocial] = useState(false);
  const [isSavingSocial, setIsSavingSocial] = useState(false);

  // Event Forms
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventCode, setNewEventCode] = useState('');
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);

  // Check-In State
  const [checkInCodeInput, setCheckInCodeInput] = useState('');
  const [checkInVisibility, setCheckInVisibility] = useState<'public' | 'private'>('public');
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  // App Data State
  const [events, setEvents] = useState<any[]>([]);
  const [currentEvent, setCurrentEvent] = useState<any | null>(() => {
    const saved = localStorage.getItem('ec_current_event');
    return saved ? JSON.parse(saved) : null;
  });
  const [eventCheckIn, setEventCheckIn] = useState<any | null>(() => {
    const saved = localStorage.getItem('ec_event_check_in');
    return saved ? JSON.parse(saved) : null;
  });
  const [attendees, setAttendees] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [photoCaption, setPhotoCaption] = useState('');
  const [connections, setConnections] = useState<any[]>([]);
  const [hasNewHandshake, setHasNewHandshake] = useState(false);

  const [activeConnection, setActiveConnection] = useState<any | null>(() => {
    const saved = localStorage.getItem('ec_active_connection');
    return saved ? JSON.parse(saved) : null;
  });
  const [viewingProfileOf, setViewingProfileOf] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [privateNoteInput, setPrivateNoteInput] = useState('');

  // Dashboard Stats State (For Organizer)
  const [dashboardStats, setDashboardStats] = useState<any | null>(null);

  // Modals & User actions
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'user' | 'photo'; id: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'message' } | null>(null);
  const [selectedFullScreenImage, setSelectedFullScreenImage] = useState<string | null>(null);

  // QR Code States
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showQrCodeModal, setShowQrCodeModal] = useState(false);
  const [qrCodeEvent, setQrCodeEvent] = useState<any | null>(null);

  // PWA & Connectivity Status
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<QueuedAction[]>([]);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Google Workspace Integration
  const [googleNeedsAuth, setGoogleNeedsAuth] = useState(false);
  const [isCreatingForm, setIsCreatingForm] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      () => setGoogleNeedsAuth(false),
      () => setGoogleNeedsAuth(true)
    );
    return () => unsubscribe();
  }, []);

  // Event hub active tab
  const [hubTab, setHubTab] = useState<'feed' | 'people' | 'connections' | 'organizer'>(() => {
    const saved = localStorage.getItem('ec_hub_tab');
    return (saved as any) || 'feed';
  });

  // References
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // --- STATE SYNCHRONIZATION WITH LOCALSTORAGE (Page Refresh Persistence) ---
  useEffect(() => {
    if (currentScreen) {
      localStorage.setItem('ec_current_screen', currentScreen);
    } else {
      localStorage.removeItem('ec_current_screen');
    }
  }, [currentScreen]);

  useEffect(() => {
    if (isDarkMode) {
      localStorage.setItem('ec_theme', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      localStorage.setItem('ec_theme', 'light');
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Protective Admin Redirect Check
  useEffect(() => {
    if (currentScreen === 'admin') {
      if (!token || !user || !user.is_admin) {
        showToast('Access Denied: Admin permissions required.', 'error');
        setCurrentScreen('event-list');
      }
    }
  }, [currentScreen, user, token]);

  useEffect(() => {
    if (currentEvent) {
      localStorage.setItem('ec_current_event', JSON.stringify(currentEvent));
    } else {
      localStorage.removeItem('ec_current_event');
    }
  }, [currentEvent]);

  useEffect(() => {
    if (eventCheckIn) {
      localStorage.setItem('ec_event_check_in', JSON.stringify(eventCheckIn));
    } else {
      localStorage.removeItem('ec_event_check_in');
    }
  }, [eventCheckIn]);

  useEffect(() => {
    if (activeConnection) {
      localStorage.setItem('ec_active_connection', JSON.stringify(activeConnection));
    } else {
      localStorage.removeItem('ec_active_connection');
    }
  }, [activeConnection]);

  useEffect(() => {
    if (hubTab) {
      localStorage.setItem('ec_hub_tab', hubTab);
    }
  }, [hubTab]);

  // Request browser Notification permissions on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Check for join code in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        setCheckInCodeInput(code);
        // Clear it from the URL and reset path to root
        const newUrl = window.location.origin + '/';
        window.history.replaceState({}, document.title, newUrl);
        
        if (token) {
          setCurrentScreen('event-list');
          setShowCheckInModal(true);
        } else {
          setAuthTab('signup');
          setCurrentScreen('auth');
          // Show toast guiding them
          setTimeout(() => showToast('Sign up to join the scanned event!', 'info'), 500);
        }
      }
    }
  }, [token]);

  // If user just authenticated and has a code waiting
  useEffect(() => {
    if (token && currentScreen === 'event-list' && checkInCodeInput && !eventCheckIn && !showCheckInModal) {
      setShowCheckInModal(true);
    }
  }, [token, currentScreen, checkInCodeInput, eventCheckIn, showCheckInModal]);

  // --- CONNECTIVITY & PWA ---
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('You are back online! Syncing queued actions...', 'success');
      // Trigger auto-sync if logged in
      if (token) {
        handleSync();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('You are offline. Offline queuing is active.', 'info');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to offline queue changes
    const unsubscribe = subscribeToQueue((q) => {
      setOfflineQueue(q);
    });

    // Load initial user details if token is valid
    if (token) {
      fetchCurrentUser();
      fetchEvents();
      fetchConnections();
      
      const savedScreen = localStorage.getItem('ec_current_screen');
      if (savedScreen && savedScreen !== 'auth') {
        setCurrentScreen(savedScreen as any);
      } else {
        setCurrentScreen('event-list');
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [token]);

  // Handle auto-scroll in chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Global polling for connections list (and thus new messages)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (token) {
      interval = setInterval(() => {
        if (isOnline) {
          fetchConnections();
        }
      }, 5000); // Poll every 5 seconds for new handshakes and messages
    }
    return () => clearInterval(interval);
  }, [token, isOnline]);

  // Polling for live chat and event directory updates
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (token && currentEvent) {
      fetchAttendees();
      fetchPhotos();
      if (activeConnection) {
        fetchChat(activeConnection.id);
      }
      if (currentEvent.organizerId === user?.id) {
        fetchDashboardStats();
      }
      fetchBroadcasts();

      interval = setInterval(() => {
        if (isOnline) {
          fetchAttendees();
          fetchPhotos();
          if (activeConnection) {
            fetchChat(activeConnection.id);
          }
          if (currentEvent.organizerId === user?.id) {
            fetchDashboardStats();
          }
          fetchBroadcasts();
        }
      }, 5000); // Poll every 5 seconds
    }
    return () => clearInterval(interval);
  }, [currentEvent, activeConnection, token, isOnline]);

  // --- UTILS & CORE ACTIONS ---
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'message' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleSync = async () => {
    if (!token) return;
    setSyncStatusMsg('Syncing offline actions...');
    const result = await syncOfflineQueue(token, (msg) => {
      setSyncStatusMsg(msg);
    });
    if (result) {
      showToast('Sync complete!', 'success');
      setSyncStatusMsg('');
      // Reload event states
      if (currentEvent) {
        fetchAttendees();
        fetchPhotos();
      }
      fetchEvents();
    } else {
      showToast('Some items failed to sync.', 'error');
    }
  };

  // --- API CALLS ---
  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const userData = await safeParseJson(res);
        setUser(userData);
        if (userData.socialLinks) {
          setSocialLinksForm(userData.socialLinks);
        }
        localStorage.setItem('ec_auth_user', JSON.stringify(userData));
      } else {
        handleLogout();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEvents = async () => {
    if (!isOnline) return;
    try {
      const res = await fetch('/api/events', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await safeParseJson(res);
        setEvents(data);
        // Ensure currentEvent is up-to-date with checkInCode if they refreshed
        if (currentEvent) {
          const updatedEvent = data.find((e: any) => e.id === currentEvent.id);
          if (updatedEvent && updatedEvent.checkInCode !== currentEvent.checkInCode) {
            setCurrentEvent(updatedEvent);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAttendees = async () => {
    if (!currentEvent || !isOnline) return;
    try {
      const res = await fetch(`/api/events/${currentEvent.id}/directory`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await safeParseJson(res);
        setAttendees(data);
      } else if (res.status === 403 || res.status === 404) {
        setCurrentEvent(null);
        setEventCheckIn(null);
        localStorage.removeItem('ec_current_event');
        localStorage.removeItem('ec_event_check_in');
        showToast('This event space has been deactivated or closed.', 'info');
        setCurrentScreen('event-list');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPhotos = async () => {
    if (!currentEvent || !isOnline) return;
    try {
      const res = await fetch(`/api/events/${currentEvent.id}/photos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await safeParseJson(res);
        setPhotos(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Track last message IDs for each connection to detect new incoming messages
  const lastMessageIdsRef = useRef<Record<string, string>>({});
  const acceptedConnectionsRef = useRef<string[]>([]);
  const seenBroadcastsRef = useRef<Set<string>>(new Set());
  const [broadcastInput, setBroadcastInput] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  useEffect(() => {
    if (hubTab === 'connections') {
      setHasNewHandshake(false);
    }
  }, [hubTab, connections]);

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gainNode.gain.setValueAtTime(0.12, start);
        gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      const now = audioCtx.currentTime;
      playTone(523.25, now, 0.15); // C5
      playTone(659.25, now + 0.08, 0.25); // E5
    } catch (err) {
      console.error('Failed to play tone:', err);
    }
  };

  const triggerNewMessageNotification = (peerName: string, content: string, conn: any) => {
    playNotificationSound();
    
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`Message from ${peerName}`, {
          body: content,
          tag: conn.id
        });
      } catch (err) {
        console.error('System notification failed', err);
      }
    }

    const abbreviatedMessage = content.length > 50 ? content.substring(0, 47) + '...' : content;
    
    setToast({
      message: `📩 ${peerName}: "${abbreviatedMessage}"`,
      type: 'message',
      connection: conn
    });
    
    setTimeout(() => {
      setToast(prev => {
        if (prev?.message.includes(peerName) && prev?.type === 'message') {
          return null;
        }
        return prev;
      });
    }, 5000);
  };

  const fetchConnections = async () => {
    if (!isOnline) return;
    try {
      const res = await fetch('/api/connections', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await safeParseJson(res);
        
        // Only trigger notifications if we already have populated the initial lastMessageIds
        const isFirstLoad = Object.keys(lastMessageIdsRef.current).length === 0;

        data.forEach((conn: any) => {
          if (conn.lastMessage) {
            const connId = conn.id;
            const msgId = conn.lastMessage.id;
            const lastSeenId = lastMessageIdsRef.current[connId];

            if (conn.lastMessage.senderUserId !== user?.id) {
              if (!isFirstLoad) {
                // If we have a different message ID than before, or it's a completely new connection we haven't seen messages for yet
                if (lastSeenId === undefined || lastSeenId !== msgId) {
                  triggerNewMessageNotification(conn.peer.name, conn.lastMessage.content, conn);
                }
              }
              // Update tracking ref
              lastMessageIdsRef.current[connId] = msgId;
            }
          }
        });

        // If first load and connections have last messages, populate our tracking ref
        if (isFirstLoad) {
          data.forEach((conn: any) => {
            if (conn.lastMessage) {
              lastMessageIdsRef.current[conn.id] = conn.lastMessage.id;
            }
          });
        }
        
        const acceptedIds = data.filter((c: any) => c.status === 'accepted').map((c: any) => c.id);
        const hasNew = acceptedIds.some((id: string) => !acceptedConnectionsRef.current.includes(id));
        
        if (hasNew && acceptedConnectionsRef.current.length > 0) {
          setHasNewHandshake(true);
        }
        acceptedConnectionsRef.current = acceptedIds;

        setConnections(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchChat = async (connectionId: string) => {
    if (!isOnline) return;
    try {
      const res = await fetch(`/api/connections/${connectionId}/chat`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await safeParseJson(res);
        setChatMessages(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBroadcasts = async () => {
    if (!currentEvent || !isOnline) return;
    try {
      const res = await fetch(`/api/events/${currentEvent.id}/broadcasts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const broadcasts = await safeParseJson(res);
        if (Array.isArray(broadcasts)) {
          broadcasts.forEach((b: any) => {
            if (!seenBroadcastsRef.current.has(b.id)) {
              seenBroadcastsRef.current.add(b.id);
              // Show toast for new broadcast if not sent by me
              if (b.senderId !== user?.id) {
                if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                showToast(`📢 Announcement: ${b.message}`, 'info');
              }
            }
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDashboardStats = async () => {
    if (!currentEvent || !isOnline) return;
    try {
      const res = await fetch(`/api/events/${currentEvent.id}/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await safeParseJson(res);
        setDashboardStats(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- ACTIONS HANDLERS ---

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      showToast('Please enter both email and password.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        if (data.user.socialLinks) setSocialLinksForm(data.user.socialLinks);
        localStorage.setItem('ec_auth_token', data.token);
        localStorage.setItem('ec_auth_user', JSON.stringify(data.user));
        showToast('Welcome back!', 'success');
        setCurrentScreen('event-list');
      } else {
        showToast(data.error || 'Authentication failed.', 'error');
      }
    } catch (err) {
      showToast('Network error during sign in.', 'error');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterPhoneError(false);
    setRegisterError('');

    if (!registerName || !registerEmail || !registerPassword) {
      setRegisterError('All required fields must be filled.');
      showToast('All fields are required.', 'error');
      return;
    }

    if (registerPhone) {
      const digitsOnly = registerPhone.replace(/\D/g, '');
      if (digitsOnly.length !== 11) {
        setRegisterPhoneError(true);
        setRegisterError('Phone number must be exactly 11 digits.');
        showToast('Phone number must be exactly 11 digits.', 'error');
        return;
      }
    }

    try {
      const tagsArray = registerTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerName,
          email: registerEmail,
          password: registerPassword,
          phone_number: registerPhone,
          interestTags: tagsArray
        })
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        if (data.user.socialLinks) setSocialLinksForm(data.user.socialLinks);
        localStorage.setItem('ec_auth_token', data.token);
        localStorage.setItem('ec_auth_user', JSON.stringify(data.user));
        showToast('Account created successfully!', 'success');
        setCurrentScreen('event-list');
      } else {
        setRegisterError(data.error || 'Registration failed.');
        showToast(data.error || 'Registration failed.', 'error');
      }
    } catch (err) {
      setRegisterError('Network error during registration.');
      showToast('Network error during registration.', 'error');
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('ec_auth_token');
    localStorage.removeItem('ec_auth_user');
    localStorage.removeItem('ec_current_screen');
    localStorage.removeItem('ec_current_event');
    localStorage.removeItem('ec_event_check_in');
    localStorage.removeItem('ec_active_connection');
    localStorage.removeItem('ec_hub_tab');
    setCurrentEvent(null);
    setEventCheckIn(null);
    setActiveConnection(null);
    setCurrentScreen('auth');
    showToast('Signed out successfully.', 'info');
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    setIsAddingTag(true);
    try {
      const res = await fetch('/api/user/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tag: newTag })
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setNewTag('');
        await fetchCurrentUser();
        showToast('Tag added successfully.', 'success');
      } else {
        showToast(data.error || 'Failed to add tag', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    } finally {
      setIsAddingTag(false);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    try {
      const res = await fetch(`/api/user/tags/${encodeURIComponent(tag)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchCurrentUser();
        showToast('Tag removed successfully.', 'success');
      } else {
        const data = await safeParseJson(res);
        showToast(data.error || 'Failed to remove tag', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  const handleSaveSocialLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSocial(true);
    try {
      const res = await fetch('/api/user/social', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ socialLinks: socialLinksForm })
      });
      if (res.ok) {
        await fetchCurrentUser();
        setIsEditingSocial(false);
        showToast('Social links updated successfully.', 'success');
      } else {
        const data = await safeParseJson(res);
        showToast(data.error || 'Failed to update social links', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    } finally {
      setIsSavingSocial(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const res = await fetch('/api/auth/delete', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setShowDeleteConfirm(false);
        handleLogout();
        showToast('Your profile and personal data have been completely deleted.', 'success');
      } else {
        showToast('Failed to delete account.', 'error');
      }
    } catch (err) {
      showToast('Network error deleting account.', 'error');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName || !newEventDate || !newEventLocation || !newEventCode) {
      showToast('All fields are required.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/events/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newEventName,
          date: newEventDate,
          location: newEventLocation,
          checkInCode: newEventCode
        })
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        showToast('Event created successfully!', 'success');
        setShowCreateEventModal(false);
        setNewEventName('');
        setNewEventCode('');
        fetchEvents();
      } else {
        showToast(data.error || 'Failed to create event.', 'error');
      }
    } catch (err) {
      showToast('Network error creating event.', 'error');
    }
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInCodeInput) {
      showToast('Please enter a check-in code.', 'error');
      return;
    }

    const payload = {
      checkInCode: checkInCodeInput,
      visibility: checkInVisibility
    };

    if (!isOnline) {
      // Offline support: Queue action locally
      queueAction('checkin', payload);
      showToast('You are offline. Your check-in is queued and will sync automatically once connected.', 'info');
      setShowCheckInModal(false);
      setCheckInCodeInput('');
      return;
    }

    try {
      const res = await fetch('/api/events/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        showToast(`Successfully checked in to ${data.event.name}!`, 'success');
        setCurrentEvent(data.event);
        setEventCheckIn(data.checkIn);
        setCheckInCodeInput('');
        setShowCheckInModal(false);
        setHubTab('feed');
        setCurrentScreen('event-hub');
        // Fetch fresh directory list
        fetchAttendees();
        fetchPhotos();
      } else {
        showToast(data.error || 'Failed to check in.', 'error');
      }
    } catch (err) {
      showToast('Error connecting to server.', 'error');
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEvent || !broadcastInput.trim()) return;
    setIsSendingBroadcast(true);
    try {
      const res = await fetch(`/api/events/${currentEvent.id}/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: broadcastInput })
      });
      if (res.ok) {
        showToast('Broadcast sent successfully!', 'success');
        setBroadcastInput('');
        fetchBroadcasts();
      } else {
        const data = await safeParseJson(res);
        showToast(data.error || 'Failed to send broadcast.', 'error');
      }
    } catch (err) {
      showToast('Network error.', 'error');
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const handleCheckOut = async () => {
    if (!currentEvent) return;
    if (!isOnline) {
      showToast('Check-out requires an active internet connection to update live directory.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/events/${currentEvent.id}/checkout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok || res.status === 404) {
        showToast('Checked out of event.', 'success');
        setCurrentEvent(null);
        setEventCheckIn(null);
        setActiveConnection(null);
        setViewingProfileOf(null);
        setCurrentScreen('event-list');
        fetchEvents();
      } else {
        showToast('Error checking out.', 'error');
      }
    } catch (err) {
      showToast('Network error.', 'error');
    }
  };

  const handleConnectRequest = async (peerId: string) => {
    if (navigator.vibrate) navigator.vibrate(50);
    if (!isOnline) {
      showToast('Connection requests require online status.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/connections/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          peerId,
          eventId: currentEvent.id,
          sharingLevel: 'chat_and_contact'
        })
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        showToast('Connect request sent!', 'success');
        fetchAttendees();
        fetchConnections();
      } else {
        showToast(data.error || 'Failed to request connection.', 'error');
      }
    } catch (err) {
      showToast('Network error.', 'error');
    }
  };

  const handleConnectionRespond = async (connectionId: string, accept: boolean) => {
    if (navigator.vibrate) navigator.vibrate(50);
    try {
      const res = await fetch(`/api/connections/${connectionId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ accept, sharingLevel: 'chat_and_contact' })
      });
      if (res.ok) {
        showToast(accept ? 'Connection accepted!' : 'Request declined.', 'success');
        fetchConnections();
        fetchAttendees();
      } else {
        showToast('Failed to process request.', 'error');
      }
    } catch (err) {
      showToast('Network error.', 'error');
    }
  };

  const handleBlockUser = async (blockedUserId: string) => {
    if (!confirm('Are you sure you want to block this user? This will end any connection, hide messages, and remove visibility in both directions.')) {
      return;
    }
    try {
      const res = await fetch('/api/blocks/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ blockedUserId })
      });
      if (res.ok) {
        showToast('User blocked successfully.', 'success');
        fetchAttendees();
        fetchConnections();
        setActiveConnection(null);
      } else {
        showToast('Failed to block user.', 'error');
      }
    } catch (err) {
      showToast('Network error.', 'error');
    }
  };

  // --- PHOTO SHARING & FLAG CONSENT ---

  // Drag-and-drop & Manual upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      await processPhotoUpload(base64String, photoCaption);
      setPhotoCaption('');
    };
    reader.readAsDataURL(file);
  };

  const handleQuickStockPhoto = async (photoUrl: string) => {
    await processPhotoUpload(photoUrl, photoCaption);
    setPhotoCaption('');
  };

  const processPhotoUpload = async (fileUrl: string, caption?: string) => {
    if (!currentEvent) return;

    if (!isOnline) {
      // Queue locally
      queueAction('photoupload', { eventId: currentEvent.id, fileUrl, caption });
      showToast('You are offline. Your photo upload is queued and will sync once connected!', 'info');
      return;
    }

    try {
      const res = await fetch(`/api/events/${currentEvent.id}/photos/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ fileUrl, caption })
      });
      if (res.ok) {
        showToast('Photo posted to live shared feed!', 'success');
        fetchPhotos();
      } else {
        const data = await safeParseJson(res);
        showToast(data.error || 'Failed to upload photo.', 'error');
      }
    } catch (err) {
      showToast('Network error uploading photo.', 'error');
    }
  };

  const handleFlagPhoto = async (photoId: string) => {
    setReportTarget({ type: 'photo', id: photoId });
    setReportReason('');
    setShowReportModal(true);
  };

  const submitReport = async () => {
    if (!reportTarget || !reportReason) {
      showToast('Please provide a reason for the report.', 'error');
      return;
    }

    try {
      if (reportTarget.type === 'photo') {
        // Flags photo directly on server
        const res = await fetch(`/api/photos/${reportTarget.id}/flag`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ reason: reportReason })
        });
        if (res.ok) {
          showToast('Photo has been immediately removed from public view and reported.', 'success');
          setShowReportModal(false);
          fetchPhotos();
        } else {
          showToast('Failed to submit report.', 'error');
        }
      } else {
        // Report user
        const res = await fetch('/api/reports/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            targetType: 'user',
            targetId: reportTarget.id,
            reason: reportReason
          })
        });
        if (res.ok) {
          showToast('User reported. Organizer team notified.', 'success');
          setShowReportModal(false);
        } else {
          showToast('Failed to submit report.', 'error');
        }
      }
    } catch (err) {
      showToast('Network error submitting report.', 'error');
    }
  };

  // --- PRIVATE NOTE & CHAT HANDLERS ---

  const handleSelectConnection = (conn: any) => {
    setActiveConnection(conn);
    setPrivateNoteInput(conn.privateNote || '');
    fetchChat(conn.id);
  };

  const handleSavePrivateNote = async () => {
    if (navigator.vibrate) navigator.vibrate(50);
    if (!activeConnection) return;
    try {
      const res = await fetch(`/api/connections/${activeConnection.id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ noteText: privateNoteInput })
      });
      if (res.ok) {
        showToast('Private note saved successfully.', 'success');
        fetchConnections();
      } else {
        showToast('Failed to save private note.', 'error');
      }
    } catch (err) {
      showToast('Network error.', 'error');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (navigator.vibrate) navigator.vibrate(50);
    if (!activeConnection || !chatInput.trim()) return;

    try {
      const res = await fetch(`/api/connections/${activeConnection.id}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: chatInput })
      });
      if (res.ok) {
        setChatInput('');
        fetchChat(activeConnection.id);
      } else {
        showToast('Failed to send message.', 'error');
      }
    } catch (err) {
      showToast('Network error.', 'error');
    }
  };

  // --- RECAP EXPORT HANDLER (Phase 4) ---
  const handleExportRecap = () => {
    if (!dashboardStats) return;

    let csvContent = 'EVENT CONNECT - RECAP REPORT\n\n';
    csvContent += `Event:,${dashboardStats.eventName}\n`;
    csvContent += `Check-in Code:,${dashboardStats.eventCode}\n`;
    csvContent += `Generated At:,${new Date().toLocaleString()}\n\n`;

    csvContent += '--- LIVE STATS SUMMARY ---\n';
    csvContent += `Total Checked-In Attendance:,${dashboardStats.totalAttendance}\n`;
    csvContent += `Active At This Moment:,${dashboardStats.activeCheckIns}\n`;
    csvContent += `Connections Handshaked:,${dashboardStats.eventConnections}\n`;
    csvContent += `Shared Live Photos Uploaded:,${dashboardStats.totalPhotos}\n`;
    csvContent += `Flagged/Hidden Content:,${dashboardStats.flaggedPhotos}\n\n`;

    csvContent += '--- ATTENDEES SUMMARY ---\n';
    if (dashboardStats.attendees && dashboardStats.attendees.length > 0) {
      csvContent += 'Serial Number,Check-in Time,First Name,Last Name,Email,Phone Number,Interest\n';
      csvContent += dashboardStats.attendees.map((a: any, index: number) => {
        const checkInTime = a.checkInTime;
        const firstName = `"${(a.firstName || '').replace(/"/g, '""')}"`;
        const lastName = `"${(a.lastName || '').replace(/"/g, '""')}"`;
        const email = `"${(a.email || '').replace(/"/g, '""')}"`;
        const phone = `"${(a.phone || '').replace(/"/g, '""')}"`;
        const interest = `"${(a.interest || '').replace(/"/g, '""')}"`;
        return `${index + 1},${checkInTime},${firstName},${lastName},${email},${phone},${interest}`;
      }).join('\n');
      csvContent += '\n\n';
    } else {
      csvContent += 'No attendees checked in yet.\n\n';
    }

    csvContent += '--- TOP ATTENDEE INTEREST TAGS ---\n';
    if (dashboardStats.interestTags && dashboardStats.interestTags.length > 0) {
      dashboardStats.interestTags.forEach((t: any, i: number) => {
        csvContent += `${i + 1}. #${t.name},(${t.count} attendees)\n`;
      });
    } else {
      csvContent += 'No tags submitted by attendees.\n';
    }
    csvContent += '\n';

    csvContent += 'Event Connect GDPR & Privacy compliant recap.\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${dashboardStats.eventName.replace(/\s+/g, '_')}_Recap.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Event summary downloaded!', 'success');
  };

  const handleQrScanSuccess = (scannedValue: string) => {
    setShowQrScanner(false);
    let extractedCode = scannedValue ? scannedValue.trim() : '';

    if (extractedCode.includes('code=')) {
      try {
        const urlObj = new URL(extractedCode.startsWith('http') ? extractedCode : `http://${extractedCode}`);
        const codeParam = urlObj.searchParams.get('code');
        if (codeParam) {
          extractedCode = codeParam.trim();
        }
      } catch {
        const parts = extractedCode.split('code=');
        if (parts[1]) {
          extractedCode = parts[1].split('&')[0].trim();
        }
      }
    }

    const finalCode = extractedCode.toUpperCase();
    setCheckInCodeInput(finalCode);
    setShowCheckInModal(true);
    showToast(`QR Scanned: Code ${finalCode}. Choose visibility to join.`, 'success');
  };

  const handleCreateFeedbackForm = async () => {
    const confirmed = window.confirm(
      "Create a new Google Form for feedback in your Google Drive?"
    );
    if (!confirmed) return;

    setIsCreatingForm(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Not authenticated with Google.");

      // 1. Create the form
      const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          info: {
            title: `${currentEvent.name} - Feedback`,
            documentTitle: `${currentEvent.name} Feedback Form`
          }
        })
      });
      const form = await createRes.json();

      if (!form.formId) throw new Error("Failed to create form. Ensure you have proper scopes and API is enabled.");

      // 2. Add some questions to the form
      await fetch(`https://forms.googleapis.com/v1/forms/${form.formId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [
            {
              createItem: {
                item: {
                  title: "How would you rate this event?",
                  questionItem: {
                    question: {
                      required: true,
                      scaleQuestion: {
                        low: 1,
                        high: 5,
                        lowLabel: "Poor",
                        highLabel: "Excellent"
                      }
                    }
                  }
                },
                location: { index: 0 }
              }
            },
            {
              createItem: {
                item: {
                  title: "Any additional feedback?",
                  questionItem: {
                    question: {
                      textQuestion: { paragraph: true }
                    }
                  }
                },
                location: { index: 1 }
              }
            }
          ]
        })
      });

      // 3. Save the form URL to the event
      const updateRes = await fetch(`/api/events/${currentEvent.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ feedbackFormUrl: form.responderUri })
      });
      
      if (updateRes.ok) {
        const updatedEvent = await safeParseJson(updateRes);
        setCurrentEvent(updatedEvent);
        showToast("Feedback form created successfully!", "success");
      } else {
        throw new Error("Form created, but failed to link to event.");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to create form", "error");
    } finally {
      setIsCreatingForm(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await googleSignIn();
      showToast('Connected to Google!', 'success');
    } catch (err) {
      showToast('Failed to connect to Google.', 'error');
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className={`${isDarkMode ? 'dark ' : ''}min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-start p-3 sm:p-6 sm:py-10 font-sans selection:bg-indigo-100:bg-indigo-900 selection:text-indigo-900:text-indigo-100 transition-colors duration-200`}>

      {/* Offline Banner / Sync Control */}
      {!isOnline && (
        <div className="w-full max-w-md bg-amber-50/80 backdrop-blur-sm border border-amber-200 text-amber-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs mb-5 animate-pulse">
          <div className="flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-amber-600" />
            <span className="font-medium">Currently Offline. {offlineQueue.length > 0 ? `Queued actions: ${offlineQueue.length}` : 'Browsing offline.'}</span>
          </div>
          {offlineQueue.length > 0 && (
            <span className="bg-amber-200 text-amber-900 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
              Queued
            </span>
          )}
        </div>
      )}

      {isOnline && offlineQueue.length > 0 && (
        <div className="w-full max-w-md bg-emerald-50/80 backdrop-blur-sm border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs mb-5">
          <div className="flex items-center gap-2.5">
            <Wifi className="w-4 h-4 text-emerald-600 animate-bounce" />
            <span className="font-semibold">Connected! You have {offlineQueue.length} queued action(s) to sync.</span>
          </div>
          <button 
            onClick={handleSync}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition"
          >
            Sync Now
          </button>
        </div>
      )}

      {/* Main Responsive Mobile Frame Wrapper */}
      <div className="w-full max-w-md md:max-w-5xl bg-white border border-slate-200 rounded-[28px] shadow-2xl flex flex-col overflow-hidden h-[88vh] sm:h-[90vh] max-h-[920px] relative text-slate-800">
        
        {/* Toast Notification */}
        {toast && (
          <div 
            onClick={() => {
              if (toast.type === 'message' && toast.connection) {
                setActiveConnection(toast.connection);
                setCurrentScreen('event-hub');
                setHubTab('connections');
                setToast(null);
              }
            }}
            className={`absolute top-4 left-4 right-4 z-50 p-3 rounded-xl shadow-lg flex items-center justify-between gap-2 border border-slate-100 text-xs transition duration-300 transform translate-y-0 font-medium ${
              toast.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-md' 
                : toast.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800 shadow-md'
                : toast.type === 'message'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-950 shadow-lg ring-2 ring-indigo-500/10 cursor-pointer hover:bg-indigo-100 transition duration-150'
                : 'bg-slate-50 border-slate-100 text-slate-800 shadow-md'
            }`}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              {toast.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : toast.type === 'message' ? (
                <MessageSquare className="w-4 h-4 text-indigo-600 shrink-0 animate-bounce" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="truncate">{toast.message}</span>
            </div>
            {toast.type === 'message' && (
              <span className="text-[9px] bg-indigo-700 text-white font-black px-2 py-1 rounded-lg uppercase tracking-wider shrink-0">
                Chat
              </span>
            )}
          </div>
        )}

        {/* Dynamic Screen Rendering */}
        <AnimatePresence mode="wait">
        
        {/* SCREEN 1: AUTHENTICATION */}
        {currentScreen === 'auth' && (
          <motion.div 
            key="auth"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-6 flex flex-col justify-between flex-1 bg-white overflow-y-auto relative"
          >
            <div className="absolute top-4 right-4 z-10 bg-slate-100 dark:bg-slate-800 rounded-lg shadow-sm">
              {renderThemeToggle()}
            </div>
            <div className="w-full max-w-md md:max-w-lg mx-auto my-auto py-4 flex flex-col justify-between min-h-full">
              <div className="text-center mt-2">
                <div className="w-16 h-16 bg-[#075E54] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#075E54]/20">
                  <Users className="w-8 h-8 text-[#25D366]" />
                </div>
                <h1 className="text-2xl font-black tracking-tight text-[#111b21]">EventConnect</h1>
                <p className="text-xs text-[#54656f] mt-1.5 max-w-[280px] mx-auto leading-relaxed">WhatsApp style instant check-ins, tactile networking & live photo streams.</p>
              </div>

              <div className="my-6">
              {/* Tab headers */}
              <div className="grid grid-cols-2 bg-[#e9edef] p-1.5 rounded-xl mb-6">
                <button 
                  onClick={() => setAuthTab('signin')}
                  className={`py-2.5 rounded-lg text-xs font-bold transition-all duration-200 ${authTab === 'signin' ? 'bg-[#00A884] text-white shadow-md' : 'text-[#54656f] hover:text-[#111b21]'}`}
                >
                  Sign In
                </button>
                <button 
                  onClick={() => setAuthTab('signup')}
                  className={`py-2.5 rounded-lg text-xs font-bold transition-all duration-200 ${authTab === 'signup' ? 'bg-[#00A884] text-white shadow-md' : 'text-[#54656f] hover:text-[#111b21]'}`}
                >
                  Sign Up
                </button>
              </div>

              {authTab === 'signin' ? (
                <form id="signin-form" onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-[#54656f] uppercase tracking-wider mb-1.5">Email Address</label>
                    <input 
                      type="email" 
                      required
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full bg-slate-50 focus:bg-white border border-slate-200 transition-colors rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A884]/20 focus:border-[#00A884] text-[#111b21]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#54656f] uppercase tracking-wider mb-1.5">Password</label>
                    <input 
                      type="password" 
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full bg-slate-50 focus:bg-white border border-slate-200 transition-colors rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A884]/20 focus:border-[#00A884] text-[#111b21]"
                    />
                  </div>
                  <button type="submit" className="w-full bg-[#00A884] hover:bg-[#008f70] text-white font-bold py-3 rounded-xl text-xs transition mt-6 shadow-md shadow-[#00A884]/20 uppercase tracking-widest">
                    Sign In to Portal
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-3.5">
                  {registerError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3 rounded-xl flex items-center justify-center text-center">
                      {registerError}
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] font-bold text-[#54656f] uppercase tracking-wider mb-1">Full Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Your Name"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className="w-full bg-slate-50 focus:bg-white border border-slate-200 transition-colors rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A884]/20 focus:border-[#00A884] text-[#111b21]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#54656f] uppercase tracking-wider mb-1">Email Address</label>
                    <input 
                      type="email" 
                      required
                      placeholder="you@example.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      className="w-full bg-slate-50 focus:bg-white border border-slate-200 transition-colors rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A884]/20 focus:border-[#00A884] text-[#111b21]"
                    />
                  </div>
                  <div>
                    <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${registerPhoneError ? 'text-rose-500' : 'text-[#54656f]'}`}>Phone Number</label>
                    <input 
                      type="tel" 
                      placeholder="0800-000-0000"
                      value={registerPhone}
                      onChange={(e) => { setRegisterPhone(e.target.value); setRegisterPhoneError(false); }}
                      className={`w-full bg-white border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A884]/20 text-[#111b21] ${registerPhoneError ? 'border-rose-500 focus:border-rose-500' : 'border-slate-200 focus:border-[#00A884]'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#54656f] uppercase tracking-wider mb-1">Password</label>
                    <input 
                      type="password" 
                      required
                      placeholder="At least 6 characters"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      className="w-full bg-slate-50 focus:bg-white border border-slate-200 transition-colors rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A884]/20 focus:border-[#00A884] text-[#111b21]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[11px] font-bold text-[#54656f] uppercase tracking-wider">Interest Tags</label>
                      <span className="text-[10px] text-slate-400 font-medium">Comma separated</span>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Designer, Videographer, Content Creator, AI, Website Developer"
                      value={registerTags}
                      onChange={(e) => setRegisterTags(e.target.value)}
                      className="w-full bg-slate-50 focus:bg-white border border-slate-200 transition-colors rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A884]/20 focus:border-[#00A884] text-[#111b21]"
                    />
                  </div>
                  <button type="submit" className="w-full bg-[#00A884] hover:bg-[#008f70] text-white font-bold py-3 rounded-xl text-xs transition mt-6 shadow-md shadow-[#00A884]/20 uppercase tracking-widest">
                    Create Profile
                  </button>
                </form>
              )}
            </div>

            <div className="text-center text-[10px] text-slate-400 flex items-center justify-center gap-1 font-medium mt-2">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>GDPR compliant. All accounts deleted cascade fully.</span>
            </div>
          </div>
        </motion.div>
        )}

        {/* SCREEN 2: EVENT DIRECTORY LIST & JOIN SCREEN */}
        {currentScreen === 'event-list' && (
          <motion.div 
            key="event-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col justify-between flex-1 h-full overflow-hidden"
          >
            
            {/* Header */}
            <div className="p-4 bg-[#075E54] text-white shadow-md flex items-center justify-between shrink-0 z-10">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#25D366]" />
                <span className="font-bold text-sm tracking-wide">EventConnect</span>
              </div>
              <div className="flex items-center gap-2">
                {renderThemeToggle()}
                {deferredPrompt && (
                  <button 
                    onClick={handleInstallClick}
                    className="p-1.5 px-3 rounded-lg bg-[#25D366] hover:bg-emerald-500 text-[#075E54] font-bold text-[9px] uppercase tracking-wider transition flex items-center gap-1 shadow"
                    title="Install App"
                  >
                    <span>Install</span>
                  </button>
                )}
                {user?.is_admin && (
                  <button 
                    onClick={() => setCurrentScreen('admin')}
                    className="p-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[9px] uppercase tracking-wider transition flex items-center gap-1"
                    title="Admin Control Panel"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>Admin</span>
                  </button>
                )}
                <button 
                  onClick={() => setCurrentScreen('profile')}
                  className="p-2 rounded-full hover:bg-white text-white transition"
                  title="Profile Settings"
                >
                  <UserIcon className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-2 rounded-full hover:bg-white text-rose-200 hover:text-rose-100 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content body */}
            <div className="p-4 flex-1 space-y-6 overflow-y-auto bg-[#f0f2f5]">
              
              {/* Check-In Event Launcher Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div className="w-10 h-10 bg-[#e7fce9] border border-[#bbf7d0] rounded-xl flex items-center justify-center text-[#075E54] shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-[#111b21]">Join Live Event</h3>
                    <p className="text-[10px] text-[#54656f] font-medium">Check in to unlock tactile networking & chats</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button 
                    onClick={() => setShowQrScanner(true)}
                    className="bg-[#00A884] hover:bg-[#008f70] text-white font-bold py-2.5 rounded-xl text-[10px] transition shadow-md shadow-[#00A884]/20 uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scan QR</span>
                  </button>
                  <button 
                    onClick={() => {
                      setCheckInCodeInput('');
                      setShowCheckInModal(true);
                    }}
                    className="bg-[#e9edef] hover:bg-[#d1d7db] text-[#111b21] font-bold py-2.5 rounded-xl text-[10px] transition uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#075E54]" />
                    <span>Enter Code</span>
                  </button>
                </div>
              </div>

              {/* Browse Live Events */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#54656f]">Active Events</h2>
                  <button 
                    onClick={() => setShowCreateEventModal(true)}
                    className="text-xs text-[#00A884] hover:text-[#008f70] flex items-center gap-0.5 font-bold uppercase tracking-wider"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Host Event</span>
                  </button>
                </div>

                {events.length === 0 ? (
                  <div className="text-center py-10 bg-white border border-slate-200 rounded-2xl">
                    <Clock className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs text-[#111b21] font-bold">No active events found.</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Be the first to create one!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {events.map((evt) => (
                      <div key={evt.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-2 relative hover:border-[#00A884]/40 transition">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-xs text-[#111b21] flex items-center gap-1.5">
                              <span>{evt.name}</span>
                              {evt.deactivated && (
                                <span className="bg-rose-100 text-rose-700 border border-rose-200 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0">Closed</span>
                              )}
                              {evt.hidden && (
                                <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0">Hidden</span>
                              )}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#54656f] mt-1.5 font-medium">
                              <MapPin className="w-3 h-3 text-[#00A884]" />
                              <span>{evt.location}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#54656f] mt-0.5 font-medium">
                              <Calendar className="w-3 h-3 text-[#00A884]" />
                              <span>{evt.date}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[9px] text-slate-400 font-medium">Hosted by you: <strong className="text-slate-600">{evt.organizerId === user?.id ? 'Yes' : 'No'}</strong></span>
                          {evt.deactivated ? (
                            <span className="text-[9px] font-bold uppercase text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">Venue Closed</span>
                          ) : (
                            <button 
                              onClick={() => {
                                if (user?.is_admin) {
                                  setCheckInCodeInput(evt.checkInCode);
                                } else {
                                  setCheckInCodeInput('');
                                }
                                setShowCheckInModal(true);
                              }}
                              className="text-[10px] text-[#00A884] hover:text-[#008f70] font-bold uppercase tracking-wider flex items-center gap-0.5"
                            >
                              <span>Join</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Footer summary */}
            <div className="p-3 border-t border-slate-200 bg-white flex items-center justify-between text-[10px] text-[#54656f] font-medium shrink-0 mt-auto">
              <span>Logged in as: <strong className="text-[#111b21] font-bold">{user?.name}</strong></span>
              <button 
                onClick={() => setCurrentScreen('profile')}
                className="hover:text-[#00A884] font-bold underline"
              >
                Profile Settings
              </button>
            </div>

          </motion.div>
        )}

        {/* SCREEN 3: EVENT HUB (FEED, DIRECTORY, CHAT, DASHBOARD) */}
        {currentScreen === 'event-hub' && currentEvent && (
          <motion.div 
            key="event-hub"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col justify-between flex-1 h-full overflow-hidden"
          >
            
            {/* Header / Event Details banner */}
            <div className="bg-[#075E54] text-white shadow-md shrink-0 z-20">
              <div className="p-3.5 flex justify-between items-start border-b border-[#004d40]">
                <div>
                  <span className="bg-[#25D366] text-[#075E54] px-2 py-0.5 rounded-full text-[8px] font-bold tracking-wider uppercase inline-block mb-1">Checked In</span>
                  <h2 className="font-bold text-sm tracking-tight">{currentEvent.name}</h2>
                  <div className="flex items-center gap-1.5 text-[9.5px] text-teal-100/90 font-medium mt-0.5">
                    <MapPin className="w-3 h-3 text-[#25D366]" />
                    <span>{currentEvent.location}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {renderThemeToggle()}
                  {deferredPrompt && (
                    <button 
                      onClick={handleInstallClick}
                      className="bg-[#25D366] text-[#075E54] px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition shadow"
                    >
                      Install
                    </button>
                  )}
                  <button 
                    onClick={handleCheckOut}
                    className="bg-black/20 hover:bg-rose-700/80 text-rose-200 hover:text-white border border-white/20 px-2.5 py-1 rounded-lg text-[10px] font-bold transition"
                  >
                    Leave Event
                  </button>
                </div>
              </div>

              {/* Navigation Tabs (Top) */}
              <div className="flex justify-around bg-[#075E54] px-1 text-center border-t border-[#004d40]">
                <button 
                  onClick={() => { setHubTab('feed'); setActiveConnection(null); setViewingProfileOf(null); }}
                  className={`py-2.5 text-xs font-bold transition uppercase tracking-wider flex-1 flex items-center justify-center gap-1 ${hubTab === 'feed' && !activeConnection && !viewingProfileOf ? 'border-b-4 border-[#25D366] text-white' : 'text-teal-100/70 hover:text-white'}`}
                >
                  <span>Updates</span>
                </button>
                <button 
                  onClick={() => { setHubTab('people'); setActiveConnection(null); setViewingProfileOf(null); }}
                  className={`py-2.5 text-xs font-bold transition uppercase tracking-wider flex-1 flex items-center justify-center gap-1 ${hubTab === 'people' && !activeConnection && !viewingProfileOf ? 'border-b-4 border-[#25D366] text-white' : 'text-teal-100/70 hover:text-white'}`}
                >
                  <span>People ({attendees.length + 1})</span>
                </button>
                <button 
                  onClick={() => { setHubTab('connections'); setViewingProfileOf(null); }}
                  className={`relative py-2.5 text-xs font-bold transition uppercase tracking-wider flex-1 flex items-center justify-center gap-1 ${(hubTab === 'connections' || activeConnection) && !viewingProfileOf ? 'border-b-4 border-[#25D366] text-white' : 'text-teal-100/70 hover:text-white'}`}
                >
                  <span>Chats</span>
                  {hasNewHandshake && (
                    <span className="w-2 h-2 bg-[#25D366] rounded-full animate-pulse"></span>
                  )}
                </button>
                {currentEvent.organizerId === user?.id && (
                  <button 
                    onClick={() => { setHubTab('organizer'); setActiveConnection(null); setViewingProfileOf(null); }}
                    className={`py-2.5 text-xs font-bold transition uppercase tracking-wider flex-1 flex items-center justify-center gap-1 ${hubTab === 'organizer' && !activeConnection && !viewingProfileOf ? 'border-b-4 border-[#25D366] text-white' : 'text-teal-100/70 hover:text-white'}`}
                  >
                    <span>Insights</span>
                  </button>
                )}
              </div>
            </div>

            {/* Event Hub Tab Views */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#f0f2f5]">
              
              {/* Profile View */}
              {viewingProfileOf && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <button 
                      onClick={() => setViewingProfileOf(null)}
                      className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition"
                    >
                      <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Back
                    </button>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Profile</h3>
                  </div>
                  
                  {/* Profile Card */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-lg border-2 border-white">
                        {(viewingProfileOf.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">{viewingProfileOf.name}</h2>
                      </div>
                    </div>
                    
                    {viewingProfileOf.interestTags && viewingProfileOf.interestTags.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Interests</h4>
                        <div className="flex flex-wrap gap-1">
                          {viewingProfileOf.interestTags.map((t: string, i: number) => (
                            <span key={i} className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[9px] px-2 py-0.5 rounded-full font-bold">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {viewingProfileOf.socialLinks && Object.values(viewingProfileOf.socialLinks).some(Boolean) && (
                      <div className="mb-4">
                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Social Links</h4>
                        <div className="flex flex-wrap gap-2">
                          {viewingProfileOf.socialLinks.whatsapp && (
                            <a href={`https://wa.me/${viewingProfileOf.socialLinks.whatsapp}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 transition" title="WhatsApp">
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984 0 1.762.459 3.48 1.332 5.001L2 22l5.122-1.335a9.92 9.92 0 0 0 4.888 1.282h.005c5.505 0 9.988-4.478 9.989-9.985 0-2.667-1.038-5.175-2.925-7.062A9.919 9.919 0 0 0 12.012 2zm0 18.28a8.27 8.27 0 0 1-4.223-1.154l-.303-.18-3.04.793.812-2.961-.198-.315a8.267 8.267 0 0 1-1.272-4.474c0-4.562 3.712-8.274 8.273-8.274 2.208 0 4.284.861 5.845 2.424 1.562 1.562 2.422 3.639 2.421 5.848 0 4.563-3.713 8.274-8.305 8.274zm4.536-6.202c-.248-.124-1.468-.724-1.696-.807-.228-.083-.394-.124-.559.124-.165.248-.641.807-.786.972-.145.165-.29.186-.538.062-.248-.124-1.048-.387-1.996-1.232-.738-.658-1.236-1.47-1.381-1.718-.145-.248-.015-.382.109-.505.111-.11.248-.29.372-.435.124-.145.165-.248.248-.413.083-.165.041-.31-.021-.434-.062-.124-.559-1.343-.765-1.839-.2-.483-.404-.418-.559-.426-.145-.008-.31-.01-.475-.01s-.434.062-.661.31c-.228.248-.868.848-.868 2.068 0 1.22.889 2.398 1.013 2.563.124.165 1.75 2.673 4.238 3.748.592.257 1.054.41 1.414.524.594.189 1.134.162 1.56.098.476-.071 1.468-.6 1.674-1.18.207-.579.207-1.075.145-1.18-.062-.103-.227-.186-.475-.31z"/>
                              </svg>
                            </a>
                          )}
                          {viewingProfileOf.socialLinks.instagram && (
                            <a href={`https://instagram.com/${viewingProfileOf.socialLinks.instagram}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-pink-50 text-pink-700 border border-pink-100 hover:bg-pink-100 transition" title="Instagram">
                              <Instagram className="w-5 h-5" />
                            </a>
                          )}
                          {viewingProfileOf.socialLinks.facebook && (
                            <a href={`https://facebook.com/${viewingProfileOf.socialLinks.facebook}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition" title="Facebook">
                              <Facebook className="w-5 h-5" />
                            </a>
                          )}
                          {viewingProfileOf.socialLinks.linkedin && (
                            <a href={`https://linkedin.com/in/${viewingProfileOf.socialLinks.linkedin}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100 transition" title="LinkedIn">
                              <Linkedin className="w-5 h-5" />
                            </a>
                          )}
                          {viewingProfileOf.socialLinks.twitter && (
                            <a href={`https://x.com/${viewingProfileOf.socialLinks.twitter}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-slate-100 text-slate-800 border border-slate-100 hover:bg-slate-200 transition" title="X / Twitter">
                              <Twitter className="w-5 h-5" />
                            </a>
                          )}
                          {viewingProfileOf.socialLinks.tiktok && (
                            <a href={`https://tiktok.com/@${viewingProfileOf.socialLinks.tiktok}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-slate-900 text-white border border-slate-700 hover:bg-slate-800 transition" title="TikTok">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 2.78-1.15 5.54-3.11 7.49-2.2 2.14-5.32 3.12-8.31 2.5-3.07-.63-5.59-2.73-6.66-5.69-.99-2.76-.32-5.99 1.65-8.21 2.22-2.49 5.84-3.4 9.01-2.29v4.14c-1.61-.43-3.42-.15-4.75.92-1.39 1.12-2.02 3.02-1.55 4.75.48 1.77 2.1 3.2 3.93 3.5 1.76.29 3.65-.21 4.88-1.53 1.34-1.43 1.81-3.45 1.81-5.45V.02h-1.5z"/>
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Uploaded Photos */}
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-700" />
                      Shared Photos
                    </h4>
                    {photos.filter(p => p.uploaderId === viewingProfileOf.id).length === 0 ? (
                      <p className="text-[10px] text-slate-400 font-medium bg-white p-4 rounded-xl border border-slate-100 text-center">No photos shared yet.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {photos.filter(p => p.uploaderId === viewingProfileOf.id).map(p => (
                          <div key={p.id} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] relative flex flex-col group">
                            <img src={p.fileUrl} alt="Shared event" className="w-full aspect-square object-cover" />
                            {p.caption && (
                              <div className="p-2 bg-white flex-1 flex flex-col justify-center">
                                <p className="text-[10px] text-slate-700 font-medium italic break-words line-clamp-2">
                                  {p.caption}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 1: SHARED LIVE PHOTO FEED */}
              {hubTab === 'feed' && !activeConnection && !viewingProfileOf && (
                <div className="space-y-4">
                  {/* Share photo action header */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#54656f] mb-2.5">Share a Live Photo</h3>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Add a short caption... (optional)"
                        className="w-full bg-[#f0f2f5] border border-slate-200 text-[#111b21] text-xs rounded-xl focus:ring-[#00A884] focus:border-[#00A884] block p-2.5"
                        value={photoCaption}
                        onChange={e => setPhotoCaption(e.target.value)}
                        maxLength={100}
                      />
                      {/* File Upload Trigger */}
                      <label className="bg-[#e7fce9] hover:bg-[#d5f9d9] border border-[#bbf7d0] p-3 rounded-xl cursor-pointer flex flex-col items-center justify-center gap-1.5 transition text-[#075E54] w-full shadow-sm">
                        <Camera className="w-5 h-5 text-[#00A884] animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Camera / Select Photo</span>
                        <input 
                          type="file" 
                          accept="image/*"
                          className="hidden"
                          onChange={handlePhotoUpload}
                        />
                      </label>
                    </div>
                    <div className="text-[9px] text-[#54656f] font-medium text-center mt-3 flex items-center justify-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-[#00A884]" />
                      <span>Photos only visible to checked-in attendees. Attendees can hide any image.</span>
                    </div>
                  </div>

                  {/* Photos Grid */}
                  <div>
                    <h3 className="text-xs font-bold text-[#54656f] uppercase tracking-wider mb-2.5">Live Event Stream</h3>
                    {photos.length === 0 ? (
                      <div className="text-center py-10 bg-white border border-slate-200 rounded-2xl">
                        <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-xs text-[#111b21] font-bold">Shared feed is empty</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Post a snap to begin the stream!</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                        {photos.map(p => (
                          <div key={p.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm relative group flex flex-col">
                            <img 
                               src={p.fileUrl} 
                               alt="Shared Event snap" 
                               className="w-full h-32 object-cover cursor-pointer hover:opacity-90 transition duration-150"
                               referrerPolicy="no-referrer"
                               onClick={() => setSelectedFullScreenImage(p.fileUrl)}
                            />
                            {p.caption && (
                              <div className="p-2 pb-0 flex-1">
                                <p className="text-[10px] text-[#111b21] font-medium italic break-words line-clamp-2">
                                  {p.caption}
                                </p>
                              </div>
                            )}
                            <div className="p-2 flex items-center justify-between bg-[#f0f2f5] border-t border-slate-200 text-[#111b21] mt-auto">
                              <div className="overflow-hidden">
                                <p 
                                  className="text-[9px] font-bold truncate text-[#111b21] cursor-pointer hover:text-[#00A884] hover:underline inline-block"
                                  onClick={() => {
                                    const profile = attendees.find(a => a.id === p.uploaderId) || connections.find(c => c.peer.id === p.uploaderId)?.peer || { id: p.uploaderId, name: p.uploaderName, interestTags: [], socialLinks: {} };
                                    setViewingProfileOf(profile);
                                  }}
                                >
                                  {p.uploaderName}
                                </p>
                                <p className="text-[8px] text-[#54656f] font-medium mt-0.5">{new Date(p.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                              <button 
                                onClick={() => handleFlagPhoto(p.id)}
                                className="p-1 rounded-lg bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition"
                                title="Report or flag photo"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: LIVE ATTENDEE DIRECTORY */}
              {hubTab === 'people' && !activeConnection && !viewingProfileOf && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#54656f] uppercase tracking-wider">Checked In Attendees</h3>
                    <span className="text-[9px] bg-[#e7fce9] border border-[#bbf7d0] text-[#075E54] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Active now</span>
                  </div>

                  {attendees.length === 0 ? (
                    <div className="text-center py-10 bg-white border border-slate-200 rounded-2xl">
                      <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs text-[#111b21] font-bold">No other checked-in attendees visible.</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Invite others using the event check-in code!</p>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Current User */}
                    {user && (
                      <div className="bg-[#e7fce9]/60 border border-[#bbf7d0] rounded-2xl p-4 flex flex-col">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#075E54] text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                              {user.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 
                                  className="font-bold text-xs text-[#075E54] cursor-pointer hover:underline"
                                  onClick={() => setViewingProfileOf(user)}
                                >
                                  {user.name} (You)
                                </h4>
                                {eventCheckIn?.visibility === 'private' && (
                                  <span className="bg-slate-200/80 text-slate-600 font-semibold px-2 py-0.5 rounded-full text-[8px]" title="Private Profile: Only mutual connections see contact information">Private</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {user.interestTags && user.interestTags.length > 0 ? (
                                  user.interestTags.map((t: string, i: number) => (
                                    <span key={i} className="bg-white border border-[#bbf7d0] text-[#075E54] text-[8px] px-2 py-0.5 rounded-full font-bold">
                                      #{t}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[9px] text-slate-400 font-medium italic">No interests specified</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setSocialLinksForm(user.socialLinks || { whatsapp: '', instagram: '', facebook: '', linkedin: '', twitter: '', tiktok: '' });
                            setIsEditingSocial(true);
                          }}
                          className="mt-3 w-full bg-white border border-[#00A884] text-[#075E54] hover:bg-[#d5f9d9] font-bold py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition shadow-sm"
                        >
                          Update Social Links
                        </button>
                      </div>
                    )}
                    
                    {attendees.map(item => (
                        <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm flex flex-col hover:border-[#00A884]/40 transition">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-11 h-11 bg-[#00A884] text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0 relative shadow-sm">
                                {item.name.slice(0, 2).toUpperCase()}
                                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${item.stillPresent ? 'bg-[#25D366]' : 'bg-slate-400'}`}></span>
                              </div>
                              <div className="overflow-hidden">
                                <div className="flex items-center gap-1.5">
                                  <h4 
                                    className="font-bold text-xs text-[#111b21] cursor-pointer hover:text-[#00A884] hover:underline truncate"
                                    onClick={() => setViewingProfileOf(item)}
                                  >
                                    {item.name}
                                  </h4>
                                  {item.visibility === 'private' && (
                                    <span className="bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full text-[8px] shrink-0">Private</span>
                                  )}
                                  {!item.stillPresent && (
                                    <span className="bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full text-[8px] shrink-0">Offline</span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {item.interestTags.length > 0 ? (
                                    item.interestTags.map((t: string, i: number) => (
                                      <span key={i} className="bg-[#e7fce9] border border-[#bbf7d0] text-[#075E54] text-[8px] px-2 py-0.5 rounded-full font-bold">
                                        #{t}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[9px] text-slate-400 italic font-medium">No interest tags specified</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Connection Action Buttons */}
                            <div className="shrink-0">
                              {item.connectionStatus === 'none' && (
                                <button 
                                  onClick={() => handleConnectRequest(item.id)}
                                  className="bg-[#00A884] hover:bg-[#008f70] shadow-md shadow-[#00A884]/20 text-white font-bold px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-wider transition"
                                >
                                  Connect
                                </button>
                              )}
                              {item.connectionStatus === 'pending' && item.connectionSender === 'me' && (
                                <span className="bg-slate-100 border border-slate-200 text-[#54656f] px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                  Pending
                                </span>
                              )}
                              {item.connectionStatus === 'pending' && item.connectionSender === 'them' && (
                                <div className="flex items-center gap-1.5">
                                  <button 
                                    onClick={() => handleConnectionRespond(item.connectionId, true)}
                                    className="bg-[#25D366] hover:bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider shadow-sm"
                                  >
                                    Accept
                                  </button>
                                  <button 
                                    onClick={() => handleConnectionRespond(item.connectionId, false)}
                                    className="bg-slate-100 hover:bg-slate-200 text-[#111b21] font-bold px-2.5 py-1.5 rounded-full text-[10px] uppercase tracking-wider"
                                  >
                                    No
                                  </button>
                                </div>
                              )}
                              {item.connectionStatus === 'accepted' && (
                                <span className="bg-[#e7fce9] border border-[#bbf7d0] text-[#075E54] px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                  <CheckCheck className="w-3.5 h-3.5 text-[#00A884]" />
                                  <span>Connected</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {item.connectionStatus === 'accepted' && item.socialLinks && Object.values(item.socialLinks).some(Boolean) && (
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-2">
                              {item.socialLinks.whatsapp && (
                                <a href={`https://wa.me/${item.socialLinks.whatsapp}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 transition" title="WhatsApp">
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984 0 1.762.459 3.48 1.332 5.001L2 22l5.122-1.335a9.92 9.92 0 0 0 4.888 1.282h.005c5.505 0 9.988-4.478 9.989-9.985 0-2.667-1.038-5.175-2.925-7.062A9.919 9.919 0 0 0 12.012 2zm0 18.28a8.27 8.27 0 0 1-4.223-1.154l-.303-.18-3.04.793.812-2.961-.198-.315a8.267 8.267 0 0 1-1.272-4.474c0-4.562 3.712-8.274 8.273-8.274 2.208 0 4.284.861 5.845 2.424 1.562 1.562 2.422 3.639 2.421 5.848 0 4.563-3.713 8.274-8.305 8.274zm4.536-6.202c-.248-.124-1.468-.724-1.696-.807-.228-.083-.394-.124-.559.124-.165.248-.641.807-.786.972-.145.165-.29.186-.538.062-.248-.124-1.048-.387-1.996-1.232-.738-.658-1.236-1.47-1.381-1.718-.145-.248-.015-.382.109-.505.111-.11.248-.29.372-.435.124-.145.165-.248.248-.413.083-.165.041-.31-.021-.434-.062-.124-.559-1.343-.765-1.839-.2-.483-.404-.418-.559-.426-.145-.008-.31-.01-.475-.01s-.434.062-.661.31c-.228.248-.868.848-.868 2.068 0 1.22.889 2.398 1.013 2.563.124.165 1.75 2.673 4.238 3.748.592.257 1.054.41 1.414.524.594.189 1.134.162 1.56.098.476-.071 1.468-.6 1.674-1.18.207-.579.207-1.075.145-1.18-.062-.103-.227-.186-.475-.31z"/>
                                  </svg>
                                </a>
                              )}
                              {item.socialLinks.instagram && (
                                <a href={`https://instagram.com/${item.socialLinks.instagram}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-full bg-pink-50 text-pink-700 border border-pink-100 hover:bg-pink-100 transition" title="Instagram">
                                  <Instagram className="w-4 h-4" />
                                </a>
                              )}
                              {item.socialLinks.facebook && (
                                <a href={`https://facebook.com/${item.socialLinks.facebook}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition" title="Facebook">
                                  <Facebook className="w-4 h-4" />
                                </a>
                              )}
                              {item.socialLinks.linkedin && (
                                <a href={`https://linkedin.com/in/${item.socialLinks.linkedin}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100 transition" title="LinkedIn">
                                  <Linkedin className="w-4 h-4" />
                                </a>
                              )}
                              {item.socialLinks.twitter && (
                                <a href={`https://x.com/${item.socialLinks.twitter}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-full bg-slate-100 text-slate-800 border border-slate-100 hover:bg-slate-200 transition" title="X / Twitter">
                                  <Twitter className="w-4 h-4" />
                                </a>
                              )}
                              {item.socialLinks.tiktok && (
                                <a href={`https://tiktok.com/@${item.socialLinks.tiktok}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-full bg-slate-900 text-white border border-slate-700 hover:bg-slate-800 transition" title="TikTok">
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 2.78-1.15 5.54-3.11 7.49-2.2 2.14-5.32 3.12-8.31 2.5-3.07-.63-5.59-2.73-6.66-5.69-.99-2.76-.32-5.99 1.65-8.21 2.22-2.49 5.84-3.4 9.01-2.29v4.14c-1.61-.43-3.42-.15-4.75.92-1.39 1.12-2.02 3.02-1.55 4.75.48 1.77 2.1 3.2 3.93 3.5 1.76.29 3.65-.21 4.88-1.53 1.34-1.43 1.81-3.45 1.81-5.45V.02h-1.5z"/>
                                  </svg>
                                </a>
                              )}
                            </div>
                          )}

                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] text-[#54656f] font-medium">
                            <span>Double-block protection active</span>
                            <button 
                              onClick={() => handleBlockUser(item.id)}
                              className="text-rose-600 hover:text-rose-700 font-bold hover:underline"
                            >
                              Block User
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                </div>
              )}

              {/* TAB 3: CONNECTIONS & CHATS & NOTES */}
              {hubTab === 'connections' && !activeConnection && !viewingProfileOf && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-[#54656f] uppercase tracking-wider">Connections & Chats</h3>
                  
                  {connections.length === 0 ? (
                    <div className="text-center py-10 bg-white border border-slate-200 rounded-2xl">
                      <MessageSquare className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs text-[#111b21] font-bold">No connected contacts yet</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Explore the "People" tab to request connection handshakes!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {connections.map(conn => (
                        <div key={conn.id} className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm flex flex-col hover:border-[#00A884]/40 transition">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-11 h-11 bg-[#075E54] text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0 relative shadow-sm">
                                {conn.peer.name.slice(0, 2).toUpperCase()}
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#25D366] rounded-full border-2 border-white"></span>
                              </div>
                              <div className="overflow-hidden">
                                <h4 
                                  className="font-bold text-xs text-[#111b21] cursor-pointer hover:text-[#00A884] hover:underline truncate"
                                  onClick={() => setViewingProfileOf(conn.peer)}
                                >
                                  {conn.peer.name}
                                </h4>
                                <p className="text-[9px] text-[#54656f] mt-0.5 flex items-center gap-1 font-medium">
                                  <Calendar className="w-3 h-3 text-[#00A884]" />
                                  <span>Met at {conn.eventName}</span>
                                </p>
                              </div>
                            </div>
                            {conn.status === 'accepted' ? (
                              <button 
                                onClick={() => handleSelectConnection(conn)}
                                className="bg-[#00A884] hover:bg-[#008f70] shadow-md shadow-[#00A884]/20 text-white px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0"
                              >
                                <span>Chat</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            ) : conn.senderUserId === user?.id ? (
                              <span className="bg-slate-100 border border-slate-200 text-[#54656f] px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0">
                                Pending
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button 
                                  onClick={() => handleConnectionRespond(conn.id, true)}
                                  className="bg-[#25D366] hover:bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider shadow-sm"
                                >
                                  Accept
                                </button>
                                <button 
                                  onClick={() => handleConnectionRespond(conn.id, false)}
                                  className="bg-slate-100 hover:bg-slate-200 text-[#111b21] font-bold px-2.5 py-1.5 rounded-full text-[10px] uppercase tracking-wider"
                                >
                                  No
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Preview Private Notes */}
                          {conn.privateNote && (
                            <div className="bg-[#fef8e7] border border-[#f5e7b8] p-2.5 rounded-xl mt-2.5 text-[10px] text-[#4a3f18]">
                              <span className="font-bold text-[9px] uppercase tracking-wider text-[#916a00] block mb-0.5">My Private Note:</span>
                              <p className="italic">"{conn.privateNote}"</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ACTIVE CHAT & NOTES INTERFACE SUB-SCREEN */}
              {activeConnection && (
                <div className="flex flex-col flex-1 h-[60vh] bg-[#efeae2] whatsapp-chat-bg border border-slate-200 shadow-md rounded-2xl overflow-hidden">
                  {/* Chat Peer WhatsApp Header */}
                  <div className="p-3 bg-[#075E54] text-white flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 bg-[#25D366] text-[#075E54] rounded-full flex items-center justify-center font-bold text-xs relative">
                        {activeConnection.peer.name.slice(0, 2).toUpperCase()}
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#25D366] rounded-full border border-white"></span>
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-white leading-tight">{activeConnection.peer.name}</h4>
                        <p className="text-[9px] text-teal-100/90 font-medium">Met at {activeConnection.eventName} • online</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => { setActiveConnection(null); fetchConnections(); }}
                        className="bg-black/20 hover:bg-black/40 text-white text-[10px] px-2.5 py-1 rounded-full font-bold transition ml-1"
                      >
                        Back
                      </button>
                    </div>
                  </div>

                  {/* Private Note-Taking Sticky Card at top of chat */}
                  <div className="p-3 bg-[#fef8e7] border-b border-[#f5e7b8]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9.5px] font-bold text-[#4a3f18] uppercase tracking-wider flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-[#075E54]" />
                        <span>Private Note (Only visible to you)</span>
                      </span>
                      <button 
                        onClick={handleSavePrivateNote}
                        className="bg-[#00A884] hover:bg-[#008f70] text-white text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider transition shadow-sm"
                      >
                        Save Note
                      </button>
                    </div>
                    <textarea 
                      placeholder="Take notes or record conversation context..."
                      value={privateNoteInput}
                      onChange={(e) => setPrivateNoteInput(e.target.value)}
                      className="w-full bg-white focus:bg-white border border-[#f5e7b8] transition-colors rounded-xl p-2.5 text-[10px] text-[#111b21] focus:outline-none focus:ring-1 focus:ring-[#00A884] h-12 resize-none shadow-inner"
                    />
                  </div>

                  {/* WhatsApp Chat messages container */}
                  <div className="flex-1 p-3 overflow-y-auto space-y-2 bg-[#efeae2] whatsapp-chat-bg">
                    {chatMessages.length === 0 ? (
                      <div className="text-center py-6 text-[10px] text-[#54656f] font-medium bg-white rounded-xl p-3 border border-slate-200 max-w-[260px] mx-auto">
                        <Lock className="w-4 h-4 text-[#00A884] mx-auto mb-1" />
                        Messages are end-to-end encrypted within this live event room. Say hello to {activeConnection.peer.name}!
                      </div>
                    ) : (
                      chatMessages.map(m => {
                        const isMe = m.senderUserId === user?.id;
                        return (
                          <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className={isMe ? 'whatsapp-bubble-sent bg-[#d9fdd3] text-[#111b21] p-2.5 rounded-2xl rounded-tr-none shadow-sm max-w-[80%] text-xs border border-[#b7ebd0]/40 ml-auto' : 'whatsapp-bubble-received bg-white text-[#111b21] p-2.5 rounded-2xl rounded-tl-none shadow-sm max-w-[80%] text-xs border border-slate-200 mr-auto'}>
                              <p className="break-words font-medium">{m.content}</p>
                              <div className="flex items-center justify-end gap-1 mt-1 text-[8px] text-[#54656f]">
                                <span>{new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {isMe && (
                                  <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Message Input Box */}
                  <form onSubmit={handleSendMessage} className="p-2.5 bg-[#f0f2f5] border-t border-slate-200 flex items-center gap-2">
                    <input 
                      type="text" 
                      placeholder="Type a message..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-full px-4 py-2.5 text-xs text-[#111b21] focus:outline-none focus:ring-2 focus:ring-[#00A884]/20 focus:border-[#00A884] shadow-inner"
                    />
                    <button 
                      type="submit"
                      className="bg-[#00A884] hover:bg-[#008f70] text-white p-2.5 rounded-full shadow-md shrink-0 transition-transform active:scale-95"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 4: ORGANIZER INSIGHTS DASHBOARD */}
              {hubTab === 'organizer' && currentEvent.organizerId === user?.id && dashboardStats && !viewingProfileOf && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Live Organizer Console</h3>
                    <button 
                      onClick={handleExportRecap}
                      className="text-xs text-indigo-700 hover:text-indigo-800 font-bold uppercase tracking-wider flex items-center gap-1"
                    >
                      <FileText className="w-4.5 h-4.5" />
                      <span>Download Recap</span>
                    </button>
                  </div>

                  {/* Broadcast Message Card */}
                  <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex flex-col gap-3">
                    <div>
                      <span className="text-[9px] font-bold text-sky-700 uppercase tracking-wider block mb-0.5">Attendee Engagement</span>
                      <h4 className="font-bold text-xs text-sky-950">Send Announcement</h4>
                      <p className="text-[10px] text-sky-800/80 mt-0.5">Push a notification to all currently checked-in attendees instantly.</p>
                    </div>
                    <form onSubmit={handleSendBroadcast} className="flex flex-col gap-2">
                      <textarea 
                        rows={2}
                        placeholder="Type your announcement here..."
                        value={broadcastInput}
                        onChange={(e) => setBroadcastInput(e.target.value)}
                        className="w-full bg-white border border-sky-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none text-slate-800"
                        maxLength={200}
                      />
                      <button 
                        type="submit"
                        disabled={isSendingBroadcast || !broadcastInput.trim()}
                        className="self-end bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-[10px] uppercase tracking-wider transition shadow-sm"
                      >
                        {isSendingBroadcast ? 'Sending...' : 'Send Broadcast'}
                      </button>
                    </form>
                  </div>

                  {/* Event QR Code Sharing Card */}
                  <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 border border-indigo-950 rounded-xl p-4 text-white shadow-md flex items-center justify-between gap-4">
                    <div className="space-y-1 max-w-[190px]">
                      <span className="bg-indigo-700 text-indigo-100 font-bold px-2 py-0.5 rounded text-[8px] uppercase tracking-widest inline-block">Live Broadcast</span>
                      <h4 className="font-extrabold text-[11px] uppercase tracking-wide leading-tight">Display Venue QR Code</h4>
                      <p className="text-[9px] text-indigo-200/90 font-medium leading-relaxed">Let attendees scan the code to verify check-in instantly on-screen.</p>
                    </div>
                    <button 
                      onClick={() => {
                        setQrCodeEvent(currentEvent);
                        setShowQrCodeModal(true);
                      }}
                      className="bg-white hover:bg-slate-100 text-indigo-900 font-black px-3.5 py-2.5 rounded-xl text-[10px] uppercase tracking-wider transition shrink-0 shadow-lg flex items-center gap-1"
                    >
                      <QrCode className="w-4 h-4 text-indigo-900 animate-pulse" />
                      <span>Display QR</span>
                    </button>
                  </div>

                  {/* Event Visibility Control Card for Admins */}
                  {user?.is_admin && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wider block mb-0.5">Admin Visibility Control</span>
                        <h4 className="font-bold text-xs text-amber-950">
                          {currentEvent.hidden ? 'Event is Hidden from Public' : 'Hide Event from Directory'}
                        </h4>
                        <p className="text-[10px] text-amber-800/80 mt-0.5">
                          {currentEvent.hidden
                            ? 'Only admins can see this event in the public list.'
                            : 'Hide this event so standard users cannot browse or see it.'}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          const action = currentEvent.hidden ? 'unhide' : 'hide';
                          try {
                            const res = await fetch(`/api/admin/events/${currentEvent.id}/action`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                              },
                              body: JSON.stringify({ action })
                            });
                            if (res.ok) {
                              const newHidden = !currentEvent.hidden;
                              setCurrentEvent({ ...currentEvent, hidden: newHidden });
                              showToast(newHidden ? 'Event hidden from public directory.' : 'Event unhidden and visible.', 'success');
                              fetchEvents();
                            } else {
                              showToast(`Failed to ${action} event.`, 'error');
                            }
                          } catch {
                            showToast('Network error.', 'error');
                          }
                        }}
                        className={`${
                          currentEvent.hidden
                            ? 'bg-sky-700 hover:bg-sky-800 text-white'
                            : 'bg-amber-700 hover:bg-amber-800 text-white'
                        } font-bold px-3 py-2 rounded-lg text-[10px] uppercase tracking-wider shrink-0 transition`}
                      >
                        {currentEvent.hidden ? 'Unhide Event' : 'Hide Event'}
                      </button>
                    </div>
                  )}

                  {/* Event Status Control Card */}
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[9px] font-bold text-rose-600 uppercase tracking-wider block mb-0.5">Venue Administration</span>
                      <h4 className="font-bold text-xs text-rose-950">Deactivate / Close Venue</h4>
                      <p className="text-[10px] text-rose-700/80 mt-0.5">Shuts down live check-ins and clears present attendees.</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm('Are you sure you want to deactivate and close this event? Check-ins will be disabled and attendees removed.')) {
                          try {
                            const res = await fetch(`/api/events/${currentEvent.id}/close`, {
                              method: 'POST',
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (res.ok) {
                              showToast('Event deactivated successfully.', 'success');
                              setCurrentEvent(null);
                              setEventCheckIn(null);
                              localStorage.removeItem('ec_current_event');
                              localStorage.removeItem('ec_event_check_in');
                              setCurrentScreen('event-list');
                              fetchEvents();
                            } else {
                              showToast('Failed to close event.', 'error');
                            }
                          } catch {
                            showToast('Network error.', 'error');
                          }
                        }
                      }}
                      className="bg-rose-700 hover:bg-rose-800 text-white font-bold px-3 py-2 rounded-lg text-[10px] uppercase tracking-wider shrink-0 transition"
                    >
                      Close Event
                    </button>
                  </div>

                  {/* Google Forms Integration Card */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col gap-3">
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Google Workspace</span>
                      <h4 className="font-bold text-sm text-slate-800">Event Feedback Form</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Collect attendee feedback directly to your Google Drive.</p>
                    </div>
                    {currentEvent.feedbackFormUrl ? (
                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-xs font-medium text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5"/> Active</span>
                        <a href={currentEvent.feedbackFormUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-700 font-bold hover:underline">View Form</a>
                      </div>
                    ) : googleNeedsAuth ? (
                      <button 
                        onClick={handleGoogleSignIn}
                        className="gsi-material-button self-start w-full"
                        style={{ border: '1px solid #dadce0', borderRadius: '4px', backgroundColor: '#fff', padding: '10px 15px' }}
                      >
                        <div className="flex items-center justify-center gap-3">
                          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 block">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                            <path fill="none" d="M0 0h48v48H0z"></path>
                          </svg>
                          <span className="font-roboto font-medium text-slate-700 text-sm">Sign in with Google</span>
                        </div>
                      </button>
                    ) : (
                      <button 
                        onClick={handleCreateFeedbackForm}
                        disabled={isCreatingForm}
                        className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-bold px-3 py-2 rounded-lg text-xs transition flex items-center justify-center gap-2 w-full"
                      >
                        {isCreatingForm ? 'Creating...' : 'Create Feedback Form'}
                      </button>
                    )}
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Live Attendance</span>
                      <span className="text-xl font-black text-slate-800 block mt-1">{dashboardStats.activeCheckIns} / {dashboardStats.totalAttendance}</span>
                      <span className="text-[8px] text-slate-400 font-semibold block mt-0.5">Checked in currently</span>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Connections Made</span>
                      <span className="text-xl font-black text-slate-800 block mt-1">{dashboardStats.eventConnections}</span>
                      <span className="text-[8px] text-slate-400 font-semibold block mt-0.5">Attendee Handshakes</span>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Shared Photos</span>
                      <span className="text-xl font-black text-slate-800 block mt-1">{dashboardStats.totalPhotos}</span>
                      <span className="text-[8px] text-slate-400 font-semibold block mt-0.5">Total uploads in feed</span>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Flagged Content</span>
                      <span className="text-xl font-black text-rose-600 block mt-1">{dashboardStats.flaggedPhotos}</span>
                      <span className="text-[8px] text-slate-400 font-semibold block mt-0.5">Pending safety reviews</span>
                    </div>
                  </div>

                  {/* Check-In Volume Chart */}
                  {dashboardStats.checkInTimeline && dashboardStats.checkInTimeline.length > 0 && (
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center gap-1.5 mb-4">
                        <TrendingUp className="w-4 h-4 text-indigo-700" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Check-In Volume</span>
                      </div>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={dashboardStats.checkInTimeline}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="time" 
                              tick={{ fontSize: 10, fill: '#94a3b8' }} 
                              axisLine={false} 
                              tickLine={false} 
                              tickMargin={10} 
                            />
                            <YAxis 
                              tick={{ fontSize: 10, fill: '#94a3b8' }} 
                              axisLine={false} 
                              tickLine={false} 
                              tickMargin={10} 
                              allowDecimals={false}
                            />
                            <RechartsTooltip 
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                            />
                            <Line type="monotone" dataKey="cumulative" name="Total Check-ins" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#4f46e5', strokeWidth: 0 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Aggregated Interest Tags */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <TrendingUp className="w-4 h-4 text-indigo-700 animate-bounce" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Top Attendee Interest Tags</span>
                    </div>

                    {dashboardStats.interestTags.length === 0 ? (
                      <p className="text-[10px] text-slate-400 font-medium italic">No attendee tags submitted yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {dashboardStats.interestTags.map((tag: any, index: number) => (
                          <div key={index} className="flex justify-between items-center text-xs">
                            <span className="text-slate-800 font-bold">#{tag.name}</span>
                            <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] px-2.5 py-0.5 rounded font-mono font-black">
                              {tag.count} matches
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Event Hub persistent bottom status */}
            <div className="p-3 border-t border-slate-100 bg-white flex items-center justify-between text-[9px] text-slate-500 font-semibold shadow-inner shrink-0 mt-auto">
              <span className="flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-indigo-700" />
                <span>Private Event Space</span>
              </span>
              <span>
                {(currentEvent.organizerId === user?.id || user?.is_admin) && (
                  <>Code: <strong className="text-indigo-700">{currentEvent.checkInCode}</strong></>
                )}
              </span>
            </div>
          </motion.div>
        )}

        {/* SCREEN 4: USER PROFILE & SETTINGS */}
        {currentScreen === 'profile' && user && (
          <motion.div 
            key="profile"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col justify-between flex-1 h-full overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-700 to-violet-700 text-white shadow-md flex items-center justify-between shrink-0 z-10">
              <span className="font-black text-sm uppercase tracking-wider">Profile Settings</span>
              <div className="flex items-center gap-2">
                {renderThemeToggle()}
                <button 
                  onClick={() => setCurrentScreen('event-list')}
                  className="bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg text-xs hover:bg-indigo-500 font-bold uppercase tracking-wider transition"
                >
                  Back to Portal
                </button>
              </div>
            </div>

            {/* Profile body */}
            <div className="p-6 flex-1 overflow-y-auto bg-slate-50">
              <div className="max-w-2xl mx-auto w-full space-y-6">
              
              {/* User Bio Card */}
              <div className="text-center bg-white border border-slate-100 rounded-xl p-6">
                <div className="w-14 h-14 bg-indigo-50 border border-indigo-200 rounded-full flex items-center justify-center mx-auto mb-3 text-indigo-700">
                  <UserIcon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">{user.name}</h3>
                <p className="text-xs text-slate-500 mt-1 font-mono font-medium">{user.email}</p>

                {/* Interest Tags list */}
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-800">Your Interests</h4>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start mb-4">
                    {user.interestTags && user.interestTags.length > 0 ? (
                      user.interestTags.map((t: string, i: number) => (
                        <div key={i} className="group relative flex items-center bg-indigo-50 hover:bg-indigo-100 transition border border-indigo-100 text-indigo-700 text-[10px] px-2.5 py-1 rounded-full font-bold">
                          <span>#{t}</span>
                          <button 
                            onClick={() => handleRemoveTag(t)}
                            className="ml-1.5 text-indigo-400 hover:text-rose-500 rounded-full focus:outline-none"
                            title="Remove tag"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-400 italic font-medium">No interests added yet.</span>
                    )}
                  </div>

                  <form onSubmit={handleAddTag} className="flex gap-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Add an interest..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-700 text-slate-900"
                    />
                    <button
                      type="submit"
                      disabled={!newTag.trim() || isAddingTag}
                      className="bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white p-1.5 rounded-lg transition"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </form>
                  <p className="text-[9px] text-slate-400 mt-2 text-left font-medium">
                    Suggestions:{' '}
                    {['Designer', 'Videographer', 'Content Creator', 'AI', 'Website Developer'].map((s, i) => (
                      <span key={i}>
                        <button type="button" onClick={() => setNewTag(s)} className="hover:text-indigo-600 transition underline underline-offset-2 decoration-slate-300 hover:decoration-indigo-400">{s}</button>{i < 4 ? ', ' : ''}
                      </span>
                    ))}
                  </p>
                </div>

                {/* Social Links Form */}
                <div className="mt-5 border-t border-slate-100 pt-5 text-left">
                  {/* Public Networking Suggestion Box */}
                  <div className="mb-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-3 flex items-start gap-2.5">
                    <Share2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-indigo-950 leading-relaxed">
                      <strong className="font-bold text-indigo-900 block mb-0.5">Public Networking Suggestion</strong>
                      Add your WhatsApp number and social media handles (Instagram, LinkedIn, X, TikTok) to your profile so fellow event attendees can easily connect with you!
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-800">Social Links</h4>
                    <button 
                      onClick={() => setIsEditingSocial(!isEditingSocial)}
                      className="text-[10px] text-indigo-600 font-bold hover:text-indigo-800 uppercase tracking-widest"
                    >
                      {isEditingSocial ? 'Cancel' : 'Edit'}
                    </button>
                  </div>
                  
                  {isEditingSocial ? (
                    <form onSubmit={handleSaveSocialLinks} className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1 flex items-center gap-1">
                          <span>WhatsApp Phone Number</span>
                        </label>
                        <div className="flex">
                          <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-emerald-50 text-emerald-800 text-xs font-mono font-bold">
                            wa.me/
                          </span>
                          <input
                            type="text"
                            placeholder="1234567890 (country code + number)"
                            value={socialLinksForm.whatsapp || ''}
                            onChange={e => setSocialLinksForm({...socialLinksForm, whatsapp: e.target.value.replace(/https?:\/\/(www\.)?(wa\.me|api\.whatsapp\.com\/send\?phone=)\//, '').replace(/^\+/, '').replace(/[^0-9]/g, '')})}
                            className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-r-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Instagram Username</label>
                        <div className="flex">
                          <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 text-slate-500 text-xs font-mono">
                            instagram.com/
                          </span>
                          <input
                            type="text"
                            placeholder="username"
                            value={socialLinksForm.instagram || ''}
                            onChange={e => setSocialLinksForm({...socialLinksForm, instagram: e.target.value.replace(/https?:\/\/(www\.)?instagram\.com\//, '').replace(/^\//, '')})}
                            className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-r-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-700 text-slate-900"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Facebook Username</label>
                        <div className="flex">
                          <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 text-slate-500 text-xs font-mono">
                            facebook.com/
                          </span>
                          <input
                            type="text"
                            placeholder="username"
                            value={socialLinksForm.facebook || ''}
                            onChange={e => setSocialLinksForm({...socialLinksForm, facebook: e.target.value.replace(/https?:\/\/(www\.)?facebook\.com\//, '').replace(/^\//, '')})}
                            className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-r-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-700 text-slate-900"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">LinkedIn Username</label>
                        <div className="flex">
                          <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 text-slate-500 text-xs font-mono">
                            linkedin.com/in/
                          </span>
                          <input
                            type="text"
                            placeholder="username"
                            value={socialLinksForm.linkedin || ''}
                            onChange={e => setSocialLinksForm({...socialLinksForm, linkedin: e.target.value.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/^\//, '')})}
                            className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-r-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-700 text-slate-900"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">X (Twitter) Username</label>
                        <div className="flex">
                          <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 text-slate-500 text-xs font-mono">
                            x.com/
                          </span>
                          <input
                            type="text"
                            placeholder="username"
                            value={socialLinksForm.twitter || ''}
                            onChange={e => setSocialLinksForm({...socialLinksForm, twitter: e.target.value.replace(/https?:\/\/(www\.)?(twitter|x)\.com\//, '').replace(/^\//, '')})}
                            className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-r-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-700 text-slate-900"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">TikTok Username</label>
                        <div className="flex">
                          <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 text-slate-500 text-xs font-mono">
                            tiktok.com/@
                          </span>
                          <input
                            type="text"
                            placeholder="username"
                            value={socialLinksForm.tiktok || ''}
                            onChange={e => setSocialLinksForm({...socialLinksForm, tiktok: e.target.value.replace(/https?:\/\/(www\.)?tiktok\.com\/@?/, '').replace(/^\//, '')})}
                            className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-r-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-700 text-slate-900"
                          />
                        </div>
                      </div>
                      <button 
                        type="submit" 
                        disabled={isSavingSocial}
                        className="w-full bg-indigo-700 hover:bg-indigo-800 text-white font-bold py-2 rounded-lg text-xs transition shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/40 disabled:opacity-50 mt-2"
                      >
                        {isSavingSocial ? 'Saving...' : 'Save Links'}
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {user.socialLinks && Object.values(user.socialLinks).some(Boolean) ? (
                        <div className="flex flex-wrap gap-2">
                          {user.socialLinks.whatsapp && (
                            <a href={`https://wa.me/${user.socialLinks.whatsapp}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 transition flex items-center gap-1.5" title="WhatsApp">
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984 0 1.762.459 3.48 1.332 5.001L2 22l5.122-1.335a9.92 9.92 0 0 0 4.888 1.282h.005c5.505 0 9.988-4.478 9.989-9.985 0-2.667-1.038-5.175-2.925-7.062A9.919 9.919 0 0 0 12.012 2zm0 18.28a8.27 8.27 0 0 1-4.223-1.154l-.303-.18-3.04.793.812-2.961-.198-.315a8.267 8.267 0 0 1-1.272-4.474c0-4.562 3.712-8.274 8.273-8.274 2.208 0 4.284.861 5.845 2.424 1.562 1.562 2.422 3.639 2.421 5.848 0 4.563-3.713 8.274-8.305 8.274zm4.536-6.202c-.248-.124-1.468-.724-1.696-.807-.228-.083-.394-.124-.559.124-.165.248-.641.807-.786.972-.145.165-.29.186-.538.062-.248-.124-1.048-.387-1.996-1.232-.738-.658-1.236-1.47-1.381-1.718-.145-.248-.015-.382.109-.505.111-.11.248-.29.372-.435.124-.145.165-.248.248-.413.083-.165.041-.31-.021-.434-.062-.124-.559-1.343-.765-1.839-.2-.483-.404-.418-.559-.426-.145-.008-.31-.01-.475-.01s-.434.062-.661.31c-.228.248-.868.848-.868 2.068 0 1.22.889 2.398 1.013 2.563.124.165 1.75 2.673 4.238 3.748.592.257 1.054.41 1.414.524.594.189 1.134.162 1.56.098.476-.071 1.468-.6 1.674-1.18.207-.579.207-1.075.145-1.18-.062-.103-.227-.186-.475-.31z"/>
                              </svg>
                            </a>
                          )}
                          {user.socialLinks.instagram && (
                            <a href={`https://instagram.com/${user.socialLinks.instagram}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-pink-50 text-pink-700 border border-pink-100 hover:bg-pink-100 transition" title="Instagram">
                              <Instagram className="w-5 h-5" />
                            </a>
                          )}
                          {user.socialLinks.facebook && (
                            <a href={`https://facebook.com/${user.socialLinks.facebook}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition" title="Facebook">
                              <Facebook className="w-5 h-5" />
                            </a>
                          )}
                          {user.socialLinks.linkedin && (
                            <a href={`https://linkedin.com/in/${user.socialLinks.linkedin}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100 transition" title="LinkedIn">
                              <Linkedin className="w-5 h-5" />
                            </a>
                          )}
                          {user.socialLinks.twitter && (
                            <a href={`https://x.com/${user.socialLinks.twitter}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-slate-100 text-slate-800 border border-slate-100 hover:bg-slate-200 transition" title="X / Twitter">
                              <Twitter className="w-5 h-5" />
                            </a>
                          )}
                          {user.socialLinks.tiktok && (
                            <a href={`https://tiktok.com/@${user.socialLinks.tiktok}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-slate-900 text-white border border-slate-700 hover:bg-slate-800 transition" title="TikTok">
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 2.78-1.15 5.54-3.11 7.49-2.2 2.14-5.32 3.12-8.31 2.5-3.07-.63-5.59-2.73-6.66-5.69-.99-2.76-.32-5.99 1.65-8.21 2.22-2.49 5.84-3.4 9.01-2.29v4.14c-1.61-.43-3.42-.15-4.75.92-1.39 1.12-2.02 3.02-1.55 4.75.48 1.77 2.1 3.2 3.93 3.5 1.76.29 3.65-.21 4.88-1.53 1.34-1.43 1.81-3.45 1.81-5.45V.02h-1.5z"/>
                              </svg>
                            </a>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 font-medium italic">No social links added. Click Edit to add them.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* GDPR Privacy Info */}
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] space-y-2.5">
                <div className="flex items-center gap-1.5 text-indigo-700">
                  <Info className="w-4 h-4 shrink-0" />
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-800">Privacy & GDPR Rights</h4>
                </div>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  Your privacy is our core blueprint. We do not use persistent identifiers, automated target metrics, or tracking cookies outside of the active secure session. You maintain absolute rights to erase your footprint instantly.
                </p>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg text-[9px] text-slate-500 leading-relaxed shadow-inner">
                  <strong className="text-slate-700">GDPR Deletion Action:</strong> Deleting your account will completely purge your event photos, delete your profile, remove private handshakes/notes, and immediately anonymize all sent chat messages. This cannot be undone.
                </div>
              </div>

              {/* Dangerous Area */}
              <div className="pt-4 border-t border-slate-100">
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold py-2.5 rounded-lg text-xs uppercase tracking-widest transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Delete Profile & All Data</span>
                </button>
              </div>

              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-100 bg-white text-center text-[10px] text-slate-400 font-medium shrink-0 mt-auto">
              Event Connect v1.0 • Privacy First Core
            </div>

          </motion.div>
        )}

        {/* SCREEN 5: PLATFORM ADMIN CONTROL PANEL */}
        {currentScreen === 'admin' && user?.is_admin && token && (
          <motion.div
            key="admin"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col h-full overflow-hidden"
          >
            <AdminPanel 
              token={token}
              onBack={() => setCurrentScreen('event-list')}
              showToast={showToast}
            />
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* --- MODALS AND DIALOGS --- */}

      {/* 1. HOST NEW EVENT MODAL */}
      {showCreateEventModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-xl w-full max-w-sm overflow-hidden p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-black text-indigo-950 mb-1 uppercase tracking-widest">Create Live Event</h3>
            <p className="text-[10px] text-slate-500 font-medium mb-4">Set up a live space to receive attendees and shared snaps.</p>
            
            <form onSubmit={handleCreateEvent} className="space-y-3.5">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Event Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="Design Meetup / Party"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-700 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Date</label>
                <input 
                  type="date" 
                  required
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-700 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Location Venue</label>
                <input 
                  type="text" 
                  required
                  placeholder="Exhibition Hall B"
                  value={newEventLocation}
                  onChange={(e) => setNewEventLocation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-700 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Check-In Code</label>
                <input 
                  type="text" 
                  required
                  placeholder="DESIGN26"
                  value={newEventCode}
                  onChange={(e) => setNewEventCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-700 text-slate-800"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-700 hover:bg-indigo-800 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/40 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition shadow-md"
                >
                  Publish Space
                </button>
                <button 
                  type="button"
                  onClick={() => setShowCreateEventModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-100 font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CHECK-IN PRIVACY CONSENT MODAL */}
      {showCheckInModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-xl w-full max-w-sm overflow-hidden p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-black text-indigo-950 mb-1 uppercase tracking-widest">Live Check-In Portal</h3>
            <p className="text-[10px] text-slate-500 font-medium mb-4">Enter check-in code and choose your visibility profile.</p>

            <form onSubmit={handleCheckInSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Check-In Code</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. TECH2026"
                  value={checkInCodeInput}
                  onChange={(e) => setCheckInCodeInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-700 text-slate-800 uppercase font-bold"
                />
              </div>

              {/* Privacy Option Toggle */}
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Privacy & Directory Settings</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    type="button"
                    onClick={() => setCheckInVisibility('public')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between h-20 transition ${
                      checkInVisibility === 'public' 
                        ? 'bg-indigo-50 border-indigo-700 text-indigo-900 ring-2 ring-indigo-500/20' 
                        : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <Eye className="w-4 h-4 text-indigo-700" />
                    <div>
                      <span className="text-[10px] font-black uppercase text-indigo-950 tracking-wider block">Public Profile</span>
                      <span className="text-[8px] text-slate-500 font-medium block leading-tight">Visible in event attendee directory</span>
                    </div>
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => setCheckInVisibility('private')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between h-20 transition ${
                      checkInVisibility === 'private' 
                        ? 'bg-indigo-50 border-indigo-700 text-indigo-900 ring-2 ring-indigo-500/20' 
                        : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <EyeOff className="w-4 h-4 text-indigo-700" />
                    <div>
                      <span className="text-[10px] font-black uppercase text-indigo-950 tracking-wider block">Private Profile</span>
                      <span className="text-[8px] text-slate-500 font-medium block leading-tight">Only revealed once handshakes accepted</span>
                    </div>
                  </button>
                </div>
              </div>

              {checkInVisibility === 'public' && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 p-3 rounded-xl text-[10px] text-indigo-950 leading-relaxed flex gap-2 items-start">
                  <Share2 className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <span><strong>Suggestion:</strong> Add your social media handles (Instagram, LinkedIn, X, TikTok) in <em>My Profile &gt; Social Links</em> so attendees can easily follow &amp; connect with you publicly!</span>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-[9px] text-slate-500 leading-relaxed flex gap-2 items-start shadow-inner">
                <Info className="w-3.5 h-3.5 text-indigo-700 shrink-0 mt-0.5" />
                <span>By checking in, you consent to sharing your name and chosen interest tags with other checked-in attendees. You can leave the event at any time to instantly remove your visibility.</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-700 hover:bg-indigo-800 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/40 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition shadow-md"
                >
                  Verify Check-In
                </button>
                <button 
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-100 font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. REPORT / FLAG CONTENT MODAL */}
      {showReportModal && reportTarget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-xl w-full max-w-sm overflow-hidden p-6 shadow-2xl">
            <h3 className="text-sm font-black text-rose-950 mb-1 uppercase tracking-widest">Report Action Request</h3>
            <p className="text-[10px] text-slate-500 font-medium mb-4">Please specify why you are reporting this {reportTarget.type}. Immediate safety measures will trigger.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Reason for Report</label>
                <textarea 
                  required
                  placeholder="Inappropriate behavior, non-consensual photo, offensive content, etc."
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-700 text-slate-800 h-24 resize-none"
                />
              </div>

              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-[9px] leading-relaxed flex gap-2 shadow-inner">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  {reportTarget.type === 'photo' 
                    ? 'Flagging this photo will immediately hide it from public view on all feeds. The event organizer will be notified for review.'
                    : 'Reporting this user will trigger organizer staff review. Consider also Blocking them to instantly break connection state.'}
                </span>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={submitReport}
                  className="flex-1 bg-rose-750 hover:bg-rose-800 shadow-md shadow-rose-500/20 hover:shadow-lg hover:shadow-rose-500/40 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition shadow-md"
                >
                  Submit Report
                </button>
                <button 
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-100 font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EVENT HUB SOCIAL LINKS EDIT MODAL */}
      {isEditingSocial && currentScreen === 'event-hub' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-100 shadow-2xl rounded-2xl w-full max-w-sm overflow-hidden p-6">
            <h3 className="text-sm font-black text-slate-800 mb-1 uppercase tracking-widest">Update Social Links</h3>
            <p className="text-[10px] text-slate-500 font-medium mb-4">Add your social media to let other attendees connect with you more easily during the event.</p>
            
            <form onSubmit={handleSaveSocialLinks} className="space-y-3 max-h-[60vh] overflow-y-auto px-1 pb-2">
              <div>
                <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">WhatsApp Phone Number</label>
                <div className="flex shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-emerald-50 text-emerald-800 text-xs font-mono font-bold">wa.me/</span>
                  <input
                    type="text"
                    placeholder="1234567890"
                    value={socialLinksForm.whatsapp || ''}
                    onChange={e => setSocialLinksForm({...socialLinksForm, whatsapp: e.target.value.replace(/https?:\/\/(www\.)?(wa\.me|api\.whatsapp\.com\/send\?phone=)\//, '').replace(/^\+/, '').replace(/[^0-9]/g, '')})}
                    className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-r-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Instagram Username</label>
                <div className="flex shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 text-slate-500 text-xs font-mono">instagram.com/</span>
                  <input
                    type="text"
                    placeholder="username"
                    value={socialLinksForm.instagram || ''}
                    onChange={e => setSocialLinksForm({...socialLinksForm, instagram: e.target.value.replace(/https?:\/\/(www\.)?instagram\.com\//, '').replace(/^\//, '')})}
                    className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-r-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-700 text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">LinkedIn Username</label>
                <div className="flex shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 text-slate-500 text-xs font-mono">linkedin.com/in/</span>
                  <input
                    type="text"
                    placeholder="username"
                    value={socialLinksForm.linkedin || ''}
                    onChange={e => setSocialLinksForm({...socialLinksForm, linkedin: e.target.value.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/^\//, '')})}
                    className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-r-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-700 text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">X (Twitter) Username</label>
                <div className="flex shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 text-slate-500 text-xs font-mono">x.com/</span>
                  <input
                    type="text"
                    placeholder="username"
                    value={socialLinksForm.twitter || ''}
                    onChange={e => setSocialLinksForm({...socialLinksForm, twitter: e.target.value.replace(/https?:\/\/(www\.)?(twitter|x)\.com\//, '').replace(/^\//, '')})}
                    className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-r-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-700 text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">TikTok Username</label>
                <div className="flex shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 text-slate-500 text-xs font-mono">tiktok.com/@</span>
                  <input
                    type="text"
                    placeholder="username"
                    value={socialLinksForm.tiktok || ''}
                    onChange={e => setSocialLinksForm({...socialLinksForm, tiktok: e.target.value.replace(/https?:\/\/(www\.)?tiktok\.com\/@?/, '').replace(/^\//, '').replace(/^@/, '')})}
                    className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-r-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-700 text-slate-900"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  type="submit" 
                  disabled={isSavingSocial}
                  className="flex-1 bg-indigo-700 hover:bg-indigo-800 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition shadow-md disabled:opacity-50"
                >
                  {isSavingSocial ? 'Saving...' : 'Save Links'}
                </button>
                <button 
                  type="button"
                  onClick={() => setIsEditingSocial(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. PERMANENT GDPR ACCOUNT DELETE CONFIRMATION */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-xl w-full max-w-sm overflow-hidden p-6 shadow-2xl">
            <h3 className="text-sm font-black text-rose-950 mb-1 uppercase tracking-widest flex items-center gap-1.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 animate-bounce" />
              <span>Confirm Permanent Deletion</span>
            </h3>
            <p className="text-[10px] text-slate-500 font-medium mb-4 leading-relaxed">This action will trigger a full relational cascade, permanently deleting your profile, photos, direct handshakes, and private notes. Sent chat messages will be instantly anonymized.</p>

            <div className="space-y-4">
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-[9px] leading-relaxed shadow-inner">
                <strong>Crucial Warning:</strong> All content uploaded by you is subject to immediate irreversible removal. This adheres strictly to the Right to be Forgotten under GDPR Article 17.
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={handleDeleteAccount}
                  className="flex-1 bg-rose-750 hover:bg-rose-800 shadow-md shadow-rose-500/20 hover:shadow-lg hover:shadow-rose-500/40 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition shadow-md"
                >
                  Permanently Purge
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-100 font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition"
                >
                  Keep Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. QR CODE SCANNER MODAL */}
      {showQrScanner && (
        <QRScannerModal 
          onClose={() => setShowQrScanner(false)} 
          onScanSuccess={handleQrScanSuccess} 
        />
      )}

      {/* 6. QR CODE DISPLAY MODAL */}
      {showQrCodeModal && qrCodeEvent && (
        <QRCodeModal 
          onClose={() => {
            setShowQrCodeModal(false);
            setQrCodeEvent(null);
          }}
          eventName={qrCodeEvent.name}
          eventLocation={qrCodeEvent.location}
          eventDate={qrCodeEvent.date}
          checkInCode={qrCodeEvent.checkInCode}
        />
      )}

      {/* 7. FULL SCREEN IMAGE LIGHTBOX */}
      {selectedFullScreenImage && (
        <div 
          onClick={() => setSelectedFullScreenImage(null)}
          className="fixed inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center z-50 p-4 animate-in fade-in duration-200 cursor-pointer"
        >
          {/* Top Control Bar */}
          <div className="absolute top-4 right-4 flex items-center gap-3">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest bg-zinc-900/60 border border-zinc-850 px-3 py-1 rounded-full">
              Tap anywhere to close
            </span>
            <button 
              onClick={() => setSelectedFullScreenImage(null)}
              className="bg-zinc-900 hover:bg-zinc-850 text-white rounded-full p-2.5 border border-zinc-700/80 transition shadow-lg"
              title="Close Full Screen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="max-w-4xl max-h-[85vh] flex items-center justify-center p-2">
            <img 
              src={selectedFullScreenImage} 
              alt="Event Snapshot Fullscreen" 
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-zinc-800 select-none animate-in zoom-in-95 duration-150"
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

    </div>
  );
}
