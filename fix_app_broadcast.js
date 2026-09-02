import fs from 'fs';

let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add refs and state
const refTarget = /const acceptedConnectionsRef = useRef<string\[\]>\(\[\]\);/;
const newRefs = `const acceptedConnectionsRef = useRef<string[]>([]);
  const seenBroadcastsRef = useRef<Set<string>>(new Set());
  const [broadcastInput, setBroadcastInput] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);`;
code = code.replace(refTarget, newRefs);

// 2. Add fetchBroadcasts function
const fetchTarget = /const fetchDashboardStats = async \(\) => \{/;
const newFetch = `const fetchBroadcasts = async () => {
    if (!currentEvent || !isOnline) return;
    try {
      const res = await fetch(\`/api/events/\${currentEvent.id}/broadcasts\`, {
        headers: { 'Authorization': \`Bearer \${token}\` }
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
                showToast(\`📢 Announcement: \${b.message}\`, 'info');
              }
            }
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDashboardStats = async () => {`;
code = code.replace(fetchTarget, newFetch);

// 3. Add to polling
const pollingTarget1 = /if \(currentEvent.organizerId === user\?\.id\) \{\n        fetchDashboardStats\(\);\n      \}/;
const newPolling1 = `if (currentEvent.organizerId === user?.id) {
        fetchDashboardStats();
      }
      fetchBroadcasts();`;
code = code.replace(pollingTarget1, newPolling1);

const pollingTarget2 = /if \(currentEvent.organizerId === user\?\.id\) \{\n            fetchDashboardStats\(\);\n          \}/g;
const newPolling2 = `if (currentEvent.organizerId === user?.id) {
            fetchDashboardStats();
          }
          fetchBroadcasts();`;
code = code.replace(pollingTarget2, newPolling2);

// 4. Add handleSendBroadcast
const handlerTarget = /const handleCheckOut = async \(\) => \{/;
const newHandler = `const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEvent || !broadcastInput.trim()) return;
    setIsSendingBroadcast(true);
    try {
      const res = await fetch(\`/api/events/\${currentEvent.id}/broadcast\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
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

  const handleCheckOut = async () => {`;
code = code.replace(handlerTarget, newHandler);

fs.writeFileSync('src/App.tsx', code);
console.log('src/App.tsx modified 4 phases');
