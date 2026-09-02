const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');
css = css.replace(/\.dark \.bg-white \{\n  background-color: #202c33 !important;\n  border-color: #2a3942 !important;\n  color: #e9edef !important;\n\}/g, '.dark .bg-white {\n  background-color: #202c33 !important;\n  border-color: #2a3942 !important;\n}');
fs.writeFileSync('src/index.css', css);
