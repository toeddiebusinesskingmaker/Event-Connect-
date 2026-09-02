import fs from 'fs';

let code = fs.readFileSync('src/db/jsonDb.ts', 'utf8');

const importRegex = /AuditLog\n\} from '\.\.\/types\.ts';/;
const newImport = `AuditLog,
  BroadcastMessage
} from '../types.ts';`;

if (!code.includes('BroadcastMessage')) {
  code = code.replace(importRegex, newImport);

  const schemaRegex = /interestTags: InterestTag\[\];\n  auditLogs: AuditLog\[\];\n\}/;
  const newSchema = `interestTags: InterestTag[];
  auditLogs: AuditLog[];
  broadcastMessages: BroadcastMessage[];
}`;
  code = code.replace(schemaRegex, newSchema);

  const initRegex = /interestTags: \[\]\,\n      auditLogs: \[\]\n    \};/;
  const newInit = `interestTags: [],
      auditLogs: [],
      broadcastMessages: []
    };`;
  code = code.replace(initRegex, newInit);

  // also default load structure fallback
  const defaultRegex = /db\.auditLogs = db\.auditLogs \|\| \[\];/;
  const newDefault = `db.auditLogs = db.auditLogs || [];
    db.broadcastMessages = db.broadcastMessages || [];`;
  code = code.replace(defaultRegex, newDefault);

  const insertRegex = /public static insertReport\(report: Report\): void \{/;
  const insertBroadcast = `public static getBroadcastMessages(): BroadcastMessage[] {
    return this.load().broadcastMessages || [];
  }
  public static insertBroadcastMessage(msg: BroadcastMessage): void {
    const db = this.load();
    db.broadcastMessages.push(msg);
    this.save(db);
  }
  
  public static insertReport(report: Report): void {`;
  code = code.replace(insertRegex, insertBroadcast);

  fs.writeFileSync('src/db/jsonDb.ts', code);
  console.log('src/db/jsonDb.ts updated');
} else {
  console.log('BroadcastMessage already in jsonDb.ts');
}
