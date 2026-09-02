const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// The sed command earlier replaced bg-white with bg-white dark:bg-[#202c33], 
// but let's make sure it's consistent.
// First, undo if there's any duplication:
code = code.replace(/bg-white dark:bg-\[\#202c33\]/g, 'bg-white');
// Now apply it cleanly
code = code.replace(/\bbg-white\b/g, 'bg-white dark:bg-[#202c33]');

// Do the same for bg-slate-50
code = code.replace(/bg-slate-50 dark:bg-\[\#111b21\]/g, 'bg-slate-50');
code = code.replace(/\bbg-slate-50\b/g, 'bg-slate-50 dark:bg-[#111b21]');

// And text colors
code = code.replace(/text-slate-800 dark:text-\[\#e9edef\]/g, 'text-slate-800');
code = code.replace(/\btext-slate-800\b/g, 'text-slate-800 dark:text-[#e9edef]');

code = code.replace(/text-slate-900 dark:text-\[\#e9edef\]/g, 'text-slate-900');
code = code.replace(/\btext-slate-900\b/g, 'text-slate-900 dark:text-[#e9edef]');

code = code.replace(/text-slate-500 dark:text-\[\#8696a0\]/g, 'text-slate-500');
code = code.replace(/\btext-slate-500\b/g, 'text-slate-500 dark:text-[#8696a0]');

// Borders
code = code.replace(/border-slate-100 dark:border-\[\#2a3942\]/g, 'border-slate-100');
code = code.replace(/\bborder-slate-100\b/g, 'border-slate-100 dark:border-[#2a3942]');

code = code.replace(/border-slate-200 dark:border-\[\#2a3942\]/g, 'border-slate-200');
code = code.replace(/\bborder-slate-200\b/g, 'border-slate-200 dark:border-[#2a3942]');

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx updated');
