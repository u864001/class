const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace('    });\n});\n});', '    });\n});');

fs.writeFileSync('index.html', html, 'utf8');
