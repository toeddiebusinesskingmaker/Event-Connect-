import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

// Remove c.stillPresent && from filter
const targetFilter = /\.filter\(c => c\.eventId === eventId && c\.stillPresent && c\.userId !== userId && !excludedUserIds\.has\(c\.userId\)\)/;
const newFilter = `.filter(c => c.eventId === eventId && c.userId !== userId && !excludedUserIds.has(c.userId))`;

code = code.replace(targetFilter, newFilter);

// Add stillPresent to the mapping
const targetMap = /socialLinks: isConnected \? userObj\.socialLinks : undefined,\n\s*visibility: c\.visibility,/;
const newMap = `socialLinks: isConnected ? userObj.socialLinks : undefined,
        visibility: c.visibility,
        stillPresent: c.stillPresent,`;

code = code.replace(targetMap, newMap);

fs.writeFileSync('server.ts', code);
console.log('server.ts updated');
