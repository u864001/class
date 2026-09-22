const fs = require('fs');

function append(file) {
    let content = fs.readFileSync(file, 'utf8');
    const css = `
<style>
.lang-btn { background: rgba(255,255,255,0.5); color: var(--text-primary); }
.lang-btn.active { background: var(--btn-gradient, var(--primary)) !important; color: white !important; border-color: transparent !important; }
</style>
</head>`;
    content = content.replace('</head>', css);
    fs.writeFileSync(file, content, 'utf8');
}

append('index.html');
append('student.html');
