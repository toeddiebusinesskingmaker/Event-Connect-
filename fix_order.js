import fs from 'fs';

// --- App.tsx ---
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
const handleExportPattern = /const handleExportRecap = \(\) => \{[\s\S]*?showToast\('Event summary downloaded!', 'success'\);\n  \};/;

const newHandleExport = `const handleExportRecap = () => {
    if (!dashboardStats) return;

    let csvContent = 'EVENT CONNECT - RECAP REPORT\\n\\n';
    csvContent += \`Event:,\${dashboardStats.eventName}\\n\`;
    csvContent += \`Check-in Code:,\${dashboardStats.eventCode}\\n\`;
    csvContent += \`Generated At:,\${new Date().toLocaleString()}\\n\\n\`;

    csvContent += '--- LIVE STATS SUMMARY ---\\n';
    csvContent += \`Total Checked-In Attendance:,\${dashboardStats.totalAttendance}\\n\`;
    csvContent += \`Active At This Moment:,\${dashboardStats.activeCheckIns}\\n\`;
    csvContent += \`Connections Handshaked:,\${dashboardStats.eventConnections}\\n\`;
    csvContent += \`Shared Live Photos Uploaded:,\${dashboardStats.totalPhotos}\\n\`;
    csvContent += \`Flagged/Hidden Content:,\${dashboardStats.flaggedPhotos}\\n\\n\`;

    csvContent += '--- ATTENDEES SUMMARY ---\\n';
    if (dashboardStats.attendees && dashboardStats.attendees.length > 0) {
      csvContent += 'Serial Number,Check-in Time,First Name,Last Name,Email,Phone Number,Interest\\n';
      csvContent += dashboardStats.attendees.map((a: any, index: number) => {
        const checkInTime = a.checkInTime;
        const firstName = \`"\${(a.firstName || '').replace(/"/g, '""')}"\`;
        const lastName = \`"\${(a.lastName || '').replace(/"/g, '""')}"\`;
        const email = \`"\${(a.email || '').replace(/"/g, '""')}"\`;
        const phone = \`"\${(a.phone || '').replace(/"/g, '""')}"\`;
        const interest = \`"\${(a.interest || '').replace(/"/g, '""')}"\`;
        return \`\${index + 1},\${checkInTime},\${firstName},\${lastName},\${email},\${phone},\${interest}\`;
      }).join('\\n');
      csvContent += '\\n\\n';
    } else {
      csvContent += 'No attendees checked in yet.\\n\\n';
    }

    csvContent += '--- TOP ATTENDEE INTEREST TAGS ---\\n';
    if (dashboardStats.interestTags && dashboardStats.interestTags.length > 0) {
      dashboardStats.interestTags.forEach((t: any, i: number) => {
        csvContent += \`\${i + 1}. #\${t.name},(\${t.count} attendees)\\n\`;
      });
    } else {
      csvContent += 'No tags submitted by attendees.\\n';
    }
    csvContent += '\\n';

    csvContent += 'Event Connect GDPR & Privacy compliant recap.\\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = \`\${dashboardStats.eventName.replace(/\\s+/g, '_')}_Recap.csv\`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Event summary downloaded!', 'success');
  };`;

appCode = appCode.replace(handleExportPattern, newHandleExport);
fs.writeFileSync('src/App.tsx', appCode);
console.log('App.tsx updated');

// --- server.ts ---
let serverCode = fs.readFileSync('server.ts', 'utf8');

const serverRoutePattern = /app\.get\('\/api\/admin\/events\/:id\/attendees\.csv'[\s\S]*?res\.send\(csvContent\);\n}\);/;

const newServerRoute = `app.get('/api/admin/events/:id/attendees.csv', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
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

  let csvContent = 'EVENT CONNECT - RECAP REPORT\\n\\n';
  csvContent += \`Event:,\${event.name}\\n\`;
  csvContent += \`Check-in Code:,\${event.checkInCode}\\n\`;
  csvContent += \`Generated At:,\${new Date().toLocaleString()}\\n\\n\`;

  csvContent += '--- LIVE STATS SUMMARY ---\\n';
  csvContent += \`Total Checked-In Attendance:,\${totalAttendance}\\n\`;
  csvContent += \`Active At This Moment:,\${activeCheckIns}\\n\`;
  csvContent += \`Connections Handshaked:,\${eventConnections}\\n\`;
  csvContent += \`Shared Live Photos Uploaded:,\${totalPhotos}\\n\`;
  csvContent += \`Flagged/Hidden Content:,\${flaggedPhotos}\\n\\n\`;

  csvContent += '--- ATTENDEES SUMMARY ---\\n';
  if (checkins.length > 0) {
    csvContent += 'Serial Number,Check-in Time,First Name,Last Name,Email,Phone Number,Interest\\n';
    csvContent += checkins.map((c, index) => {
      const u = users.find(user => user.id === c.userId);
      if (!u) return '';
      const checkInTime = new Date(c.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const parts = (u.name || '').trim().split(' ');
      const firstName = \`"\${(parts[0] || '').replace(/"/g, '""')}"\`;
      const lastName = \`"\${(parts.slice(1).join(' ') || '').replace(/"/g, '""')}"\`;
      const tags = \`"\${(JsonDb.getInterestTags().filter(t => t.userId === c.userId).map(t => t.tagText).join(', ') || 'N/A').replace(/"/g, '""')}"\`;
      
      return \`\${index + 1},\${checkInTime},\${firstName},\${lastName},"\${u.email || ''}","\${u.phone_number || 'N/A'}",\${tags}\`;
    }).filter(Boolean).join('\\n');
    csvContent += '\\n\\n';
  } else {
    csvContent += 'No attendees checked in yet.\\n\\n';
  }

  csvContent += '--- TOP ATTENDEE INTEREST TAGS ---\\n';
  if (topTags.length > 0) {
    topTags.forEach((t, i) => {
      csvContent += \`\${i + 1}. #\${t.name},(\${t.count} attendees)\\n\`;
    });
  } else {
    csvContent += 'No tags submitted by attendees.\\n';
  }
  csvContent += '\\n';

  csvContent += 'Event Connect GDPR & Privacy compliant recap.\\n';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', \`attachment; filename="event_\${event.checkInCode}_attendees.csv"\`);
  res.send(csvContent);
});`;

serverCode = serverCode.replace(serverRoutePattern, newServerRoute);
fs.writeFileSync('server.ts', serverCode);
console.log('server.ts updated');
