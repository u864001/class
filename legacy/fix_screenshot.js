const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Fix questionImagePreview style
html = html.replace(
    '#questionImagePreview { display: none; max-width: 100%; }',
    '#questionImagePreview { display: none; max-width: 100%; max-height: 200px; object-fit: contain; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); margin-top: 8px; }'
);

// 2. Add 'redraw' behavior to cancelCropBtn, and add a close button
html = html.replace(
    /<button type="button" class="btn btn-ghost" id="cancelCropBtn"[^>]*>[\s\S]*?<\/button>/,
    `<button type="button" class="btn btn-ghost" id="redrawCropBtn" style="color:#fff;background:rgba(255,255,255,0.15);">
        <span class="material-symbols-outlined">refresh</span> 重新框選
    </button>
    <button type="button" class="btn btn-ghost" id="cancelCropBtn" style="color:#ff6b6b;background:rgba(255,0,0,0.15);margin-left:8px;">
        <span class="material-symbols-outlined">close</span> 關閉
    </button>`
);

// 3. Update the JS logic for the new redraw button
html = html.replace(
    /document\.getElementById\('cancelCropBtn'\)\.onclick = cleanup;/,
    `document.getElementById('cancelCropBtn').onclick = cleanup;
    document.getElementById('redrawCropBtn').onclick = () => {
        startX = 0; startY = 0; curX = 0; curY = 0; dragging = false;
        redraw(); // This will just draw the full canvas without the strokeRect because startX==curX
    };`
);

fs.writeFileSync('index.html', html, 'utf8');
