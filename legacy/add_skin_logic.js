const fs = require('fs');

function addLogic(file) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Check if logic already exists
    if (content.includes('setupSkinMenu')) return;
    
    const logic = `
// ====== Skin Menu Logic ======
function setupSkinMenu() {
    import('./skins.js').then(skinsModule => {
        const { getSkinList, applySkin, initSkin } = skinsModule;
        initSkin();
        
        const btn = document.getElementById('skinToggleBtn');
        const dropdown = document.getElementById('skinDropdown');
        if (!btn || !dropdown) return;
        
        const list = getSkinList();
        dropdown.innerHTML = list.map(skin => 
            \`<button class="skin-option" data-id="\${skin.id}" style="padding:4px 8px; border:none; background:transparent; cursor:pointer; font-size:13px; font-weight:600; text-align:left; border-radius:6px; display:flex; align-items:center; gap:6px; width:48%;">
                <div style="width:12px; height:12px; border-radius:50%; background:\${skin.primary};"></div> \${skin.label}
            </button>\`
        ).join('');
        
        dropdown.querySelectorAll('.skin-option').forEach(opt => {
            opt.onclick = () => {
                applySkin(opt.dataset.id);
                dropdown.style.display = 'none';
            };
            opt.onmouseover = () => opt.style.background = 'rgba(0,0,0,0.05)';
            opt.onmouseout = () => opt.style.background = 'transparent';
        });
        
        btn.onclick = (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
        };
        
        document.addEventListener('click', (e) => {
            if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    });
}
window.addEventListener('DOMContentLoaded', setupSkinMenu);
`;

    // inject before </body>
    content = content.replace('</body>', logic + '\n</body>');
    fs.writeFileSync(file, content, 'utf8');
}

addLogic('index.html');
addLogic('student.html');
