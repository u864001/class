const fs = require('fs');

function update(file) {
    let content = fs.readFileSync(file, 'utf8');

    // Make top controls equal size and spacing
    content = content.replace(
        /<div style="position:relative;">\s*<button id="skinToggleBtn"[\s\S]*?<\/div>\s*<\/div>\s*<div class="lang-toggle">\s*<button id="langZh" class="active">中<\/button>\s*<button id="langEn">EN<\/button>\s*<\/div>/g,
        `<div style="display:flex; align-items:center; gap:8px;">
        <div style="position:relative; display:flex;">
            <button id="skinToggleBtn" title="切換主題" style="height:30px; width:30px; border-radius:50%; border:1px solid rgba(255,255,255,0.4); background:rgba(255,255,255,0.5); font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; transition:all 0.2s; box-shadow:0 2px 5px rgba(0,0,0,0.05);">🎨</button>
            <div id="skinDropdown" style="display:none;position:absolute;top:38px;right:0;background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border:1px solid rgba(0,0,0,0.1);border-radius:12px;padding:8px;min-width:180px;box-shadow:0 10px 30px rgba(0,0,0,0.15);z-index:9999; flex-wrap:wrap; gap:6px;"></div>
        </div>
        <div class="lang-toggle" style="display:flex; gap:4px;">
            <button id="langZh" class="active" style="height:30px; padding:0 12px; border-radius:15px; border:1px solid transparent; background:rgba(255,255,255,0.5); font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s;">中</button>
            <button id="langEn" style="height:30px; padding:0 12px; border-radius:15px; border:1px solid transparent; background:rgba(255,255,255,0.5); font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s;">EN</button>
        </div>
        </div>`
    );
    
    // Also inject styles if missing
    if (!content.includes('z-index:9999') && content.includes('id="skinDropdown"')) {
        // Just in case the regex failed
    }

    fs.writeFileSync(file, content, 'utf8');
}

update('index.html');
// update student.html as well
let stu = fs.readFileSync('student.html', 'utf8');
stu = stu.replace(
        /<span class="lang-toggle">\s*<button id="langZh" class="active">中<\/button>\s*<button id="langEn">EN<\/button>\s*<\/span>/g,
        `<span style="display:flex; align-items:center; gap:8px;">
        <span style="position:relative; display:flex;">
            <button id="skinToggleBtn" title="切換主題" style="height:30px; width:30px; border-radius:50%; border:1px solid rgba(255,255,255,0.4); background:rgba(255,255,255,0.5); font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; transition:all 0.2s; box-shadow:0 2px 5px rgba(0,0,0,0.05);">🎨</button>
            <div id="skinDropdown" style="display:none;position:absolute;top:38px;right:0;background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border:1px solid rgba(0,0,0,0.1);border-radius:12px;padding:8px;min-width:180px;box-shadow:0 10px 30px rgba(0,0,0,0.15);z-index:9999; flex-wrap:wrap; gap:6px;"></div>
        </span>
        <span class="lang-toggle" style="display:flex; gap:4px;">
            <button id="langZh" class="active" style="height:30px; padding:0 12px; border-radius:15px; border:1px solid transparent; background:rgba(255,255,255,0.5); font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s;">中</button>
            <button id="langEn" style="height:30px; padding:0 12px; border-radius:15px; border:1px solid transparent; background:rgba(255,255,255,0.5); font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s;">EN</button>
        </span>
        </span>`
    );
fs.writeFileSync('student.html', stu, 'utf8');
