import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle, 
  Trash2, 
  Eye, 
  EyeOff,
  Activity, 
  FileText, 
  RefreshCw, 
  Search, 
  Calendar, 
  Clock, 
  Lock, 
  Unlock, 
  X,
  TrendingUp,
  UserCheck,
  UserX,
  MessageSquare
} from 'lucide-react';

interface AdminPanelProps {
  token: string;
  onBack: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type AdminTab = 'dashboard' | 'moderation' | 'users' | 'events' | 'audit';

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

export default function AdminPanel({ token, onBack, showToast }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [loading, setLoading] = useState(false);

  // Stats State
  const [stats, setStats] = useState<any>({
    totalUsers: 0,
    totalEvents: 0,
    totalPhotos: 0,
    pendingReports: 0,
    activeCheckins: 0
  });

  // Moderation State
  const [moderationItems, setModerationItems] = useState<any[]>([]);
  const [modFilterStatus, setModFilterStatus] = useState<'all' | 'pending' | 'reviewed'>('pending');
  const [modFilterType, setModFilterType] = useState<string>('');
  const [modFilterEvent, setModFilterEvent] = useState<string>('');

  // Users State
  const [userList, setUserList] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserDetail, setSelectedUserDetail] = useState<any | null>(null);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);

  // Events State
  const [eventList, setEventList] = useState<any[]>([]);
  const [selectedEventDashboard, setSelectedEventDashboard] = useState<any | null>(null);
  const [loadingEventDashboard, setLoadingEventDashboard] = useState(false);

  // Audit State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Actions loading flags
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Fetch Stats
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await safeParseJson(res);
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching admin stats:', err);
    }
  };

  // Fetch Moderation Queue
  const fetchModeration = async () => {
    setLoading(true);
    try {
      let url = `/api/admin/moderation?status=${modFilterStatus}`;
      if (modFilterType) url += `&targetType=${modFilterType}`;
      if (modFilterEvent) url += `&eventId=${modFilterEvent}`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await safeParseJson(res);
        setModerationItems(data);
      }
    } catch (err) {
      showToast('Failed to load moderation queue.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch User List
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const url = `/api/admin/users?search=${encodeURIComponent(userSearch)}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await safeParseJson(res);
        setUserList(data);
      }
    } catch (err) {
      showToast('Failed to load user directory.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch User Details
  const fetchUserDetail = async (userId: string) => {
    setLoadingUserDetail(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/detail`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await safeParseJson(res);
        setSelectedUserDetail(data);
      } else {
        showToast('Failed to load user details.', 'error');
      }
    } catch (err) {
      showToast('Error loading user detail.', 'error');
    } finally {
      setLoadingUserDetail(false);
    }
  };

  // Fetch Events List
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/events', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await safeParseJson(res);
        setEventList(data);
      }
    } catch (err) {
      showToast('Failed to load events.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Event Inspector Dashboard (Read-Only Organizer Dashboard)
  const fetchEventDashboard = async (eventId: string) => {
    setLoadingEventDashboard(true);
    try {
      const res = await fetch(`/api/events/${eventId}/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await safeParseJson(res);
        setSelectedEventDashboard({ ...data, eventId });
      } else {
        showToast('Failed to load event dashboard.', 'error');
      }
    } catch (err) {
      showToast('Error inspect event.', 'error');
    } finally {
      setLoadingEventDashboard(false);
    }
  };

  // Fetch Audit Logs
  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await safeParseJson(res);
        setAuditLogs(data);
      }
    } catch (err) {
      showToast('Failed to load audit logs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Trigger loading based on tab
  useEffect(() => {
    fetchStats();
    if (activeTab === 'dashboard') {
      fetchStats();
    } else if (activeTab === 'moderation') {
      fetchModeration();
    } else if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'events') {
      fetchEvents();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, modFilterStatus, modFilterType, modFilterEvent]);

  // Handle Moderation Action
  const handleModerationAction = async (itemId: string, action: string, targetType: string, targetId: string, reportId: string | null) => {
    setActionInProgress(itemId);
    try {
      const res = await fetch('/api/admin/moderation/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, targetType, targetId, reportId })
      });

      if (res.ok) {
        const data = await safeParseJson(res);
        showToast(`Action success: ${data.details || 'Processed successfully'}`, 'success');
        fetchModeration();
        fetchStats();
      } else {
        const error = await safeParseJson(res);
        showToast(error.error || 'Failed to apply moderation action.', 'error');
      }
    } catch (err) {
      showToast('Network error during moderation action.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle User Action (suspend/promote/delete)
  const handleUserAction = async (userId: string, action: string, value?: any) => {
    setActionInProgress(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, value })
      });

      if (res.ok) {
        showToast(`User status updated successfully.`, 'success');
        fetchUsers();
        if (selectedUserDetail && selectedUserDetail.id === userId) {
          fetchUserDetail(userId);
        }
        fetchStats();
      } else {
        showToast('Failed to update user status.', 'error');
      }
    } catch (err) {
      showToast('Network error.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle Event Action (deactivate, reactivate, delete)
  const handleEventAction = async (eventId: string, action: string) => {
    setActionInProgress(eventId);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });

      if (res.ok) {
        if (action === 'deactivate') {
          showToast(`Event deactivated successfully. All active check-ins closed.`, 'success');
        } else if (action === 'reactivate') {
          showToast(`Event reactivated successfully! Attendees can now check in.`, 'success');
        } else if (action === 'delete') {
          showToast(`Event and associated data deleted permanently.`, 'success');
        } else if (action === 'hide') {
          showToast(`Event hidden. Standard users will no longer see it.`, 'info');
        } else if (action === 'unhide') {
          showToast(`Event unhidden. Standard users can now see it.`, 'success');
        }
        fetchEvents();
        if (selectedEventDashboard && selectedEventDashboard.eventId === eventId) {
          if (action === 'delete') {
            setSelectedEventDashboard(null);
          } else {
            fetchEventDashboard(eventId);
          }
        }
        fetchStats();
      } else {
        const data = await safeParseJson(res);
        showToast(data.error || `Failed to ${action} event.`, 'error');
      }
    } catch (err) {
      showToast('Network error.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-slate-900 text-slate-100 h-full overflow-hidden">
      {/* Admin Header */}
      <div className="p-4 bg-slate-900 border-b-4 border-slate-800 flex items-center justify-between shrink-0 z-10 shadow-md">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-500 animate-pulse" />
          <span className="font-black text-sm tracking-wider uppercase text-amber-500">Admin Control Panel</span>
        </div>
        <button 
          onClick={onBack}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition"
        >
          Exit Admin
        </button>
      </div>

      {/* Admin Tab Nav */}
      <div className="grid grid-cols-5 bg-slate-900 px-2 py-1.5 border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-center shrink-0 z-10">
        <button 
          onClick={() => { setActiveTab('dashboard'); setSelectedUserDetail(null); setSelectedEventDashboard(null); }}
          className={`py-2 rounded-md transition ${activeTab === 'dashboard' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Stats
        </button>
        <button 
          onClick={() => { setActiveTab('moderation'); setSelectedUserDetail(null); setSelectedEventDashboard(null); }}
          className={`py-2 rounded-md transition relative ${activeTab === 'moderation' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Queue
          {stats.pendingReports > 0 && (
            <span className="absolute -top-1 -right-0.5 bg-rose-600 text-white text-[8px] font-bold px-1 rounded-full animate-bounce">
              {stats.pendingReports}
            </span>
          )}
        </button>
        <button 
          onClick={() => { setActiveTab('users'); setSelectedUserDetail(null); setSelectedEventDashboard(null); }}
          className={`py-2 rounded-md transition ${activeTab === 'users' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Users
        </button>
        <button 
          onClick={() => { setActiveTab('events'); setSelectedUserDetail(null); setSelectedEventDashboard(null); }}
          className={`py-2 rounded-md transition ${activeTab === 'events' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Events
        </button>
        <button 
          onClick={() => { setActiveTab('audit'); setSelectedUserDetail(null); setSelectedEventDashboard(null); }}
          className={`py-2 rounded-md transition ${activeTab === 'audit' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Audit
        </button>
      </div>

      {/* Main Container */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        
        {/* --- TAB 1: SYSTEM STATS --- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest">Platform Telemetry</h3>
              <button 
                onClick={fetchStats}
                className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 uppercase tracking-wider"
              >
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Reload</span>
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Total Users</span>
                <span className="text-2xl font-black text-slate-100 block mt-1">{stats.totalUsers}</span>
                <span className="text-[8px] text-slate-400 block mt-0.5">Registered accounts</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Total Events</span>
                <span className="text-2xl font-black text-slate-100 block mt-1">{stats.totalEvents}</span>
                <span className="text-[8px] text-slate-400 block mt-0.5">Hosted venues</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Shared Photos</span>
                <span className="text-2xl font-black text-slate-100 block mt-1">{stats.totalPhotos}</span>
                <span className="text-[8px] text-slate-400 block mt-0.5 font-semibold">Feed contributions</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Active Handshakes</span>
                <span className="text-2xl font-black text-slate-100 block mt-1">{stats.activeCheckins}</span>
                <span className="text-[8px] text-slate-400 block mt-0.5">Live visibility presences</span>
              </div>
            </div>

            {/* Moderation Alert Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4 shadow">
              <div className="space-y-1">
                <span className="bg-rose-900/40 text-rose-300 font-bold px-2 py-0.5 rounded text-[8px] uppercase tracking-widest inline-block border border-rose-800">
                  Critical Safety
                </span>
                <h4 className="font-extrabold text-[11px] uppercase tracking-wide leading-tight">Unresolved Content Flags</h4>
                <p className="text-[9px] text-slate-400 font-medium leading-normal">
                  There are currently <strong className="text-rose-400">{stats.pendingReports}</strong> unreviewed safety flags pending admin audit.
                </p>
              </div>
              <button 
                onClick={() => setActiveTab('moderation')}
                className="bg-amber-600 hover:bg-amber-700 text-white font-black px-4 py-2.5 rounded-xl text-[10px] uppercase tracking-wider transition shrink-0 shadow flex items-center gap-1"
              >
                <span>Process Queue</span>
              </button>
            </div>
          </div>
        )}

        {/* --- TAB 2: UNIFIED MODERATION QUEUE --- */}
        {activeTab === 'moderation' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest">Unified Content Queue</h3>
                <span className="text-[9px] bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                  {moderationItems.length} items
                </span>
              </div>

              {/* Moderation Filters */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <label className="block text-[8px] font-black uppercase text-slate-500 mb-1 tracking-wider">Review Status</label>
                  <select 
                    value={modFilterStatus}
                    onChange={(e: any) => setModFilterStatus(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                  >
                    <option value="pending">Pending Review</option>
                    <option value="reviewed">Reviewed Items</option>
                    <option value="all">All Items</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[8px] font-black uppercase text-slate-500 mb-1 tracking-wider">Content Type</label>
                  <select 
                    value={modFilterType}
                    onChange={(e) => setModFilterType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">All Types</option>
                    <option value="user">Users</option>
                    <option value="photo">Photos</option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400 uppercase tracking-wider animate-pulse">
                Analyzing Reports...
              </div>
            ) : moderationItems.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs font-medium">
                No flagged items match your filter criteria.
              </div>
            ) : (
              <div className="space-y-3">
                {moderationItems.map((item) => (
                  <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
                    
                    {/* Item Top Strip */}
                    <div className="bg-slate-900 px-3.5 py-2 border-b border-slate-800 flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
                      <span className={`${item.targetType === 'photo' ? 'text-indigo-400' : 'text-amber-400'}`}>
                        Flagged {item.targetType}
                      </span>
                      <span className="text-slate-500">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Item Core Info */}
                    <div className="p-3.5 flex gap-3.5">
                      {/* Left: Thumbnail/User Badge */}
                      {item.targetType === 'photo' ? (
                        <div className="w-14 h-14 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shrink-0">
                          <img 
                            src={item.targetPreview} 
                            alt="Flagged Photo" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center text-amber-500 font-bold text-sm shrink-0 uppercase">
                          {item.targetName.slice(0, 2)}
                        </div>
                      )}

                      {/* Right: Reason / Target details */}
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="text-[10px] text-slate-400 font-medium">
                          Reporter: <strong className="text-slate-200">{item.reporter.name}</strong>
                        </div>
                        <div className="text-xs font-bold text-slate-100 break-words line-clamp-3">
                          &quot;{item.reason}&quot;
                        </div>
                        {item.eventName && (
                          <div className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">
                            Event: {item.eventName}
                          </div>
                        )}
                        {item.uploader && item.uploader.name && (
                          <div className="text-[9px] text-slate-500 font-medium">
                            Target Owner: <span className="text-slate-400">{item.uploader.name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Moderation Actions Footer */}
                    {!item.reviewed && (
                      <div className="bg-slate-900 px-3 py-2 border-t border-slate-800/60 grid grid-cols-4 gap-1 text-[9px] font-bold uppercase tracking-wider text-center">
                        <button
                          disabled={actionInProgress === item.id}
                          onClick={() => handleModerationAction(item.id, 'dismiss', item.targetType, item.targetId, item.reportId)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded transition disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                        <button
                          disabled={actionInProgress === item.id}
                          onClick={() => handleModerationAction(item.id, 'warn', item.targetType, item.targetId, item.reportId)}
                          className="bg-slate-800 hover:bg-amber-600/30 hover:text-amber-400 text-slate-300 py-1.5 rounded transition disabled:opacity-50"
                        >
                          Warn
                        </button>
                        <button
                          disabled={actionInProgress === item.id}
                          onClick={() => handleModerationAction(item.id, 'confirm_removal', item.targetType, item.targetId, item.reportId)}
                          className="bg-rose-950 hover:bg-rose-900 text-rose-300 py-1.5 rounded border border-rose-800 transition disabled:opacity-50"
                        >
                          Remove
                        </button>
                        <button
                          disabled={actionInProgress === item.id}
                          onClick={() => handleModerationAction(item.id, 'suspend', 'user', item.uploader.id, item.reportId)}
                          className="bg-red-700 hover:bg-red-800 text-white py-1.5 rounded transition disabled:opacity-50"
                        >
                          Suspend
                        </button>
                      </div>
                    )}

                    {item.reviewed && (
                      <div className="bg-slate-900 px-3.5 py-1.5 text-center text-[9px] text-emerald-500 font-black uppercase tracking-widest border-t border-slate-800 flex items-center justify-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Audited & Reviewed</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- TAB 3: USER DIRECTORY MANAGEMENT --- */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            
            {/* Search Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input 
                  type="text" 
                  placeholder="Search user profiles..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
              <button 
                onClick={fetchUsers}
                className="bg-amber-600 hover:bg-amber-700 text-white font-black px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition"
              >
                Search
              </button>
            </div>

            {selectedUserDetail ? (
              /* User Detailed Inspector Card */
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 shadow animate-in fade-in zoom-in-95 duration-150">
                
                {/* Back Link */}
                <button 
                  onClick={() => setSelectedUserDetail(null)}
                  className="text-[10px] text-amber-500 hover:text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Close Detail Inspector</span>
                </button>

                {/* Profile Inspector Header */}
                <div className="flex items-center gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800">
                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-amber-500 font-black text-sm uppercase shrink-0 border border-slate-700">
                    {selectedUserDetail.name.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-xs text-slate-100 truncate">{selectedUserDetail.name}</h4>
                    <span className="text-[10px] text-slate-500 font-mono truncate block mt-0.5">{selectedUserDetail.email}</span>
                  </div>
                </div>

                {/* Account Status / Metadata */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-400">
                  <div className="bg-slate-900/50 p-2.5 rounded border border-slate-800/80">
                    <span className="block text-[8px] text-slate-500 uppercase font-black mb-1">Registration Date</span>
                    <span className="text-slate-200">{new Date(selectedUserDetail.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="bg-slate-900/50 p-2.5 rounded border border-slate-800/80">
                    <span className="block text-[8px] text-slate-500 uppercase font-black mb-1">Role Privileges</span>
                    <span className={selectedUserDetail.is_admin ? 'text-amber-400' : 'text-slate-300'}>
                      {selectedUserDetail.is_admin ? 'Platform Admin' : 'Standard User'}
                    </span>
                  </div>
                </div>

                {/* Inspector Actions Strip */}
                <div className="border-t border-b border-slate-800 py-3.5 space-y-2.5">
                  <span className="block text-[8px] font-black uppercase text-slate-500 tracking-wider">Account Administrative Actions</span>
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-bold uppercase tracking-wider text-center">
                    <button
                      disabled={actionInProgress === selectedUserDetail.id}
                      onClick={() => handleUserAction(selectedUserDetail.id, 'suspend', !selectedUserDetail.suspended)}
                      className={`py-2 rounded transition flex items-center justify-center gap-1 ${
                        selectedUserDetail.suspended 
                          ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-800 hover:bg-emerald-950' 
                          : 'bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900'
                      }`}
                    >
                      {selectedUserDetail.suspended ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>{selectedUserDetail.suspended ? 'Reinstate' : 'Suspend'}</span>
                    </button>
                    
                    <button
                      disabled={actionInProgress === selectedUserDetail.id}
                      onClick={() => handleUserAction(selectedUserDetail.id, 'promote', !selectedUserDetail.is_admin)}
                      className="bg-slate-850 hover:bg-slate-800 text-slate-200 py-2 rounded border border-slate-700 transition"
                    >
                      {selectedUserDetail.is_admin ? 'Demote Admin' : 'Make Admin'}
                    </button>

                    <button
                      disabled={actionInProgress === selectedUserDetail.id}
                      onClick={() => {
                        if (confirm('CRITICAL: Are you absolutely sure you want to permanently erase this profile? This triggers immediate cascading deletion across connections, photos, and messages.')) {
                          handleUserAction(selectedUserDetail.id, 'force_delete');
                          setSelectedUserDetail(null);
                        }
                      }}
                      className="bg-red-700 hover:bg-red-800 text-white py-2 rounded transition"
                    >
                      Force Purge
                    </button>
                  </div>
                </div>

                {/* Collapsed Inspector Logs (Read-only Summary stats) */}
                <div className="space-y-3">
                  <span className="block text-[8px] font-black uppercase text-slate-500 tracking-wider">Historical Engagement Audit</span>
                  
                  {/* Notes counts (never exposing note content!) */}
                  <div className="flex justify-between items-center text-xs bg-slate-900 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 font-semibold">Saved Connection Notes</span>
                    <span className="bg-slate-850 text-slate-200 px-2.5 py-0.5 rounded font-mono font-bold">
                      {selectedUserDetail.notesCount} private notes (Admins can&apos;t read content)
                    </span>
                  </div>

                  {/* Attended Events */}
                  <div className="space-y-1.5">
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Attended Events ({selectedUserDetail.attendedEvents.length})</span>
                    {selectedUserDetail.attendedEvents.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic">No check-ins logged.</p>
                    ) : (
                      <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                        {selectedUserDetail.attendedEvents.map((evt: any, i: number) => (
                          <div key={i} className="text-[10px] bg-slate-900 p-1.5 rounded border border-slate-850 flex justify-between">
                            <span className="text-slate-200 truncate pr-2 font-bold">{evt.eventName}</span>
                            <span className="text-slate-400 shrink-0 font-mono">{new Date(evt.checkedInAt).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Reports Against */}
                  <div className="space-y-1.5">
                    <span className="block text-[8px] font-bold text-rose-400 uppercase tracking-widest">Reports Filed Against Account ({selectedUserDetail.reportsAgainst.length})</span>
                    {selectedUserDetail.reportsAgainst.length === 0 ? (
                      <p className="text-[10px] text-emerald-500 font-medium italic">Pristine profile - 0 flags.</p>
                    ) : (
                      <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                        {selectedUserDetail.reportsAgainst.map((rep: any, i: number) => (
                          <div key={i} className="text-[10px] bg-rose-950/20 p-1.5 rounded border border-rose-950/40 space-y-1">
                            <div className="flex justify-between font-bold">
                              <span className="text-rose-300">By: {rep.reporterName}</span>
                              <span className="text-slate-500 font-mono">{new Date(rep.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-slate-200 italic break-words">&quot;{rep.reason}&quot;</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              /* User Directory List Grid */
              loading ? (
                <div className="p-12 text-center text-xs text-slate-400 uppercase tracking-wider animate-pulse">
                  Querying database...
                </div>
              ) : userList.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs font-medium">
                  No users found matching your search.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {userList.map((usr) => (
                    <div key={usr.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex items-center justify-between gap-3 shadow transition">
                      <div className="min-w-0 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs uppercase ${usr.suspended ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                          {usr.name.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-200 truncate">{usr.name}</span>
                            {usr.is_admin && (
                              <span className="bg-amber-900/50 border border-amber-800 text-amber-300 text-[8px] font-black px-1 rounded">Admin</span>
                            )}
                            {usr.suspended && (
                              <span className="bg-rose-950 border border-rose-800 text-rose-400 text-[8px] font-black px-1 rounded animate-pulse">Suspended</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 truncate block font-mono mt-0.5">{usr.email}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => fetchUserDetail(usr.id)}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-300 p-2 rounded-lg border border-slate-800 transition shadow shrink-0"
                        title="Inspect User Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* --- TAB 4: EVENT OVERSIGHT --- */}
        {activeTab === 'events' && (
          <div className="space-y-4">
            
            {selectedEventDashboard ? (
              /* Read-only Single Event Dashboard Inspector */
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 shadow animate-in fade-in zoom-in-95 duration-150">
                
                {/* Back Link */}
                <button 
                  onClick={() => setSelectedEventDashboard(null)}
                  className="text-[10px] text-amber-500 hover:text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Exit Event Inspector</span>
                </button>

                {/* Event Metadata Card */}
                <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-extrabold text-xs text-slate-100 uppercase tracking-wide">{selectedEventDashboard.eventName}</h4>
                    <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 text-[8px] font-black px-1.5 rounded uppercase font-mono tracking-widest shrink-0">
                      Code: {selectedEventDashboard.eventCode}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-400 font-medium leading-relaxed">
                    This event has hosted <strong className="text-indigo-400">{selectedEventDashboard.totalAttendance}</strong> historical attendees.
                  </div>
                  <button
                    onClick={() => {
                      fetch(`/api/admin/events/${selectedEventDashboard.eventId}/attendees.csv`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                      }).then(res => {
                        if (res.ok) return res.blob();
                        throw new Error('Failed to download');
                      }).then(blob => {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `event_${selectedEventDashboard.eventCode}_attendees.csv`;
                        a.click();
                        window.URL.revokeObjectURL(url);
                      }).catch(() => showToast('Failed to download Recap.', 'error'));
                    }}
                    className="w-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 font-bold py-2 rounded text-[10px] uppercase tracking-widest transition flex items-center justify-center gap-2 mt-2"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Download Attendee List (Excel / CSV)
                  </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-900/40 border border-slate-800/80 rounded-lg p-3">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Live Checked-In</span>
                    <span className="text-base font-black text-slate-100 block mt-0.5">{selectedEventDashboard.activeCheckIns} attendees</span>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800/80 rounded-lg p-3">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Handshakes Exchanged</span>
                    <span className="text-base font-black text-slate-100 block mt-0.5">{selectedEventDashboard.eventConnections}</span>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800/80 rounded-lg p-3">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Snaps Uploaded</span>
                    <span className="text-base font-black text-slate-100 block mt-0.5">{selectedEventDashboard.totalPhotos} snaps</span>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800/80 rounded-lg p-3">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Hidden Flags</span>
                    <span className="text-base font-black text-rose-400 block mt-0.5">{selectedEventDashboard.flaggedPhotos} reviews</span>
                  </div>
                </div>

                {/* Aggregated Interest Tags */}
                <div className="bg-slate-900/50 border border-slate-850 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[8px] font-bold uppercase tracking-widest">Aggregated Interests</span>
                  </div>

                  {selectedEventDashboard.interestTags.length === 0 ? (
                    <p className="text-[9px] text-slate-500 font-medium italic">No matches accumulated.</p>
                  ) : (
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {selectedEventDashboard.interestTags.map((tag: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-[11px] p-1 rounded hover:bg-slate-900/85">
                          <span className="text-slate-300 font-bold">#{tag.name}</span>
                          <span className="bg-slate-800 text-slate-300 text-[9px] px-2 py-0.5 rounded font-mono font-bold border border-slate-700/80">
                            {tag.count} matches
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              /* Events List with Checkin counters & Manual Deactivation */
              loading ? (
                <div className="p-12 text-center text-xs text-slate-400 uppercase tracking-wider animate-pulse">
                  Querying events...
                </div>
              ) : eventList.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs font-medium">
                  No events have been published on this platform.
                </div>
              ) : (
                <div className="space-y-3">
                  {eventList.map((evt) => (
                    <div key={evt.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow">
                      
                      {/* Event row Header */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-xs text-slate-100 truncate flex items-center gap-1.5">
                            <span className="truncate">{evt.name}</span>
                            {evt.deactivated && (
                              <span className="bg-rose-950 border border-rose-800 text-rose-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">Closed</span>
                            )}
                            {evt.hidden && (
                              <span className="bg-amber-950/80 border border-amber-800 text-amber-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase shrink-0 flex items-center gap-0.5">
                                <EyeOff className="w-2.5 h-2.5" />
                                Hidden
                              </span>
                            )}
                          </h4>
                          <span className="text-[9px] text-slate-500 block mt-0.5">Host: {evt.organizerName}</span>
                        </div>
                        <span className="text-[9px] bg-slate-900 text-indigo-300 px-2.5 py-1 rounded border border-slate-850 uppercase font-mono font-bold shrink-0">
                          Code: {evt.checkInCode}
                        </span>
                      </div>

                      {/* Event Row Quick Counters */}
                      <div className="grid grid-cols-3 gap-1.5 text-[9px] text-slate-400 font-semibold uppercase text-center">
                        <div className="bg-slate-900 p-1 rounded">
                          <strong className="text-slate-200 block text-xs">{evt.liveCheckinCount}</strong> Check-Ins
                        </div>
                        <div className="bg-slate-900 p-1 rounded">
                          <strong className="text-slate-200 block text-xs">{evt.totalPhotos}</strong> Snaps
                        </div>
                        <div className="bg-slate-900 p-1 rounded">
                          <strong className={`${evt.pendingReportsCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-200'} block text-xs`}>{evt.pendingReportsCount}</strong> Flags
                        </div>
                      </div>

                      {/* Row Action Footer */}
                      <div className="pt-2 border-t border-slate-900 flex justify-between gap-2">
                        <button
                          onClick={() => fetchEventDashboard(evt.id)}
                          className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] px-3.5 py-1.5 rounded-lg font-bold uppercase tracking-wider transition flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect metrics</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          {!evt.hidden ? (
                            <button
                              disabled={actionInProgress === evt.id}
                              onClick={() => {
                                if (confirm(`Hide "${evt.name}" from public listing? Only admins will see it.`)) {
                                  handleEventAction(evt.id, 'hide');
                                }
                              }}
                              className="bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800/80 text-[10px] px-2.5 py-1.5 rounded-lg font-bold uppercase tracking-wider transition flex items-center gap-1 disabled:opacity-50"
                              title="Hide event from public view"
                            >
                              <EyeOff className="w-3 h-3" />
                              <span>Hide</span>
                            </button>
                          ) : (
                            <button
                              disabled={actionInProgress === evt.id}
                              onClick={() => {
                                if (confirm(`Unhide "${evt.name}" to make it visible to all users again?`)) {
                                  handleEventAction(evt.id, 'unhide');
                                }
                              }}
                              className="bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-800/80 text-[10px] px-2.5 py-1.5 rounded-lg font-bold uppercase tracking-wider transition flex items-center gap-1 disabled:opacity-50"
                              title="Unhide event for all users"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Unhide</span>
                            </button>
                          )}

                          {!evt.deactivated ? (
                            <button
                              disabled={actionInProgress === evt.id}
                              onClick={() => {
                                if (confirm('Are you sure you want to deactivate and shut down this event venue manually? This will clear all present checked-in users.')) {
                                  handleEventAction(evt.id, 'deactivate');
                                }
                              }}
                              className="bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/80 text-[10px] px-3.5 py-1.5 rounded-lg font-bold uppercase tracking-wider transition disabled:opacity-50"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <>
                              <button
                                disabled={actionInProgress === evt.id}
                                onClick={() => {
                                  if (confirm('Reactivate this event to allow check-ins again?')) {
                                    handleEventAction(evt.id, 'reactivate');
                                  }
                                }}
                                className="bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80 text-[10px] px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider transition disabled:opacity-50"
                              >
                                Reactivate
                              </button>
                              <button
                                disabled={actionInProgress === evt.id}
                                onClick={() => {
                                  if (confirm('Permanently delete this event and all associated photos and check-in history?')) {
                                    handleEventAction(evt.id, 'delete');
                                  }
                                }}
                                className="bg-rose-900 hover:bg-rose-800 text-white text-[10px] px-2.5 py-1.5 rounded-lg font-bold uppercase tracking-wider transition disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* --- TAB 5: AUDIT LOGS --- */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest">Platform Audit Trail</h3>
              <button 
                onClick={fetchAuditLogs}
                className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 uppercase tracking-wider"
              >
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Reload</span>
              </button>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400 uppercase tracking-wider animate-pulse">
                Querying Audit Trail...
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs font-medium">
                No administrative actions have been logged yet.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <div key={log.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2 shadow">
                    
                    {/* Log Date & Admin */}
                    <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold uppercase font-mono border-b border-slate-900 pb-1.5">
                      <span>By: {log.adminName}</span>
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>

                    {/* Action Tag & details */}
                    <div className="flex flex-col gap-1 text-[11px]">
                      <div>
                        <span className="bg-amber-950 text-amber-400 border border-amber-800/60 font-black px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-mono mr-2">
                          {log.action}
                        </span>
                        <span className="text-slate-400 font-semibold uppercase text-[9px] font-mono">
                          ID: {log.id}
                        </span>
                      </div>
                      <div className="text-slate-200 font-medium">
                        Target Type: <strong className="text-slate-100 uppercase font-mono">{log.targetType}</strong>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate font-mono">
                        Target ID: {log.targetId}
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
