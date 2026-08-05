const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Replace tabs with radio buttons
html = html.replace(
    /<div class="q-type-tabs">[\s\S]*?<\/div>\s*<select id="questionTypeSelect" class="hidden">[\s\S]*?<\/select>/,
    `<div class="q-type-tabs" style="display:flex; gap:16px; margin-bottom:12px; align-items:center;">
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:14px; font-weight:600;">
            <input type="radio" name="questionType" value="choice" checked style="width:16px; height:16px; accent-color:var(--primary);" /> 選擇題 ABCD
        </label>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:14px; font-weight:600;">
            <input type="radio" name="questionType" value="text" style="width:16px; height:16px; accent-color:var(--primary);" /> 文字作答
        </label>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:14px; font-weight:600;">
            <input type="radio" name="questionType" value="image" style="width:16px; height:16px; accent-color:var(--primary);" /> 圖片/畫圖
        </label>
    </div>
    <select id="questionTypeSelect" class="hidden">
        <option value="choice">選擇題</option>
        <option value="text">文字題</option>
        <option value="image">圖片題</option>
    </select>`
);

// Update the JS that handles tab clicks
html = html.replace(
    /\/\/ 題型 Tab 切換[\s\S]*?}\);/g,
    `// 題型 Radio 切換
document.querySelectorAll('input[name="questionType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const type = e.target.value;
        document.getElementById('questionTypeSelect').value = type;
        // Optionally update any UI based on type if needed
    });
});`
);

fs.writeFileSync('index.html', html, 'utf8');
