import fs from 'fs';

let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetBadge = /\{item\.visibility === 'private' && \(\n\s*<span className="bg-slate-100 text-slate-500 font-medium px-2 py-0\.5 rounded-full text-\[8px\] shrink-0">Private<\/span>\n\s*\)\}/;
const newBadge = `{item.visibility === 'private' && (
                                    <span className="bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full text-[8px] shrink-0">Private</span>
                                  )}
                                  {!item.stillPresent && (
                                    <span className="bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full text-[8px] shrink-0">Offline</span>
                                  )}`;

code = code.replace(targetBadge, newBadge);

fs.writeFileSync('src/App.tsx', code);
console.log('src/App.tsx updated badge');
