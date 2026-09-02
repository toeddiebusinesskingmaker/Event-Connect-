const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(/ dark:[^ "'`]*/g, '');
fs.writeFileSync('src/App.tsx', code);
