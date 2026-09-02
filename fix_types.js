import fs from 'fs';

let code = fs.readFileSync('src/types.ts', 'utf8');

if (!code.includes('BroadcastMessage')) {
  code += `\nexport interface BroadcastMessage {
  id: string;
  eventId: string;
  senderId: string;
  message: string;
  sentAt: string;
}\n`;
  fs.writeFileSync('src/types.ts', code);
  console.log('src/types.ts updated');
} else {
  console.log('BroadcastMessage already in types.ts');
}
