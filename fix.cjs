const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');
css = css.replace(/color: #e9edef !important;/g, '');
css = css.replace(/color: #8696a0 !important;/g, '');
fs.writeFileSync('src/index.css', css);
