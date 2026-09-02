import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');
const checkinPattern = /const checkIn: EventCheckIn = \{\n\s*id: 'ci-' \+ Math\.random\(\)\.toString\(36\)\.substring\(2, 15\),\n\s*eventId: event\.id,\n\s*userId: req\.userId!,\n\s*checkedInAt: new Date\(\)\.toISOString\(\),\n\s*visibility: \(visibility === 'private'\) \? 'private' : 'public',\n\s*stillPresent: true\n\s*\};/;

const newCheckinCode = `const user = JsonDb.getUsers().find(u => u.id === req.userId!);
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
  };`;

code = code.replace(checkinPattern, newCheckinCode);
fs.writeFileSync('server.ts', code);
console.log('server.ts checkin updated');
