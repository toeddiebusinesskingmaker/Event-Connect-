import fs from 'fs';

let serverCode = fs.readFileSync('server.ts', 'utf8');

// Fix dashboard attendeesData
const dashboardPattern = /if \(user\) \{\n\s*const parts = user\.name\.trim\(\)\.split\(' '\);\n\s*const firstName = parts\[0\] \|\| '';\n\s*const lastName = parts\.slice\(1\)\.join\(' '\) \|\| '';\n\s*return \{\n\s*checkInTime: new Date\(c\.checkedInAt\)\.toLocaleTimeString\(\[\], \{ hour: '2-digit', minute: '2-digit' \}\),\n\s*firstName,\n\s*lastName,\n\s*email: user\.email,\n\s*phone: user\.phone_number \|\| 'N\/A',\n\s*interest: userTags \|\| 'N\/A'\n\s*\};\n\s*\}\n\s*return null;/;

const newDashboardPattern = `    if (user) {
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
    }`;

serverCode = serverCode.replace(dashboardPattern, newDashboardPattern);

// Fix admin attendees.csv
const adminPattern = /const u = users\.find\(user => user\.id === c\.userId\);\n\s*if \(!u\) return '';/;

const newAdminPattern = `const u = users.find(user => user.id === c.userId);
      if (!u) {
        const checkInTime = new Date(c.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const tags = \`"\${(JsonDb.getInterestTags().filter(t => t.userId === c.userId).map(t => t.tagText).join(', ') || 'N/A').replace(/"/g, '""')}"\`;
        return \`\${index + 1},\${checkInTime},"Deleted","User","deleted@eventconnect.local","N/A",\${tags}\`;
      }`;

serverCode = serverCode.replace(adminPattern, newAdminPattern);

fs.writeFileSync('server.ts', serverCode);
console.log('server.ts missing user fallback updated');
