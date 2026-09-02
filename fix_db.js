import fs from 'fs';

let code = fs.readFileSync('src/db/jsonDb.ts', 'utf8');
code = code.replace(
  /\/\/ 3\. Delete check-ins\n    db\.eventCheckIns = db\.eventCheckIns\.filter\(c => c\.userId !== userId\);\n\n    \/\/ 4\. Delete interest tags\n    db\.interestTags = db\.interestTags\.filter\(t => t\.userId !== userId\);/,
  `// 3. Keep check-ins to preserve historical attendee records for events\n    // db.eventCheckIns = db.eventCheckIns.filter(c => c.userId !== userId);\n\n    // 4. Keep interest tags to preserve historical event tags\n    // db.interestTags = db.interestTags.filter(t => t.userId !== userId);`
);
fs.writeFileSync('src/db/jsonDb.ts', code);
console.log('src/db/jsonDb.ts updated');
