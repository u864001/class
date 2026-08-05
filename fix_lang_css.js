const fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(
        /style="height:30px; padding:0 12px; border-radius:15px; border:1px solid transparent; background:rgba\(255,255,255,0\.5\); font-size:13px; font-weight:600; cursor:pointer; transition:all 0\.2s;"/g,
        'style="height:30px; padding:0 12px; border-radius:15px; border:1px solid transparent; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s;" class="lang-btn"'
    );
    fs.writeFileSync(file, content, 'utf8');
}

fix('index.html');
fix('student.html');
