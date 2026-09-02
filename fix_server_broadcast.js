import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

const regex = /app\.get\('\/api\/events\/:id\/directory'/;
const newRoutes = `// Broadcast messages
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

app.get('/api/events/:id/directory'`;

if (!code.includes('/api/events/:id/broadcasts')) {
  code = code.replace(regex, newRoutes);
  fs.writeFileSync('server.ts', code);
  console.log('server.ts updated');
} else {
  console.log('Broadcast routes already in server.ts');
}
