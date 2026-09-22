const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace(
    /\.btn-primary \{ background: var\(--primary\); color: white; box-shadow: 0 4px 12px rgba\(79,70,229,0\.3\); \}/,
    '.btn-primary { background: var(--btn-gradient, var(--primary)); color: white; box-shadow: 0 4px 12px var(--primary-light); }'
);
html = html.replace(
    /\.btn-primary:hover \{ transform: translateY\(-2px\); box-shadow: 0 6px 16px rgba\(79,70,229,0\.4\); \}/,
    '.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 16px var(--primary-light); opacity: 0.95; }'
);
fs.writeFileSync('index.html', html, 'utf8');

// Do the same for student.html
let stu = fs.readFileSync('student.html', 'utf8');
stu = stu.replace(
    /\.btn-primary \{ background: var\(--primary\); color: white; box-shadow: 0 4px 12px rgba\(79,70,229,0\.3\); \}/,
    '.btn-primary { background: var(--btn-gradient, var(--primary)); color: white; box-shadow: 0 4px 12px var(--primary-light); }'
);
stu = stu.replace(
    /\.btn-primary:hover \{ transform: translateY\(-2px\); box-shadow: 0 6px 16px rgba\(79,70,229,0\.4\); \}/,
    '.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 16px var(--primary-light); opacity: 0.95; }'
);
fs.writeFileSync('student.html', stu, 'utf8');
