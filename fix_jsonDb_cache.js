import fs from 'fs';

let code = fs.readFileSync('src/db/jsonDb.ts', 'utf8');

const importTarget = /const DB_FILE = path.join\(process.cwd\(\), 'db.json'\);/;
const newImport = `const DB_FILE = path.join(process.cwd(), 'db.json');
let memoryCache: DatabaseSchema | null = null;
let saveTimeout: NodeJS.Timeout | null = null;
let pendingSave = false;`;

code = code.replace(importTarget, newImport);

const loadTarget = /private static load\(\): DatabaseSchema \{\n    try \{/;
const newLoad = `private static load(): DatabaseSchema {
    if (memoryCache) return memoryCache;
    try {`;

code = code.replace(loadTarget, newLoad);

// Make sure that whenever we load from disk initially, we store to memoryCache
const dirtyTarget = /if \(dirty\) \{\n        this.save\(data\);\n      \}\n      return data;/;
const newDirtyTarget = `if (dirty) {
        this.save(data);
      }
      memoryCache = data;
      return data;`;
code = code.replace(dirtyTarget, newDirtyTarget);

const returnTarget = /return INITIAL_DB;\n      \}\n      const raw = fs.readFileSync\(DB_FILE, 'utf-8'\);/;
const newReturnTarget = `memoryCache = INITIAL_DB;
        return INITIAL_DB;
      }
      const raw = fs.readFileSync(DB_FILE, 'utf-8');`;
code = code.replace(returnTarget, newReturnTarget);

const errorReturn = /console\.error\('Error loading JSON database, using initial fallback', e\);\n      return INITIAL_DB;/;
const newErrorReturn = `console.error('Error loading JSON database, using initial fallback', e);
      memoryCache = INITIAL_DB;
      return INITIAL_DB;`;
code = code.replace(errorReturn, newErrorReturn);

// Rewrite save()
const saveTarget = /private static save\(data: DatabaseSchema\): void \{[\s\S]*?\} catch \(e\) \{\n      console\.error\('Error saving JSON database', e\);\n    \}\n  \}/;
const newSave = `private static save(data: DatabaseSchema): void {
    memoryCache = data;
    
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(() => {
      try {
        const jsonStr = JSON.stringify(memoryCache, null, 2);
        fs.writeFileSync(DB_FILE, jsonStr, 'utf-8');
        
        // Async save to firestore using REST API
        if (this.restSyncUrl) {
          fetch(this.restSyncUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                dbState: { stringValue: jsonStr }
              }
            })
          }).catch(e => console.error('Failed to sync to Firestore:', e));
        }
      } catch (e) {
        console.error('Error saving JSON database', e);
      }
    }, 2000); // Batch saves every 2 seconds
  }`;

code = code.replace(saveTarget, newSave);

// Also need to initialize cache on restore
const restoreTarget = /fs\.writeFileSync\(DB_FILE, data, 'utf-8'\);\n             console\.log\('Restored Database from Firestore!'\);/;
const newRestore = `fs.writeFileSync(DB_FILE, data, 'utf-8');
             memoryCache = JSON.parse(data);
             console.log('Restored Database from Firestore!');`;
code = code.replace(restoreTarget, newRestore);

fs.writeFileSync('src/db/jsonDb.ts', code);
console.log("Memory caching implemented in jsonDb.ts");
