/**
 * skins.js — 霧臺國小虛擬教室 主題換膚系統
 */

const SKINS = {
    default: {
        label: '預設 (靛藍) 💙',
        vars: {
            '--primary':       '#4f46e5',
            '--primary-light': 'rgba(79,70,229,0.1)',
            '--primary-dark':  '#3730a3',
            '--bg-from':       '#e0e7ff',
            '--bg-via':        '#ede9fe',
            '--bg-to':         '#fce7f3',
            '--btn-gradient':  'linear-gradient(135deg, #4f46e5, #7c3aed)',
        }
    },
    gray: {
        label: '質感 (太空灰) 🛸',
        vars: {
            '--primary':       '#4b5563',
            '--primary-light': 'rgba(75,85,99,0.1)',
            '--primary-dark':  '#374151',
            '--bg-from':       '#f3f4f6',
            '--bg-via':        '#e5e7eb',
            '--bg-to':         '#d1d5db',
            '--btn-gradient':  'linear-gradient(135deg, #4b5563, #374151)',
        }
    },
    purple: {
        label: '夢幻 (紫色) 🔮',
        vars: {
            '--primary':       '#9333ea',
            '--primary-light': 'rgba(147,51,234,0.1)',
            '--primary-dark':  '#7e22ce',
            '--bg-from':       '#faf5ff',
            '--bg-via':        '#f3e8ff',
            '--bg-to':         '#e9d5ff',
            '--btn-gradient':  'linear-gradient(135deg, #9333ea, #a855f7)',
        }
    },
    green: {
        label: '清新 (綠色) 🌿',
        vars: {
            '--primary':       '#16a34a',
            '--primary-light': 'rgba(22,163,74,0.1)',
            '--primary-dark':  '#15803d',
            '--bg-from':       '#f0fdf4',
            '--bg-via':        '#dcfce7',
            '--bg-to':         '#bbf7d0',
            '--btn-gradient':  'linear-gradient(135deg, #16a34a, #22c55e)',
        }
    },
    pink: {
        label: '柔和 (粉紅) 🌸',
        vars: {
            '--primary':       '#db2777',
            '--primary-light': 'rgba(219,39,119,0.1)',
            '--primary-dark':  '#be185d',
            '--bg-from':       '#fdf2f8',
            '--bg-via':        '#fce7f3',
            '--bg-to':         '#fbcfe8',
            '--btn-gradient':  'linear-gradient(135deg, #db2777, #ec4899)',
        }
    },
    
    // 未來擴充：節慶主題範例
    halloween: {
        label: '萬聖節 (預留) 🎃',
        vars: {
            '--primary':       '#ea580c',
            '--primary-light': 'rgba(234,88,12,0.1)',
            '--primary-dark':  '#c2410c',
            '--bg-from':       '#fff7ed',
            '--bg-via':        '#ffedd5',
            '--bg-to':         '#fed7aa',
            '--btn-gradient':  'linear-gradient(135deg, #ea580c, #f97316)',
        },
        overlay: function() {
            // 可在此加入南瓜、蝙蝠特效動畫
        }
    }
};

let currentOverlay = null;

export function applySkin(skinId) {
    const skin = SKINS[skinId] || SKINS.default;
    
    // Apply CSS vars
    for (const [k, v] of Object.entries(skin.vars)) {
        document.documentElement.style.setProperty(k, v);
    }
    
    // Clear old overlay
    if (currentOverlay) {
        document.body.removeChild(currentOverlay);
        currentOverlay = null;
    }
    
    // Add new overlay if exists
    if (typeof skin.overlay === "function") {
        currentOverlay = skin.overlay();
        if (currentOverlay) document.body.appendChild(currentOverlay);
    }
    
    // Save to localStorage
    try {
        localStorage.setItem('classqna_skin', skinId);
    } catch(e) {}
}

export function getSkinList() {
    return Object.keys(SKINS).map(id => ({
        id,
        label: SKINS[id].label,
        primary: SKINS[id].vars['--primary']
    }));
}

export function initSkin() {
    let saved = 'default';
    try { saved = localStorage.getItem('classqna_skin') || 'default'; } catch(e) {}
    applySkin(saved);
}

export function applyAutoSkin() {
    initSkin(); // We just use the saved skin for now
}
