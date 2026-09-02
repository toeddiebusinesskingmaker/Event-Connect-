const fs = require('fs');
// Very simple 1x1 base64 transparent PNG, we can use a library or just raw base64.
// Let's just write the SVG twice and claim it's a PNG? No, Chrome will check the magic bytes.
