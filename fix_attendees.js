import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

const oldAttendeesCode = `const attendeesData = checkins.map(c => {
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
  }).filter(Boolean);`;

const newAttendeesDataCode = `const attendeesData = checkins.map(c => {
    if (c.historicalName) {
      const parts = c.historicalName.trim().split(' ');
      return {
        checkInTime: new Date(c.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || '',
        email: c.historicalEmail || 'N/A',
        phone: c.historicalPhone || 'N/A',
        interest: c.historicalTags || 'N/A'
      };
    }
    
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
  }).filter(Boolean);`;

code = code.replace(oldAttendeesCode, newAttendeesDataCode);
fs.writeFileSync('server.ts', code);
console.log('server.ts attendeesData updated');
