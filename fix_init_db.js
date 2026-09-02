import fs from 'fs';

let code = fs.readFileSync('src/db/jsonDb.ts', 'utf8');
const target = /auditLogs: \[\]\n    \};/;
code = code.replace(target, `auditLogs: [],
      broadcastMessages: []
    };`);
fs.writeFileSync('src/db/jsonDb.ts', code);
console.log("fixed init db");
