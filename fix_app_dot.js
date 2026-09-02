import fs from 'fs';

let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetDot = /\{item\.name\.slice\(0, 2\)\.toUpperCase\(\)\}\n\s*<span className="absolute bottom-0 right-0 w-3 h-3 bg-\[#25D366\] rounded-full border-2 border-white"><\/span>/g;
const newDot = `{item.name.slice(0, 2).toUpperCase()}
                                <span className={\`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white \${item.stillPresent ? 'bg-[#25D366]' : 'bg-slate-400'}\`}></span>`;

code = code.replace(targetDot, newDot);

fs.writeFileSync('src/App.tsx', code);
console.log('src/App.tsx updated');
