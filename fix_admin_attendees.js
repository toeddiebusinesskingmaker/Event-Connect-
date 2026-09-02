import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

const adminAttendeesPattern = /csvContent \+= checkins\.map\(\(c, index\) => \{[\s\S]*?\}\)\.filter\(Boolean\)\.join\('\\n'\);/;

const newAdminAttendeesCode = `csvContent += checkins.map((c, index) => {
      const checkInTime = new Date(c.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      if (c.historicalName) {
        const parts = c.historicalName.trim().split(' ');
        const firstName = \`"\${(parts[0] || '').replace(/"/g, '""')}"\`;
        const lastName = \`"\${(parts.slice(1).join(' ') || '').replace(/"/g, '""')}"\`;
        const email = \`"\${(c.historicalEmail || '').replace(/"/g, '""')}"\`;
        const phone = \`"\${(c.historicalPhone || '').replace(/"/g, '""')}"\`;
        const tags = \`"\${(c.historicalTags || 'N/A').replace(/"/g, '""')}"\`;
        return \`\${index + 1},\${checkInTime},\${firstName},\${lastName},\${email},\${phone},\${tags}\`;
      }
      
      const u = users.find(user => user.id === c.userId);
      if (!u) {
        const tags = \`"\${(JsonDb.getInterestTags().filter(t => t.userId === c.userId).map(t => t.tagText).join(', ') || 'N/A').replace(/"/g, '""')}"\`;
        return \`\${index + 1},\${checkInTime},"Deleted","User","deleted@eventconnect.local","N/A",\${tags}\`;
      }
      
      const parts = (u.name || '').trim().split(' ');
      const firstName = \`"\${(parts[0] || '').replace(/"/g, '""')}"\`;
      const lastName = \`"\${(parts.slice(1).join(' ') || '').replace(/"/g, '""')}"\`;
      const tags = \`"\${(JsonDb.getInterestTags().filter(t => t.userId === c.userId).map(t => t.tagText).join(', ') || 'N/A').replace(/"/g, '""')}"\`;
      
      return \`\${index + 1},\${checkInTime},\${firstName},\${lastName},"\${u.email || ''}","\${u.phone_number || 'N/A'}",\${tags}\`;
    }).filter(Boolean).join('\\n');`;

code = code.replace(adminAttendeesPattern, newAdminAttendeesCode);
fs.writeFileSync('server.ts', code);
console.log('server.ts admin attendees updated');
