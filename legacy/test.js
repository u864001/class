window.asyncPrompt = function(msg) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);";
        const box = document.createElement('div');
        box.style.cssText = "background:#fff;padding:24px;border-radius:12px;min-width:320px;max-width:400px;box-shadow:0 10px 25px rgba(0,0,0,0.2);font-family:sans-serif;";
        box.innerHTML = `<p style="margin-bottom:12px;color:#333;">${msg}</p>
            <input id="_promptIn" type="password" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:15px;margin-bottom:16px;" />
            <div style="display:flex;gap:8px;">
              <button id="_promptOk" style="flex:1;padding:10px;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;">確定</button>
              <button id="_promptCx" style="flex:1;padding:10px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;cursor:pointer;">取消</button>
            </div>`;
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        const inp = box.querySelector('#_promptIn');
        inp.focus();
        box.querySelector('#_promptOk').onclick = () => { document.body.removeChild(overlay); resolve(inp.value); };
        box.querySelector('#_promptCx').onclick = () => { document.body.removeChild(overlay); resolve(null); };
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') box.querySelector('#_promptOk').click(); });
    });
};
window.asyncConfirm = function(msg) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);";
        const box = document.createElement('div');
        box.style.cssText = "background:#fff;padding:24px;border-radius:12px;min-width:300px;max-width:400px;text-align:center;box-shadow:0 10px 25px rgba(0,0,0,0.2);font-family:sans-serif;";
        box.innerHTML = `<p style="margin-bottom:20px;color:#333;white-space:pre-wrap;line-height:1.5;">${msg}</p>
            <div style="display:flex;gap:10px;">
              <button id="_cfmOk" style="flex:1;padding:10px;background:#ef4444;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:15px;">確定</button>
              <button id="_cfmCx" style="flex:1;padding:10px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;cursor:pointer;font-size:15px;">取消</button>
            </div>`;
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        box.querySelector('#_cfmOk').onclick = () => { document.body.removeChild(overlay); resolve(true); };
        box.querySelector('#_cfmCx').onclick = () => { document.body.removeChild(overlay); resolve(false); };
    });
};
window.alert = function(msg) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);";
        const box = document.createElement('div');
        box.style.cssText = "background:#fff;padding:24px;border-radius:12px;min-width:300px;max-width:400px;text-align:center;box-shadow:0 10px 25px rgba(0,0,0,0.2);font-family:sans-serif;";
        box.innerHTML = `<p style="margin-bottom:20px;color:#333;white-space:pre-wrap;line-height:1.5;">${msg}</p>
            <button style="width:100%;padding:10px;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:15px;">確定</button>`;
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        box.querySelector('button').onclick = () => { document.body.removeChild(overlay); resolve(); };
    });
};
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc,
    collection, query, where, onSnapshot, getDocs,
    writeBatch, serverTimestamp, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { zh } from './locales/zh.js';
import { en } from './locales/en.js';
import { applyAutoSkin, applySkin, getSkinList } from './skins.js';

// ── Firebase ──
const firebaseConfig = {
    apiKey: "AIzaSyAVllhBuONIqLlPlvCgnozPEE2834HFTxA",
    authDomain: "classqna-7898b.firebaseapp.com",
    projectId: "classqna-7898b",
    storageBucket: "classqna-7898b.firebasestorage.app",
    messagingSenderId: "145272240036",
    appId: "1:145272240036:web:3a286ec303c476066df331"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── i18n ──
let LANG = 'zh';
function t(key) { return (LANG === 'zh' ? zh : en)[key] || key; }
function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const k = el.dataset.i18n;
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = t(k);
        else el.textContent = t(k);
    });
    document.querySelector('.brand').textContent = LANG === 'zh' ? '霧臺國小' : 'Wutai Elementary';
    document.getElementById('langZh').className = LANG === 'zh' ? 'active' : '';
    document.getElementById('langEn').className = LANG === 'en' ? 'active' : '';
    const n = STATE.currentQuestion || 0;
    publishBtn.innerHTML = `<span class="material-symbols-outlined">send</span> ${t('publish').replace('{n}', n + 1)}`;
    // 更新各頁面靜態文字
    const i18nMap = {
        'createRoomLabel':   t('createRoom')       || '建立教室',
        'page3Subtitle':     t('viewAnswers')       || '查看作答',
        'page4Subtitle':     t('grading')           || '批改/得分',
        'broadcastBtn2':     `<span class="material-symbols-outlined" style="font-size:16px;">campaign</span> ${t('broadcast') || '廣播'}`,
    };
    for (const [id, val] of Object.entries(i18nMap)) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = val;
    }
    // 更新 dock 工具列標籤
    const dockLabels = {
        'dockQR': ['qr_code','QR'], 'dockBroadcast': ['campaign', t('broadcast')||'廣播'],
        'dockLockScreen': ['lock', t('lockScreen')||'鎖屏'], 'dockTimer': ['timer', t('timer')||'計時'],
        'dockDice': ['casino', t('dice')||'骰子'], 'dockPicker': ['person_add', t('picker')||'點名'],
        'dockVote': ['how_to_vote', t('vote')||'投票'], 'dockGroup': ['group', t('group')||'分組'],
        'dockBuzz': ['bolt', t('buzz')||'搶答'],
    };
    for (const [id, [icon, label]] of Object.entries(dockLabels)) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<span class="material-symbols-outlined">${icon}</span><span class="label">${label}</span>`;
    }
    updateRankList();
}
document.getElementById('langZh').addEventListener('click', () => { LANG = 'zh'; applyI18n(); });
document.getElementById('langEn').addEventListener('click', () => { LANG = 'en'; applyI18n(); });

// ── 狀態 ──
const STATE = {
    roomId: null, teacherName: '陳老師',
    selectedClasses: [], customClassEnabled: false, customStudentCount: 20,
    currentQuestion: 0, currentRoundId: null,
    questionScore: 1, questionType: 'choice',
    isAnswering: false, isStopped: false, isPublished: false, isRevealed: false,
    flowState: 'idle',
    timerInterval: null, currentTimerVal: 0,
    history: [], currentAnswers: {}, correctAnswer: null,
    rosterData: {}, allStudents: [], specifiedStudents: [],
    cumulativeScores: {}, roundAwarded: {},
    currentPage: 1,
    sortByTime: false,
    pickerExcluded: [],
    voteActive: false, voteOptions: [], voteResults: {},
    groups: [], groupScores: {}, groupFloatVisible: false,
    buzzActive: false, buzzCountdown: 5, buzzUnsubscribe: null,
};

// ── DOM ──
const $ = s => document.querySelector(s);
// pagesTrack 已移除（改用 class 切換）
const stepDots          = document.querySelectorAll('.step-dot');
const stepText          = $('#stepText');
const roomCodeDisplay   = $('#roomCodeDisplay');
const roomIdDisplay     = $('#roomIdDisplay');
const onlineCountEl     = $('#onlineCount');
const currentQDisplay   = $('#currentQuestionDisplay');
const teacherNameInput  = $('#teacherNameInput');
const classCheckboxContainer = $('#classCheckboxContainer');
const customClassCheckbox    = $('#customClassCheckbox');
const customStudentCount     = $('#customStudentCount');
const btnCreateRoom     = $('#btnCreateRoom');
const questionNoteInput = $('#questionNoteInput');
const questionTypeSelect= $('#questionTypeSelect');
const imageUploadArea   = $('#imageUploadArea');
const imageUploadZone   = $('#imageUploadZone');
const questionImageInput= $('#questionImageInput');
const questionImagePreview = $('#questionImagePreview');
const questionImageFileName = $('#questionImageFileName');
const questionScoreInput= $('#questionScoreInput');
const customSeconds     = $('#customSeconds');
const publishBtn        = $('#publishBtn');
const publishStatus     = $('#publishStatus');
const timerLargeContainer = $('#timerLargeContainer');
const timerLargeDisplay = $('#timerLargeDisplay');
const timerLabel        = $('#timerLabel');
const startStopBtn      = $('#startStopBtn');
const extendTimeBtn     = $('#extendTimeBtn');
const sortByTimeCheck   = $('#sortByTimeCheck');
const onlineStudentsGrid= $('#onlineStudentsGrid');
const onlineCountBadge  = $('#onlineCountBadge');
const gotoPage3Btn      = $('#gotoPage3Btn');
const gotoPage4Btn      = $('#gotoPage4Btn');
const gotoPage5Btn      = $('#gotoPage5Btn');
const resultCards       = $('#resultCards');
const viewTextAnswersBtn= $('#viewTextAnswersBtn');
const startStopBtn2     = $('#startStopBtn2');
const extendTimeBtn2    = $('#extendTimeBtn2');
const timerLargeDisplay2= $('#timerLargeDisplay2');
const page3TimerPanel   = $('#page3TimerPanel');
const qrStudentList     = $('#qrStudentList');
const qrOnlineCount     = $('#qrOnlineCount');
const choiceRevealArea  = $('#choiceRevealArea');
const choiceResultCards = $('#choiceResultCards');
const hideAnswerBtn     = $('#hideAnswerBtn');
const textGradingArea   = $('#textGradingArea');
const textGradingList   = $('#textGradingList');
const page3Subtitle     = $('#page3Subtitle');
const page4Subtitle     = $('#page4Subtitle');
const clearNextBtn      = $('#clearNextBtn');
const rankList          = $('#rankList');
const rankSortBtn       = $('#rankSortBtn');
const exportExcelBtn    = $('#exportExcelBtn');
const clearAllBtn       = $('#clearAllBtn');
const backToPage2Btn    = $('#backToPage2Btn');
const floatingDock      = $('#floatingDock');
const dockToggle        = $('#dockToggle');
const toolModal         = $('#toolModal');
const toolModalContent  = $('#toolModalContent');
const qrModal           = $('#qrModal');
const qrModalRoomCode   = $('#qrModalRoomCode');
const qrcodeDisplay     = $('#qrcodeDisplay');
const qrTestLink        = $('#qrTestLink');
const qrModalClose      = $('#qrModalClose');
const broadcastModal    = $('#broadcastModal');
const broadcastInput    = $('#broadcastInput');
const broadcastCancel   = $('#broadcastCancel');
const broadcastSend     = $('#broadcastSend');
const broadcastBtn2     = $('#broadcastBtn2');
const groupFloat        = $('#groupFloat');

// ═══════════════════════════════════════════════
// 頁面導航
// ═══════════════════════════════════════════════
function goToPage(n) {
    if (n < 1 || n > 5) return;
    STATE.currentPage = n;
    // 顯示/隱藏頁面（用 class 切換，避免 translateX% 跟 max-width 衝突）
    document.querySelectorAll('.page').forEach((p, i) => {
        p.classList.toggle('active', i + 1 === n);
    });
    // 更新進度點
    stepDots.forEach((d, i) => {
        d.className = 'step-dot';
        if (i + 1 === n) d.classList.add('active');
        else if (i + 1 < n) d.classList.add('done');
    });
    stepText.textContent = t(`step${n}`) || `${n}/5`;
    // 教室代碼顯示
    if (STATE.roomId && n >= 2) {
        roomCodeDisplay.classList.remove('hidden');
        roomIdDisplay.textContent = STATE.roomId;
    } else {
        roomCodeDisplay.classList.add('hidden');
    }
    updateNavButtons();
    updateFlowButtons();
    if (n === 3) window.scrollTo({top:0,behavior:'smooth'});
    // 進入第二頁時重繪登入格子（可能還沒有 studentsUnsub 觸發）
    if (n === 2 && STATE.roomId) renderOnlineStudents([]);
}
function updateNavButtons() {
    gotoPage3Btn.disabled = STATE.currentPage !== 2 || !STATE.isPublished;
    gotoPage4Btn.disabled = STATE.currentPage !== 3 || !STATE.isStopped;
    gotoPage5Btn.disabled = STATE.currentPage !== 4;
}
function updateFlowButtons() {
    const f = STATE.flowState;
    publishBtn.disabled = !(f === 'idle' || f === 'stopped');
    const p3Panel  = document.getElementById('page3TimerPanel');
    const timer3   = document.getElementById('timerLargeDisplay2');
    const start3   = document.getElementById('startStopBtn2');
    const extend3  = document.getElementById('extendTimeBtn2');

    const showPanel = (f === 'published' || f === 'answering' || f === 'stopped');
    if (p3Panel) p3Panel.style.display = showPanel ? 'block' : 'none';

    const btnConfig = {
        idle:      { label: t('startAnswering'), cls: 'btn btn-primary btn-lg', disabled: false },
        published: { label: t('startAnswering'), cls: 'btn btn-primary btn-lg', disabled: false },
        answering: { label: t('stopAnswering'),  cls: 'btn btn-danger btn-lg',  disabled: false },
        stopped:   { label: t('stopped'),        cls: 'btn btn-ghost btn-lg',   disabled: true  },
    };
    const cfg = btnConfig[f] || btnConfig.idle;
    const icon = f === 'answering' ? 'stop' : 'play_arrow';
    const btnHtml = `<span class="material-symbols-outlined">${icon}</span> ${cfg.label}`;

    // 同步更新頁2和頁3的按鈕
    [startStopBtn, start3].forEach(btn => {
        if (!btn) return;
        btn.disabled = cfg.disabled;
        btn.innerHTML = btnHtml;
        btn.className = cfg.cls;
    });
    if (extend3) extend3.style.display = f === 'answering' ? 'inline-flex' : 'none';
    gotoPage4Btn.disabled = f !== 'stopped';
}

// ═══════════════════════════════════════════════
// 學生ID工具
// ═══════════════════════════════════════════════
function getStudentId(s) { return `${s.grade}-${s.class}-${String(s.number).padStart(2, '0')}`; }
function getStudentName(id) { const s = STATE.allStudents.find(x => getStudentId(x) === id); return s?.name || id; }
function generateRoomId() { return String(Math.floor(1000 + Math.random() * 9000)); }
function generateRoundId(n) { return `R${String(n).padStart(3,'0')}_${Date.now().toString(36).toUpperCase()}`; }

// ═══════════════════════════════════════════════
// 名單載入
// ═══════════════════════════════════════════════
const ROSTER_URL = "https://script.google.com/macros/s/AKfycbyTN6NbWdLc-OfKoa_3iyX5uHCwpDuEeIYSRSVgFcE4aM3RHHfgJthaAMXoiul2YTkH6A/exec";
async function loadRoster() {
    try {
        const res = await fetch(ROSTER_URL, { redirect: 'follow' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.data || json.data.length === 0) throw new Error('名單為空');
        buildRoster(json.data);
        console.log(`✅ 名單載入成功：${STATE.allStudents.length} 位學生`);
        return true;
    } catch (e) {
        console.warn('名單載入失敗', e.message);
        if (await window.asyncConfirm(`⚠️ 無法載入學生名單（${e.message}）。\n是否改用「自訂人數模式」？`)) {
            customClassCheckbox.checked = true;
            customStudentCount.disabled = false;
            STATE.customClassEnabled = true;
        }
        return false;
    }
}
function buildRoster(data) {
    const rosterData = {}, allStudents = [];
    for (const r of data) {
        const grade = r.grade?.toString().trim(), cls = r.class?.toString().trim();
        const num = r.number?.toString().trim(), name = r.name?.trim();
        if (!grade || !cls || !num || !name) continue;
        const key = `${grade}-${cls}`;
        if (!rosterData[key]) rosterData[key] = [];
        rosterData[key].push({ grade, class: cls, number: num, name });
        allStudents.push({ grade, class: cls, number: num, name });
    }
    for (const key in rosterData) rosterData[key].sort((a, b) => parseInt(a.number) - parseInt(b.number));
    STATE.rosterData = rosterData; STATE.allStudents = allStudents;
    renderClassCheckboxes();
}
function renderClassCheckboxes() {
    const keys = Object.keys(STATE.rosterData).sort((a, b) => {
        const [ag, ac] = a.split('-').map(Number), [bg, bc] = b.split('-').map(Number);
        return ag !== bg ? ag - bg : ac - bc;
    });
    classCheckboxContainer.innerHTML = keys.map(k => {
        const [g, c] = k.split('-');
        const label = LANG === 'zh'
            ? `${['','一','二','三','四','五','六'][g]||g}年${['','甲','乙','丙'][c]||c}班`
            : `Grade ${g} Class ${'ABCDEFGH'[c-1]||c}`;
        return `<label><input type="checkbox" value="${k}" /> ${label}</label>`;
    }).join('');
    classCheckboxContainer.addEventListener('change', () => {
        STATE.selectedClasses = [...classCheckboxContainer.querySelectorAll('input:checked')].map(el => el.value);
    });
}

// ═══════════════════════════════════════════════
// 建立教室
// ═══════════════════════════════════════════════
async function findExistingRoom(teacherName) {
    try {
        const q = query(collection(db, 'rooms'), where('teacherName', '==', teacherName));
        const snap = await getDocs(q);
        const now = new Date();
        for (const d of snap.docs) {
            const data = d.data();
            if (data.expireAt && new Date(data.expireAt) > now) return d.id;
        }
    } catch(e) {}
    return null;
}
async function deleteRoom(roomId) {
    try {
        for (const col of ['answers','students','buzzes','votes']) {
            const snap = await getDocs(collection(db, 'rooms', roomId, col));
            if (!snap.empty) {
                const batch = writeBatch(db);
                snap.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
        }
        await deleteDoc(doc(db, 'rooms', roomId, 'meta', 'info')).catch(() => {});
        await deleteDoc(doc(db, 'rooms', roomId));
    } catch(e) { console.warn('刪除舊教室失敗', e); }
}
async function createRoom() {
    if (STATE.roomId) { openQR(); return; }
    const teacherName = teacherNameInput.value.trim() || '教師';
    STATE.teacherName = teacherName;
    if (STATE.customClassEnabled) {
        STATE.selectedClasses = [];  // 自訂模式不需要班級
    } else {
        STATE.selectedClasses = [...classCheckboxContainer.querySelectorAll('input:checked')].map(el => el.value);
        if (STATE.selectedClasses.length === 0) { await alert('請先勾選至少一個班級'); return; }
    }
    if (STATE.customClassEnabled) {
        STATE.customStudentCount = Math.min(50, Math.max(1, parseInt(customStudentCount.value) || 20));
    }
    // 查找並關閉舊教室
    const oldRoom = await findExistingRoom(teacherName);
    if (oldRoom) {
        if (!await window.asyncConfirm(`您已有教室（${oldRoom}），關閉舊教室並建新教室？`)) return;
        await deleteRoom(oldRoom);
    }
    STATE.roomId = generateRoomId();
    roomIdDisplay.textContent = STATE.roomId;
    try {
        await setDoc(doc(db, 'rooms', STATE.roomId), {
            teacherName, createdAt: serverTimestamp(),
            currentQuestion: 0, isAnswering: false,
            questionType: 'choice', questionNote: '', timerSeconds: 20,
            revealedAnswer: null, clearAll: false,
            broadcastMsg: '', broadcastAt: null,
            specifiedStudents: [],
            selectedClasses: STATE.selectedClasses,
            customClassEnabled: STATE.customClassEnabled,
            customStudentCount: STATE.customClassEnabled ? STATE.customStudentCount : 0,
            expireAt: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
            isLocked: false,
            voteActive: false, voteOptions: [], voteResults: {}, voteResultsAt: null,
            groups: [], groupScores: {},
            buzzActive: false, buzzCountdown: 5,
            cumulativeScores: {},
        });
        await setDoc(doc(db, 'rooms', STATE.roomId, 'meta', 'info'), { questionCounter: 1 });
        STATE.currentQuestion = 0;
        STATE.currentAnswers = {}; STATE.history = [];
        STATE.cumulativeScores = {}; STATE.roundAwarded = {};
        STATE.isPublished = false; STATE.isStopped = false; STATE.flowState = 'idle';
        publishBtn.innerHTML = `<span class="material-symbols-outlined">send</span> ${t('publish').replace('{n}', 1)}`;
        publishStatus.textContent = '';
        listenStudents();
        renderOnlineStudents([]);  // 先畫空格子，listenStudents 會即時更新
        openQR();
        goToPage(2);
        await alert(t('successRoomCreated').replace('{code}', STATE.roomId));
    } catch (e) { await alert('建立教室失敗：' + e.message); }
}

// ═══════════════════════════════════════════════
// 監聽學生上線
// ═══════════════════════════════════════════════
let studentsUnsub = null;
function listenStudents() {
    if (studentsUnsub) { studentsUnsub(); }
    const q = query(collection(db, 'rooms', STATE.roomId, 'students'));
    studentsUnsub = onSnapshot(q, snap => {
        const onlineIds = [];
        const nameMap = {}; // 自訂模式：id -> 學生實際輸入的暱稱
        snap.forEach(d => {
            if (d.data().online !== false) onlineIds.push(d.id);
            if (d.data().name) nameMap[d.id] = d.data().name;
        });
        onlineCountEl.textContent = onlineIds.length;
        STATE.onlineNameMap = nameMap;
        renderOnlineStudents(onlineIds);
        if (STATE.currentPage === 3) renderCards();
    }, e => {
        console.warn('監聽學生失敗', e);
        setTimeout(() => { if (STATE.roomId) listenStudents(); }, 5000);
    });
}

// ═══════════════════════════════════════════════
// 圖片題 base64 處理（含自適應壓縮）
// ═══════════════════════════════════════════════
let questionImageBase64 = '';
const removeQuestionImageBtn = document.getElementById('removeQuestionImageBtn');

// 自適應壓縮：目標讓 base64 結果控制在安全大小內（Firestore 單一文件上限 1MB，
// 一份答案/題目文件裡還有其他欄位，所以留安全邊界，目標抓 650KB 以內）
// 做法：從較大尺寸/品質開始嘗試，太大就逐步降尺寸或降品質，直到符合大小或已達最低品質
function compressImageAdaptive(img, targetBytes = 650 * 1024) {
    const attempts = [
        { max: 1400, q: 0.82 },
        { max: 1400, q: 0.7  },
        { max: 1100, q: 0.7  },
        { max: 1100, q: 0.55 },
        { max: 800,  q: 0.6  },
        { max: 800,  q: 0.45 },
        { max: 600,  q: 0.5  },
    ];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let result = null;
    for (const { max, q } of attempts) {
        let w = img.width, h = img.height;
        if (w > h && w > max) { h = h * max / w; w = max; }
        else if (h >= w && h > max) { w = w * max / h; h = max; }
        canvas.width = w; canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', q);
        result = dataUrl;
        if (dataUrl.length <= targetBytes * 1.37) break; // base64 比原始位元組多約37%
    }
    return result;
}

function handleImageFile(file) {
    if (!file) return;
    questionImageFileName.textContent = `${file.name || '圖片'}（壓縮中...）`;
    imageUploadZone.style.display = 'block';
    const reader = new FileReader();
    reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
            questionImageBase64 = compressImageAdaptive(img);
            questionImagePreview.src = questionImageBase64;
            questionImagePreview.style.display = 'block';
            questionImageFileName.textContent = file.name || '已附加圖片';
            removeQuestionImageBtn.style.display = 'block';
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

removeQuestionImageBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    questionImageInput.value = '';
    questionImageBase64 = '';
    questionImagePreview.src = '';
    questionImagePreview.style.display = 'none';
    questionImageFileName.textContent = '';
    removeQuestionImageBtn.style.display = 'none';
    imageUploadZone.style.display = 'none';
});

// 三個來源共用同一個處理函式
document.getElementById('attachFileBtn').addEventListener('click', () => questionImageInput.click());
document.getElementById('attachCameraBackBtn').addEventListener('click', () => document.getElementById('questionImageInputBack').click());
document.getElementById('attachCameraFrontBtn').addEventListener('click', () => document.getElementById('questionImageInputFront').click());
questionImageInput.addEventListener('change', e => { handleImageFile(e.target.files[0]); e.target.value = ''; });
document.getElementById('questionImageInputBack').addEventListener('change', e => { handleImageFile(e.target.files[0]); e.target.value = ''; });
document.getElementById('questionImageInputFront').addEventListener('change', e => { handleImageFile(e.target.files[0]); e.target.value = ''; });

// ── 螢幕截圖（getDisplayMedia + 拖曳框選裁切，類似 Win+Shift+S）──
// Safari（含 iPad/Mac Safari）不支援 getDisplayMedia，偵測後停用按鈕並顯示說明
const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
const screenshotBtn = document.getElementById('attachScreenshotBtn');
if (isSafari || !navigator.mediaDevices?.getDisplayMedia) {
    screenshotBtn.disabled = true;
    document.getElementById('screenshotUnsupportedNote').style.display = 'inline';
} else {
    screenshotBtn.addEventListener('click', startScreenshotCapture);
}

async function startScreenshotCapture() {
    let stream;
    try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    } catch (e) {
        return; // 使用者取消分享，靜默結束
    }
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();
    // 抓一張畫面後就立刻關閉分享，避免持續佔用系統資源
    await new Promise(r => setTimeout(r, 200));
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = video.videoWidth; fullCanvas.height = video.videoHeight;
    fullCanvas.getContext('2d').drawImage(video, 0, 0);
    stream.getTracks().forEach(t => t.stop());

    // 顯示框選介面
    const cropModal = document.getElementById('screenshotCropModal');
    const cropCanvas = document.getElementById('screenshotCanvas');
    cropModal.style.display = 'flex';
    cropCanvas.width = fullCanvas.width; cropCanvas.height = fullCanvas.height;
    const cctx = cropCanvas.getContext('2d');
    cctx.drawImage(fullCanvas, 0, 0);

    let startX = 0, startY = 0, curX = 0, curY = 0, dragging = false;
    const scale = () => cropCanvas.width / cropCanvas.getBoundingClientRect().width;
    const getPos = e => {
        const r = cropCanvas.getBoundingClientRect(); const s = scale();
        return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s };
    };
    const redraw = () => {
        cctx.drawImage(fullCanvas, 0, 0);
        if (dragging || (curX !== startX && curY !== startY)) {
            cctx.strokeStyle = '#4f46e5'; cctx.lineWidth = 3 * scale();
            cctx.strokeRect(startX, startY, curX - startX, curY - startY);
            cctx.fillStyle = 'rgba(79,70,229,0.15)';
            cctx.fillRect(startX, startY, curX - startX, curY - startY);
        }
    };
    cropCanvas.onmousedown = e => { const p = getPos(e); startX = curX = p.x; startY = curY = p.y; dragging = true; };
    cropCanvas.onmousemove = e => { if (!dragging) return; const p = getPos(e); curX = p.x; curY = p.y; redraw(); };
    window.addEventListener('mouseup', () => { dragging = false; });

    const cleanup = () => { cropModal.style.display = 'none'; cropCanvas.onmousedown = cropCanvas.onmousemove = null; };
    document.getElementById('cancelCropBtn').onclick = cleanup;
    document.getElementById('redrawCropBtn').onclick = () => {
        startX = 0; startY = 0; curX = 0; curY = 0; dragging = false;
        redraw(); // This will just draw the full canvas without the strokeRect because startX==curX
    };
    document.getElementById('confirmCropBtn').onclick = () => {
        const x = Math.min(startX, curX), y = Math.min(startY, curY);
        const w = Math.abs(curX - startX), h = Math.abs(curY - startY);
        const finalCanvas = document.createElement('canvas');
        if (w < 10 || h < 10) {
            // 沒有框選（或框太小）就用整張畫面
            finalCanvas.width = fullCanvas.width; finalCanvas.height = fullCanvas.height;
            finalCanvas.getContext('2d').drawImage(fullCanvas, 0, 0);
        } else {
            finalCanvas.width = w; finalCanvas.height = h;
            finalCanvas.getContext('2d').drawImage(fullCanvas, x, y, w, h, 0, 0, w, h);
        }
        finalCanvas.toBlob(blob => {
            handleImageFile(new File([blob], 'screenshot.jpg', { type: 'image/jpeg' }));
            cleanup();
        }, 'image/jpeg', 0.85);
    };
}


// 題型 Radio 切換
document.querySelectorAll('input[name="questionType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const type = e.target.value;
        document.getElementById('questionTypeSelect').value = type;
        // Optionally update any UI based on type if needed
    });
});
});
document.querySelectorAll('[data-seconds]').forEach(btn => {
    btn.addEventListener('click', () => { customSeconds.value = btn.dataset.seconds; });
});

// ═══════════════════════════════════════════════
// 出題
// ═══════════════════════════════════════════════
let _publishing = false;
async function publishQuestion() {
    if (!STATE.roomId) { await alert('請先建立教室'); return; }
    if (STATE.flowState === 'answering') { await alert('請先停止作答再出下一題'); return; }
    if (_publishing) return; _publishing = true;
    try {
    const metaRef = doc(db, 'rooms', STATE.roomId, 'meta', 'info');
    const metaSnap = await getDoc(metaRef);
    const qNum = metaSnap.exists() ? (metaSnap.data().questionCounter || 1) : 1;
    STATE.currentQuestion = qNum;
    STATE.currentRoundId = generateRoundId(qNum);
    STATE.questionScore = Math.min(10, Math.max(1, parseInt(questionScoreInput.value) || 1));
    const qType = questionTypeSelect.value;
    const qNote = questionNoteInput.value.trim() || `第 ${qNum} 題`;
    const secs  = parseInt(customSeconds.value) || 20;
    STATE.questionType = qType;
    STATE.correctAnswer = null; STATE.isRevealed = false;
    STATE.currentAnswers = {}; STATE.specifiedStudents = []; STATE.roundAwarded = {};
    currentQDisplay.textContent = `第 ${qNum} 題`;
    publishBtn.innerHTML = `<span class="material-symbols-outlined">send</span> ${t('publish').replace('{n}', qNum + 1)}`;
    publishStatus.textContent = `已出第 ${qNum} 題（${STATE.questionScore}分）`;
    // 先發 clearAll 清除學生端舊題
    const roomRef = doc(db, 'rooms', STATE.roomId);
    const payload = {
        currentQuestion: qNum, currentRoundId: STATE.currentRoundId,
        questionNote: qNote, questionType: qType, questionScore: STATE.questionScore,
        isAnswering: false, timerSeconds: secs, revealedAnswer: null,
        clearAll: true, specifiedStudents: [],
        questionImageUrl: questionImageBase64 || null,
    };
    await updateDoc(roomRef, payload);
    await new Promise(r => setTimeout(r, 300));
    await updateDoc(roomRef, { clearAll: false });
    await setDoc(metaRef, { questionCounter: qNum + 1 });
    // 更新計時器顯示
    timerLargeDisplay.textContent = secs;
    timerLargeDisplay.className = 'timer-large';
    timerLabel.textContent = t('waitingStart') || '等待開始';
    timerLargeContainer.style.display = 'block';
    extendTimeBtn.style.display = 'none';
    STATE.isPublished = true; STATE.isStopped = false; STATE.flowState = 'published';
    renderCards(); updateFlowButtons();
    gotoPage3Btn.disabled = false;
    viewTextAnswersBtn.style.display = (qType !== 'choice') ? 'inline-flex' : 'none';
    goToPage(3);
    } finally { _publishing = false; }
}

// ═══════════════════════════════════════════════
// 開始 / 停止作答
// ═══════════════════════════════════════════════
let _toggling = false;
async function toggleStartStop() {
    if (!STATE.roomId || _toggling) return;
    _toggling = true;
    try {
    if (STATE.flowState === 'idle' || STATE.flowState === 'published' || STATE.flowState === 'stopped') {
        const secs = parseInt(customSeconds.value) || 20;
        await updateDoc(doc(db, 'rooms', STATE.roomId), { isAnswering: true, timerSeconds: secs, answeringStartedAt: Date.now() });
        STATE.isAnswering = true; STATE.flowState = 'answering';
        extendTimeBtn.style.display = 'inline-flex';
        startTimer(secs);
        timerLabel.textContent = t('answering') || '作答中...';
        updateFlowButtons();
    } else if (STATE.flowState === 'answering') {
        await stopAnswering();
    }
    } finally { _toggling = false; }
}
async function stopAnswering() {
    clearTimer();
    extendTimeBtn.style.display = 'none';
    timerLabel.textContent = t('stopped') || '已停止';
    timerLargeDisplay.textContent = '⏹️';
    timerLargeDisplay.className = 'timer-large';
    await updateDoc(doc(db, 'rooms', STATE.roomId), { isAnswering: false });
    STATE.isAnswering = false; STATE.isStopped = true; STATE.flowState = 'stopped';
    await collectAnswers();
    renderCards();       // 刷新第三頁答題卡
    updateFlowButtons();
    gotoPage4Btn.disabled = false;
}

// ═══════════════════════════════════════════════
// 本地計時器
// ═══════════════════════════════════════════════
function syncTimerDisplays(val, urgent = false) {
    const cls = urgent ? 'timer-large urgent' : 'timer-large';
    [timerLargeDisplay, document.getElementById('timerLargeDisplay2')].forEach(el => {
        if (el) { el.textContent = val; el.className = cls; }
    });
}
function startTimer(secs) {
    clearTimer();
    STATE.currentTimerVal = secs;
    syncTimerDisplays(STATE.currentTimerVal);
    STATE.timerInterval = setInterval(async () => {
        STATE.currentTimerVal--;
        syncTimerDisplays(STATE.currentTimerVal, STATE.currentTimerVal <= 5);
        if (STATE.currentTimerVal <= 0) {
            clearTimer();
            [timerLargeDisplay, document.getElementById('timerLargeDisplay2')].forEach(el => { if (el) { el.textContent = '⏰'; el.className = 'timer-large'; } });
            await stopAnswering();
        }
    }, 1000);
}
function clearTimer() { if (STATE.timerInterval) { clearInterval(STATE.timerInterval); STATE.timerInterval = null; } }

// ═══════════════════════════════════════════════
// 收集答案
// ═══════════════════════════════════════════════
async function collectAnswers() {
    if (!STATE.roomId || !STATE.currentRoundId) return;
    const q = query(collection(db, 'rooms', STATE.roomId, 'answers'), where('roundId', '==', STATE.currentRoundId));
    const snap = await getDocs(q);
    const answers = {};
    snap.forEach(d => {
        const data = d.data();
        answers[data.studentId] = {
            name: data.name || data.studentId,
            choice: data.choice || '', text: data.text || '', imageUrl: data.imageUrl || '',
            timestamp: data.timestamp?.toDate?.() || new Date()
        };
    });
    STATE.currentAnswers = answers;
    // 記錄到 history
    const qNote = questionNoteInput.value.trim() || `第 ${STATE.currentQuestion} 題`;
    const existing = STATE.history.find(h => h.roundId === STATE.currentRoundId);
    if (!existing) {
        STATE.history.push({
            question: STATE.currentQuestion, roundId: STATE.currentRoundId,
            note: qNote, type: STATE.questionType, score: STATE.questionScore,
            correctAnswer: null,
            answers: Object.entries(answers).map(([id, v]) => ({ studentId: id, name: v.name, choice: v.choice, text: v.text, imageUrl: v.imageUrl, timestamp: v.timestamp, earnedScore: 0 }))
        });
    }
    renderCards();
}

// ═══════════════════════════════════════════════
// 學生卡片渲染
// ═══════════════════════════════════════════════
// ── 第二頁：登入狀況（誰在教室裡）──
function renderOnlineStudents(onlineIds) {
    if (!onlineStudentsGrid) return;
    let students = [];
    const nameMap = STATE.onlineNameMap || {};
    if (STATE.customClassEnabled) {
        const count = STATE.customStudentCount || 20;
        students = Array.from({length: count}, (_, i) => {
            const id = `temp_${i+1}`;
            return { __id: id, name: nameMap[id] || `${i+1}號`, number: String(i+1) };
        });
    } else {
        for (const cls of STATE.selectedClasses) {
            students.push(...(STATE.rosterData[cls] || []).map(s => ({ ...s })));
        }
        students.sort((a, b) => parseInt(a.number) - parseInt(b.number));
    }
    const onlineSet = new Set(onlineIds || []);
    onlineCountBadge.textContent = onlineSet.size;
    onlineCountEl.textContent = onlineSet.size;
    if (students.length === 0) {
        onlineStudentsGrid.innerHTML = '<div style="color:var(--text-muted);text-align:center;width:100%;padding:20px;">尚無學生</div>';
        return;
    }
    onlineStudentsGrid.innerHTML = students.map(s => {
        const id = s.__id || getStudentId(s);
        const isOnline = onlineSet.has(id);
        return `<div class="card${isOnline ? ' submitted' : ''}" title="${s.name}" style="${isOnline ? '' : 'opacity:0.45;'}">
            <div style="font-size:13px;font-weight:700;">${s.number}</div>
            <span class="sub-label" style="font-size:11px;${isOnline ? 'color:var(--success);' : ''}">
                ${isOnline ? '✅ 在線' : '— 未加入'}
            </span>
        </div>`;
    }).join('');
}

function renderCards() {
    let students = [];
    if (STATE.customClassEnabled) {
        // 自訂模式：顯示全部座位（1到customStudentCount），不管有沒有作答
        const count = STATE.customStudentCount || 20;
        students = Array.from({length: count}, (_, i) => ({
            __id: `temp_${i+1}`, name: STATE.currentAnswers[`temp_${i+1}`]?.name || (STATE.onlineNameMap||{})[`temp_${i+1}`] || `${i+1}號`,
            number: String(i+1)
        }));
    } else {
        for (const cls of STATE.selectedClasses) {
            students = students.concat((STATE.rosterData[cls] || []).map(s => ({ ...s, className: cls })));
        }
        if (STATE.sortByTime) {
            students.sort((a, b) => {
                const idA = a.__id || getStudentId(a), idB = b.__id || getStudentId(b);
                const tA = STATE.currentAnswers[idA]?.timestamp?.getTime?.() || 0;
                const tB = STATE.currentAnswers[idB]?.timestamp?.getTime?.() || 0;
                return (tA && !tB) ? -1 : (!tA && tB) ? 1 : tA - tB;
            });
        } else {
            students.sort((a, b) => parseInt(a.number) - parseInt(b.number));
        }
    }
    let html = '';
    for (const s of students) {
        const id   = s.__id || getStudentId(s);
        const ans  = STATE.currentAnswers[id] || null;
        const done = !!ans;
        const specified = STATE.specifiedStudents.includes(id);
        let cls  = 'card', label = s.name;
        if (done) {
            cls += ' submitted';
            if (STATE.isRevealed && STATE.correctAnswer && STATE.questionType === 'choice') {
                if (ans.choice === STATE.correctAnswer) { cls += ' reveal-correct'; label = `${ans.choice} ✅`; }
                else { cls += ' reveal-wrong'; label = `${ans.choice} ❌`; }
            } else if (STATE.questionType === 'image') { label = '🎨'; }
            else if (STATE.questionType === 'text')   { label = `📝 ${(ans.text || '').slice(0, 6)}`; }
            else { label = ans.choice || '?'; }
        } else if (specified && STATE.flowState === 'answering') {
            cls += ' specified'; label = '👆 被點';
        } else if (STATE.flowState === 'answering') { label = '⏳'; }
        else { label = '⏸️'; }
        if (STATE.flowState === 'answering') cls += ' clickable';
        html += `<div class="${cls}" data-id="${id}" data-name="${s.name}" data-num="${s.number}"><div>${s.number}</div><span class="sub-label">${label}</span></div>`;
    }
    // 只更新第三頁的答題卡（第二頁改為 renderOnlineStudents）
    resultCards.innerHTML = html || '<div style="color:var(--text-muted);text-align:center;width:100%;padding:20px;">尚未有學生作答</div>';
    resultCards.querySelectorAll('.card.clickable').forEach(el => {
        el.addEventListener('click', () => { toggleSpecified(el.dataset.id); });
    });
}
function toggleSpecified(id) {
    const i = STATE.specifiedStudents.indexOf(id);
    if (i >= 0) STATE.specifiedStudents.splice(i, 1);
    else STATE.specifiedStudents.push(id);
    updateDoc(doc(db, 'rooms', STATE.roomId), { specifiedStudents: STATE.specifiedStudents }).catch(() => {});
    renderCards();
}

// ═══════════════════════════════════════════════
// 頁4：批改
// ═══════════════════════════════════════════════
async function revealAnswer(answer) {
    const score = STATE.questionScore || 1;
    // 若老師改選了不同的答案，先把上一輪的加分退回
    if (STATE.isRevealed && STATE.correctAnswer && STATE.correctAnswer !== answer) {
        for (const id of Object.keys(STATE.roundAwarded)) {
            if (STATE.roundAwarded[id]) {
                STATE.cumulativeScores[id] = Math.max(0, (STATE.cumulativeScores[id] || 0) - STATE.roundAwarded[id]);
            }
        }
        STATE.roundAwarded = {};
    }
    STATE.correctAnswer = answer;
    STATE.isRevealed = true;
    await updateDoc(doc(db, 'rooms', STATE.roomId), { revealedAnswer: answer });
    // 重新計算本題得分
    for (const id in STATE.currentAnswers) {
        const isCorrect = STATE.currentAnswers[id].choice === answer;
        if (isCorrect && !STATE.roundAwarded[id]) {
            STATE.cumulativeScores[id] = (STATE.cumulativeScores[id] || 0) + score;
            STATE.roundAwarded[id] = score;
        } else if (!isCorrect) {
            STATE.roundAwarded[id] = 0;
        }
    }
    const h = STATE.history.find(x => x.roundId === STATE.currentRoundId);
    if (h) { h.correctAnswer = answer; h.answers.forEach(a => { a.earnedScore = a.choice === answer ? score : 0; }); }
    updateDoc(doc(db, 'rooms', STATE.roomId), { cumulativeScores: STATE.cumulativeScores }).catch(() => {});
    document.querySelectorAll('.choice-reveal-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.answer === answer);
    });
    // 立即刷新第四頁的學生答題卡（含正確/錯誤圖示）
    renderChoiceResultCards();
    renderCards();
    gotoPage5Btn.disabled = false;
    updateRankList();
}
function hideAnswer() {
    STATE.correctAnswer = null; STATE.isRevealed = false;
    updateDoc(doc(db, 'rooms', STATE.roomId), { revealedAnswer: null }).catch(() => {});
    document.querySelectorAll('.choice-reveal-btn').forEach(btn => btn.classList.remove('selected'));
    renderCards();
}
function renderChoiceResultCards() {
    let students = [];
    if (STATE.customClassEnabled) {
        const count = STATE.customStudentCount || 20;
        students = Array.from({length: count}, (_, i) => ({
            __id: `temp_${i+1}`, name: `${i+1}號`, number: String(i+1)
        }));
    } else {
        for (const cls of STATE.selectedClasses) {
            students.push(...(STATE.rosterData[cls] || []).map(s => ({ ...s })));
        }
        students.sort((a, b) => parseInt(a.number) - parseInt(b.number));
    }
    if (students.length === 0) { choiceResultCards.innerHTML = ''; return; }
    choiceResultCards.innerHTML = students.map(s => {
        const id = s.__id || getStudentId(s);
        const ans = STATE.currentAnswers[id];
        if (!ans || !ans.choice) return `<div class="card"><div>${s.number}</div><span class="sub-label" style="color:var(--text-muted);">—</span></div>`;
        const ok = STATE.isRevealed && STATE.correctAnswer && ans.choice === STATE.correctAnswer;
        const wrong = STATE.isRevealed && STATE.correctAnswer && ans.choice !== STATE.correctAnswer;
        const cardCls = 'card submitted' + (ok ? ' reveal-correct' : wrong ? ' reveal-wrong' : '');
        const label = STATE.isRevealed
            ? (ok ? `${ans.choice} ✅` : `${ans.choice} ❌`)
            : (ans.choice || '?');
        return `<div class="${cardCls}"><div>${s.number}</div><span class="sub-label">${label}</span></div>`;
    }).join('');
}
function renderTextGrading() {
    let students = [];
    if (STATE.customClassEnabled) {
        const ids = Object.keys(STATE.currentAnswers).filter(id => id.startsWith('temp_'));
        students = ids.map(id => ({ __id: id, name: STATE.currentAnswers[id]?.name || id, number: id.replace('temp_', '') }));
    } else {
        for (const cls of STATE.selectedClasses) students.push(...(STATE.rosterData[cls] || []).map(s => ({ ...s })));
    }
    const isImage = STATE.questionType === 'image';
    if (isImage) {
        textGradingList.style.display = 'flex';
        textGradingList.style.flexWrap = 'wrap';
        textGradingList.style.gap = '12px';
        textGradingList.style.justifyContent = 'center';
        textGradingList.innerHTML = students.map(s => {
            const id = s.__id || getStudentId(s);
            const ans = STATE.currentAnswers[id];
            const done = !!ans;
            const checked = (STATE.roundAwarded[id] || 0) > 0;
            const imgUrl = ans?.imageUrl || '';
            return `<div style="width:150px;background:rgba(255,255,255,0.8);border-radius:12px;padding:8px;text-align:center;border:1px solid rgba(0,0,0,0.06);">
                <div style="font-weight:700;font-size:13px;margin-bottom:6px;">${s.number}號 ${s.name}</div>
                <div style="min-height:100px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.02);border-radius:8px;">
                    ${done && imgUrl ? `<img src="${imgUrl}" style="max-width:100%;max-height:130px;border-radius:8px;cursor:pointer;" onclick="window.showImageModal('${imgUrl}',true,'${id}')" />` : '<div style="color:#999;font-size:12px;">(未送出)</div>'}
                </div>
                <div style="margin-top:8px;display:flex;justify-content:center;align-items:center;gap:4px;">
                    <input type="checkbox" data-student-id="${id}" ${checked ? 'checked' : ''} ${done ? '' : 'disabled'} />
                    <span class="score-badge" style="font-size:13px;font-weight:700;color:var(--primary);">${STATE.cumulativeScores[id] || 0} 分</span>
                </div>
            </div>`;
        }).join('');
    } else {
        textGradingList.style.display = 'flex';
        textGradingList.style.flexWrap = '';
        textGradingList.style.gap = '';
        textGradingList.innerHTML = students.map(s => {
            const id = s.__id || getStudentId(s);
            const ans = STATE.currentAnswers[id];
            const done = !!ans;
            const checked = (STATE.roundAwarded[id] || 0) > 0;
            const txt = ans?.text || '(未送出)';
            return `<div class="text-list-item" style="background:${done ? 'var(--success-light)' : 'rgba(255,255,255,0.3)'};">
                <input type="checkbox" data-student-id="${id}" ${checked ? 'checked' : ''} ${done ? '' : 'disabled'} />
                <span class="seat">${s.number}號</span>
                <span class="name">${s.name}</span>
                <span class="answer-text">${txt}</span>
                <span class="score-badge">${STATE.cumulativeScores[id] || 0} 分</span>
            </div>`;
        }).join('');
    }
    // 勾選評分
    textGradingList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', function() {
            const sid = this.dataset.studentId;
            const score = STATE.questionScore || 1;
            if (this.checked) { STATE.cumulativeScores[sid] = (STATE.cumulativeScores[sid] || 0) + score; STATE.roundAwarded[sid] = score; }
            else { STATE.cumulativeScores[sid] = Math.max(0, (STATE.cumulativeScores[sid] || 0) - score); STATE.roundAwarded[sid] = 0; }
            const h = STATE.history.find(x => x.roundId === STATE.currentRoundId);
            if (h) { const a = h.answers.find(x => x.studentId === sid); if (a) a.earnedScore = STATE.roundAwarded[sid] || 0; }
            updateRankList();
            // 文字題在 .text-list-item 下，圖片題在外層 div 下，兩者都可用 parentElement.querySelector
            const badge = this.parentElement.querySelector('.score-badge');
            if (badge) badge.textContent = `${STATE.cumulativeScores[sid] || 0} 分`;
            updateDoc(doc(db, 'rooms', STATE.roomId), { cumulativeScores: STATE.cumulativeScores }).catch(() => {});
        });
    });
    gotoPage5Btn.disabled = false;
}

// ═══════════════════════════════════════════════
// 頁5：排行榜
// ═══════════════════════════════════════════════
let rankSortAsc = false;
function updateRankList() {
    let sorted = Object.entries(STATE.cumulativeScores);
    if (rankSortAsc) {
        sorted.sort((a, b) => {
            const nA = parseInt((a[0].match(/(\d+)$/) || [0,0])[1]) || 0;
            const nB = parseInt((b[0].match(/(\d+)$/) || [0,0])[1]) || 0;
            return nA - nB;
        });
    } else { sorted.sort((a, b) => b[1] - a[1]); }
    if (sorted.length === 0) { rankList.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:20px;">尚無分數記錄</div>'; return; }
    let html = '';
    sorted.forEach(([id, score], idx) => {
        let scoreIdx = idx;
        if (rankSortAsc) { scoreIdx = Object.entries(STATE.cumulativeScores).sort((a,b) => b[1]-a[1]).findIndex(([sid]) => sid === id); }
        const cls = 'rank-item' + (scoreIdx === 0 ? ' top1' : scoreIdx === 1 ? ' top2' : scoreIdx === 2 ? ' top3' : '');
        const medal = scoreIdx === 0 ? '🥇' : scoreIdx === 1 ? '🥈' : scoreIdx === 2 ? '🥉' : `${scoreIdx + 1}`;
        html += `<div class="${cls}"><span class="rank-num">${medal}</span><span class="rank-name">${getStudentName(id)}</span><span class="rank-score">${score} ${t('score') || '分'}</span></div>`;
    });
    rankList.innerHTML = html;
}
rankSortBtn.addEventListener('click', () => {
    rankSortAsc = !rankSortAsc;
    rankSortBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:15px;">sort</span> ${rankSortAsc ? '依座號排序' : '依分數排序'}`;
    updateRankList();
});

// ═══════════════════════════════════════════════
// 清除 / 下一題
// ═══════════════════════════════════════════════
async function clearAndNextQuestion() {
    if (!await window.asyncConfirm('清除本題記錄並進入下一題？\n（累計得分將保留）')) return;
    clearTimer();
    STATE.currentAnswers = {}; STATE.correctAnswer = null; STATE.isRevealed = false;
    STATE.specifiedStudents = []; STATE.roundAwarded = {};
    STATE.isPublished = false; STATE.isStopped = false; STATE.currentRoundId = null; STATE.flowState = 'idle';
    // 重置圖片預覽
    questionImageInput.value = ''; questionImageBase64 = '';
    questionImagePreview.src = ''; questionImagePreview.style.display = 'none';
    questionImageFileName.textContent = '';
    document.querySelectorAll('.choice-reveal-btn').forEach(b => b.classList.remove('selected'));
    renderCards(); updateRankList(); updateFlowButtons();
    await updateDoc(doc(db, 'rooms', STATE.roomId), { clearAll: true });
    await new Promise(r => setTimeout(r, 300));
    await updateDoc(doc(db, 'rooms', STATE.roomId), { clearAll: false });
    goToPage(2);
    gotoPage3Btn.disabled = true; gotoPage4Btn.disabled = true; gotoPage5Btn.disabled = true;
    timerLargeDisplay.textContent = '--'; timerLargeContainer.style.display = 'block';
    const metaSnap = await getDoc(doc(db, 'rooms', STATE.roomId, 'meta', 'info'));
    const next = metaSnap.exists() ? (metaSnap.data().questionCounter || 1) : 1;
    publishBtn.innerHTML = `<span class="material-symbols-outlined">send</span> ${t('publish').replace('{n}', next)}`;
    publishStatus.textContent = '';
    await alert(t('successCleared') || '已清除，可以出下一題了！');
}

// ═══════════════════════════════════════════════
// QR Code
// ═══════════════════════════════════════════════
async function openQR() {
    if (!STATE.roomId) { await alert('請先建立教室'); return; }
    const base = window.location.href.split('?')[0];
    const studentUrl = base.substring(0, base.lastIndexOf('/') + 1) + 'student.html?room=' + STATE.roomId;
    qrModalRoomCode.textContent = `教室代碼：${STATE.roomId}`;
    qrTestLink.href = studentUrl; qrTestLink.textContent = studentUrl;
    qrcodeDisplay.innerHTML = '';
    qrModal.classList.add('show');
    // QR Code 圖片（qrserver.com，避免 Edge 追蹤防護擋住 cdnjs）
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(studentUrl)}`;
    qrcodeDisplay.innerHTML = `<img src="${qrImgUrl}" width="200" height="200" style="border-radius:8px;" alt="QR Code" onerror="this.parentElement.innerHTML='<p style=color:#888>⚠️ QR 載入失敗</p>'" />`;

    // 即時顯示已登入的學生清單
    if (STATE.roomId) {
        const qrOnlineCount = document.getElementById('qrOnlineCount');
        const qrStudentList = document.getElementById('qrStudentList');
        const qrNoStudents  = document.getElementById('qrNoStudents');
        if (window._qrStudentsUnsub) { window._qrStudentsUnsub(); }
        window._qrStudentsUnsub = onSnapshot(
            collection(db, 'rooms', STATE.roomId, 'students'),
            snap => {
                const online = [];
                snap.forEach(d => { if (d.data().online !== false) online.push(d.data().name || d.id); });
                qrOnlineCount.textContent = online.length;
                if (online.length === 0) {
                    qrStudentList.innerHTML = '';
                    qrNoStudents.style.display = 'block';
                } else {
                    qrNoStudents.style.display = 'none';
                    qrStudentList.innerHTML = online.map(name =>
                        `<div style="padding:5px 10px;background:rgba(16,185,129,0.1);border-radius:8px;color:#065f46;font-weight:600;">✅ ${name}</div>`
                    ).join('');
                }
            },
            err => console.warn('QR學生監聽失敗', err)
        );
    }
}

// ═══════════════════════════════════════════════
// 廣播
// ═══════════════════════════════════════════════
async function sendBroadcast() {
    const msg = broadcastInput.value.trim();
    if (!msg) { await alert('請輸入廣播內容'); return; }
    await updateDoc(doc(db, 'rooms', STATE.roomId), { broadcastMsg: msg, broadcastAt: serverTimestamp() });
    broadcastInput.value = '';
    broadcastModal.classList.remove('show');
    await alert(t('broadcastSent') || '廣播已發送！');
}

// ═══════════════════════════════════════════════
// 鎖屏
// ═══════════════════════════════════════════════
async function toggleLockScreen() {
    if (!STATE.roomId) { await alert('請先建立教室'); return; }
    const snap = await getDoc(doc(db, 'rooms', STATE.roomId));
    const isLocked = !(snap.data()?.isLocked || false);
    await updateDoc(doc(db, 'rooms', STATE.roomId), { isLocked });
    const lockBtn = document.getElementById('dockLockScreen');
    lockBtn.innerHTML = `<span class="material-symbols-outlined">${isLocked ? 'lock_open' : 'lock'}</span><span class="label">${isLocked ? '解鎖' : '鎖屏'}</span>`;
    await alert(isLocked ? '已鎖定學生端畫面' : '已解除鎖定');
}

// ═══════════════════════════════════════════════
// 圖片彈窗（教師批閱用）
// ═══════════════════════════════════════════════
window.showImageModal = function(url, canBroadcast = false, studentId = null) {
    if (window._imgOverlay) { document.body.removeChild(window._imgOverlay); window._imgOverlay = null; }
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;backdrop-filter:blur(6px);";
    // 標題列
    const toolbar = document.createElement('div');
    toolbar.style.cssText = "display:flex;gap:10px;margin-bottom:10px;background:#fff;padding:8px 16px;border-radius:10px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:95vw;";
    // 教師可在圖上畫記
    const canvas = document.createElement('canvas');
    canvas.style.cssText = "max-width:90vw;max-height:72vh;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.5);touch-action:none;background:#fff;cursor:crosshair;";
    const ctx = canvas.getContext('2d');
    let isDrawing = false, drawColor = '#ef4444', hasModified = false;
    const img = new Image(); img.crossOrigin = 'Anonymous';
    img.onload = () => { canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img, 0, 0); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; };
    img.src = url;
    const getPos = e => {
        const r = canvas.getBoundingClientRect();
        const s = e.touches ? e.touches[0] : e;
        return { x: (s.clientX - r.left) * canvas.width / r.width, y: (s.clientY - r.top) * canvas.height / r.height };
    };
    canvas.addEventListener('pointerdown', e => { e.preventDefault(); isDrawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.strokeStyle = drawColor; });
    canvas.addEventListener('pointermove', e => { if (!isDrawing) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); hasModified = true; });
    canvas.addEventListener('pointerup',   e => { e.preventDefault(); isDrawing = false; ctx.closePath(); });
    canvas.addEventListener('pointercancel', e => { isDrawing = false; });
    // 顏色按鈕
    [['#ef4444','紅'],['#3b82f6','藍'],['#1e293b','黑'],['#22c55e','綠']].forEach(([c, label]) => {
        const btn = document.createElement('button');
        btn.textContent = label; btn.style.cssText = `width:36px;height:36px;border-radius:50%;background:${c};color:white;border:3px solid transparent;font-size:12px;cursor:pointer;font-weight:700;`;
        btn.onclick = () => { drawColor = c; ctx.strokeStyle = c; };
        toolbar.appendChild(btn);
    });
    if (canBroadcast && studentId) {
        const bBtn = document.createElement('button');
        bBtn.textContent = '廣播給全班'; bBtn.style.cssText = "padding:6px 14px;background:#4f46e5;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;";
        bBtn.onclick = () => { window.broadcastImageToClass(canvas.toDataURL('image/jpeg', 0.8)); };
        toolbar.appendChild(bBtn);
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '儲存覆蓋'; saveBtn.style.cssText = "padding:6px 14px;background:#10b981;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;";
        saveBtn.onclick = () => { if (hasModified) window.overwriteStudentImage(studentId, canvas.toDataURL('image/jpeg', 0.8)); else alert('您未修改此圖片'); };
        toolbar.appendChild(saveBtn);
    }
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '關閉'; closeBtn.style.cssText = "padding:6px 14px;background:#6b7280;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;";
    closeBtn.onclick = () => { document.body.removeChild(overlay); window._imgOverlay = null; };
    toolbar.appendChild(closeBtn);
    overlay.appendChild(toolbar); overlay.appendChild(canvas);
    document.body.appendChild(overlay); window._imgOverlay = overlay;
};
window.broadcastImageToClass = async function(dataUrl) {
    if (!STATE.roomId) return;
    await updateDoc(doc(db, 'rooms', STATE.roomId), { broadcastImageUrl: dataUrl, broadcastImageAt: serverTimestamp() });
    await alert('已廣播圖片給全班！');
};
window.overwriteStudentImage = async function(studentId, dataUrl) {
    if (!STATE.roomId || !studentId) return;
    await updateDoc(doc(db, 'rooms', STATE.roomId, 'answers', studentId), { imageUrl: dataUrl });
    if (STATE.currentAnswers[studentId]) STATE.currentAnswers[studentId].imageUrl = dataUrl;
    const h = STATE.history.find(x => x.roundId === STATE.currentRoundId);
    if (h) { const a = h.answers.find(x => x.studentId === studentId); if (a) a.imageUrl = dataUrl; }
    await alert('已儲存並覆蓋學生圖片！');
    renderTextGrading();
};

// ═══════════════════════════════════════════════
// 匯出 Excel（含圖片 JSZip）
// ═══════════════════════════════════════════════
async function loadScript(src) {
    return new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = src; sc.onload = resolve; sc.onerror = () => reject(new Error(`載入失敗：${src}`));
        document.head.appendChild(sc);
    });
}
async function exportExcel() {
    if (STATE.history.length === 0) { await alert('尚無任何題目記錄'); return; }
    // 先掃描是否含有圖片題，決定要不要載入 JSZip
    const hasImageQuestions = STATE.history.some(h => h.type === 'image' && h.answers.some(a => a.imageUrl));
    if (typeof XLSX === 'undefined') {
        try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'); }
        catch (e) { await alert('⚠️ 無法載入 Excel 匯出元件，請檢查網路連線後再試一次'); return; }
    }
    let zip = null, imgFolder = null;
    if (hasImageQuestions) {
        if (typeof JSZip === 'undefined') {
            try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'); }
            catch (e) { await alert('⚠️ 無法載入圖片打包元件，圖片將不會包含在匯出檔案中'); }
        }
        if (typeof JSZip !== 'undefined') { zip = new JSZip(); imgFolder = zip.folder('images'); }
    }
    const rows = [['題目', '題型', '分數', '學生ID', '姓名', '選擇', '文字', '是否正確', '得分', '圖片檔名']];
    let hasImages = false;
    for (let qi = 0; qi < STATE.history.length; qi++) {
        const h = STATE.history[qi];
        for (const a of h.answers) {
            let correct = '', earned = 0, imgFile = '';
            if (h.type === 'choice') {
                if (a.choice && a.choice === h.correctAnswer) { correct = '✅ 正確'; earned = h.score; }
                else if (a.choice) { correct = '❌ 錯誤'; }
            } else {
                earned = typeof a.earnedScore === 'number' ? a.earnedScore : 0;
                correct = earned > 0 ? '✅ 正確' : '';
                if (h.type === 'image' && a.imageUrl && imgFolder) {
                    const b64 = a.imageUrl.split(',')[1];
                    if (b64) { imgFile = `Q${qi+1}_${a.studentId}.jpg`; imgFolder.file(imgFile, b64, { base64: true }); hasImages = true; }
                }
            }
            rows.push([h.note||'', h.type==='choice'?'選擇題':h.type==='image'?'圖片題':'文字題', h.score, a.studentId||'', a.name||'', a.choice||'', a.text||'', correct, earned, imgFile]);
        }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), '課堂記錄');
    const filename = `霧臺國小_課堂記錄_${STATE.roomId||'class'}_${new Date().toISOString().slice(0,10)}`;
    if (hasImages && zip) {
        const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        zip.file(`${filename}.xlsx`, xlsxData);
        const blob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `${filename}_含圖片.zip`; a.click();
    } else { XLSX.writeFile(wb, `${filename}.xlsx`); }
    await alert('匯出成功！');
}

// ═══════════════════════════════════════════════
// 工具視窗 - 計時器
// ═══════════════════════════════════════════════
let toolTimerInterval = null, toolTimerRunning = false, toolTimerVal = 0;
function openTimerTool() {
    toolModalContent.innerHTML = `
        <div class="modal-title"><span class="material-symbols-outlined">timer</span> 計時器</div>
        <div class="timer-display" id="ttDisplay">00:00</div>
        <div class="timer-presets">
            ${[5,10,30,60,120,300].map(s => `<button class="btn btn-ghost btn-sm" data-ts="${s}">${s}s</button>`).join('')}
        </div>
        <div class="timer-controls">
            <button class="btn btn-success" id="ttStart"><span class="material-symbols-outlined">play_arrow</span> 開始</button>
            <button class="btn btn-danger" id="ttStop"><span class="material-symbols-outlined">stop</span> 暫停</button>
            <button class="btn btn-ghost" id="ttReset"><span class="material-symbols-outlined">refresh</span> 重設</button>
        </div>`;
    toolModal.classList.add('show');
    const disp = () => { const m = Math.floor(toolTimerVal/60), s = toolTimerVal%60; document.getElementById('ttDisplay').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; };
    disp();
    document.getElementById('ttStart').onclick = () => {
        if (toolTimerRunning || toolTimerVal <= 0) return;
        toolTimerRunning = true;
        toolTimerInterval = setInterval(() => { toolTimerVal--; disp(); if (toolTimerVal <= 0) { clearInterval(toolTimerInterval); toolTimerRunning = false; } }, 1000);
    };
    document.getElementById('ttStop').onclick  = () => { clearInterval(toolTimerInterval); toolTimerRunning = false; };
    document.getElementById('ttReset').onclick = () => { clearInterval(toolTimerInterval); toolTimerRunning = false; toolTimerVal = 0; disp(); };
    document.querySelectorAll('[data-ts]').forEach(btn => {
        btn.onclick = async () => {
            if (toolTimerRunning && !await window.asyncConfirm('計時中，確定重設？')) return;
            clearInterval(toolTimerInterval); toolTimerRunning = false;
            toolTimerVal = parseInt(btn.dataset.ts); disp();
        };
    });
}

// ─── 骰子 ───
function openDiceTool() {
    let history = [];
    toolModalContent.innerHTML = `
        <div class="modal-title"><span class="material-symbols-outlined">casino</span> 擲骰子</div>
        <div class="dice-display" id="ttDice">🎲</div>
        <button class="btn btn-primary btn-lg" id="ttDiceRoll"><span class="material-symbols-outlined">casino</span> 擲！</button>
        <div class="dice-history" id="ttDiceHist"></div>
        <button class="btn btn-ghost btn-sm" id="ttDiceClear" style="margin-top:8px;"><span class="material-symbols-outlined" style="font-size:15px;">delete</span> 清除紀錄</button>`;
    toolModal.classList.add('show');
    const faces = ['⚀','⚁','⚂','⚃','⚄','⚅'];
    const disp = document.getElementById('ttDice'), hist = document.getElementById('ttDiceHist');
    const roll = () => {
        disp.className = 'dice-display rolling';
        const n = Math.floor(Math.random() * 6) + 1;
        setTimeout(() => { disp.textContent = faces[n-1]; disp.className = 'dice-display'; }, 600);
        history.push(n); if (history.length > 20) history.shift();
        hist.textContent = history.map(x => faces[x-1]).join(' ');
    };
    document.getElementById('ttDiceRoll').onclick = roll;
    document.getElementById('ttDiceClear').onclick = () => { history = []; hist.textContent = ''; disp.textContent = '🎲'; };
}

// ─── 隨機點名 ───
function openPickerTool() {
    toolModalContent.innerHTML = `
        <div class="modal-title"><span class="material-symbols-outlined">person_add</span> 隨機點名</div>
        <div style="font-size:32px;font-weight:700;text-align:center;padding:16px 0;min-height:64px;" id="ttPickResult"><span style="color:var(--text-muted);">點擊下方按鈕</span></div>
        <div style="text-align:center;">
            <button class="btn btn-primary btn-lg" id="ttPickBtn"><span class="material-symbols-outlined">casino</span> 點名</button>
            <button class="btn btn-ghost" id="ttPickReset" style="margin-left:8px;"><span class="material-symbols-outlined">refresh</span> 重置</button>
        </div>`;
    toolModal.classList.add('show');
    const result = document.getElementById('ttPickResult');
    const getPool = () => {
        let pool = [];
        for (const cls of STATE.selectedClasses) pool.push(...(STATE.rosterData[cls] || []).map(s => ({ ...s })));
        return pool.filter(s => !STATE.pickerExcluded.includes(getStudentId(s)));
    };
    document.getElementById('ttPickBtn').onclick = () => {
        const pool = getPool();
        if (pool.length === 0) { result.innerHTML = '<span style="color:var(--danger);">全部同學已被點過</span>'; return; }
        const s = pool[Math.floor(Math.random() * pool.length)];
        STATE.pickerExcluded.push(getStudentId(s));
        result.innerHTML = `<span>${s.name}</span>`;
    };
    document.getElementById('ttPickReset').onclick = () => { STATE.pickerExcluded = []; result.innerHTML = '<span style="color:var(--text-muted);">點擊下方按鈕</span>'; };
}

// ─── 投票 ───
function openVoteTool() {
    let voteOptions = [], voteResults = {}, voteActive = false, votesUnsub = null;
    toolModalContent.innerHTML = `
        <div class="modal-title"><span class="material-symbols-outlined">how_to_vote</span> 即時投票</div>
        <div style="display:flex;gap:8px;margin-bottom:10px;">
            <input type="text" id="tvInput" placeholder="輸入選項..." style="flex:1;" />
            <button class="btn btn-primary btn-sm" id="tvAdd"><span class="material-symbols-outlined">add</span> 新增</button>
        </div>
        <div id="tvOptions"></div>
        <div class="btn-row" style="margin-top:10px;">
            <button class="btn btn-success" id="tvStart"><span class="material-symbols-outlined">play_arrow</span> 開始投票</button>
            <button class="btn btn-danger" id="tvStop"><span class="material-symbols-outlined">stop</span> 結束並公布</button>
            <button class="btn btn-ghost" id="tvClear"><span class="material-symbols-outlined">delete</span> 清除</button>
        </div>`;
    toolModal.classList.add('show');
    const optDiv = document.getElementById('tvOptions');
    const render = () => {
        const total = Object.values(voteResults).reduce((a,b)=>a+b,0) || 1;
        const maxV  = Math.max(...Object.values(voteResults), 0);
        optDiv.innerHTML = voteOptions.map(o => {
            const cnt = voteResults[o] || 0;
            return `<div class="vote-option"><span>${maxV>0&&cnt===maxV?'👑 ':''}${o}</span><div class="vote-bar"><div class="vote-fill" style="width:${Math.round(cnt/total*100)}%;"></div></div><span>${cnt}</span></div>`;
        }).join('') || '<div style="color:var(--text-muted);text-align:center;padding:12px;">請新增投票選項</div>';
    };
    const subscribeVotes = () => {
        if (votesUnsub) { votesUnsub(); votesUnsub = null; }
        if (!STATE.roomId) return;
        votesUnsub = onSnapshot(collection(db,'rooms',STATE.roomId,'votes'), snap => {
            const tally = {}; voteOptions.forEach(o => tally[o] = 0);
            snap.forEach(d => { const o = d.data().option; if (o) tally[o] = (tally[o]||0)+1; });
            voteResults = tally; render();
        }, e => console.warn('投票監聽失敗', e));
    };
    document.getElementById('tvAdd').onclick = () => {
        const v = document.getElementById('tvInput').value.trim();
        if (!v || voteOptions.includes(v)) return;
        voteOptions.push(v); voteResults[v] = 0;
        document.getElementById('tvInput').value = ''; render();
    };
    document.getElementById('tvStart').onclick = async () => {
        if (voteOptions.length < 2) { await alert('請新增至少 2 個選項'); return; }
        voteActive = true; voteResults = {}; voteOptions.forEach(o => voteResults[o] = 0);
        if (STATE.roomId) {
            const snap = await getDocs(collection(db,'rooms',STATE.roomId,'votes'));
            if (!snap.empty) { const b = writeBatch(db); snap.forEach(d => b.delete(d.ref)); await b.commit(); }
            await updateDoc(doc(db,'rooms',STATE.roomId), { voteActive:true, voteOptions, voteResults, voteResultsAt:null });
            subscribeVotes();
        }
        render();
    };
    document.getElementById('tvStop').onclick = async () => {
        voteActive = false;
        if (votesUnsub) { votesUnsub(); votesUnsub = null; }
        if (STATE.roomId) await updateDoc(doc(db,'rooms',STATE.roomId), { voteActive:false, voteResults, voteResultsAt:serverTimestamp() });
        render();
    };
    document.getElementById('tvClear').onclick = async () => {
        voteOptions = []; voteResults = {}; voteActive = false;
        if (votesUnsub) { votesUnsub(); votesUnsub = null; }
        if (STATE.roomId) {
            const snap = await getDocs(collection(db,'rooms',STATE.roomId,'votes'));
            if (!snap.empty) { const b = writeBatch(db); snap.forEach(d => b.delete(d.ref)); await b.commit(); }
            await updateDoc(doc(db,'rooms',STATE.roomId), { voteActive:false, voteOptions:[], voteResults:{}, voteResultsAt:null });
        }
        render();
    };
    toolModal._votesSubCleanup = () => { if (votesUnsub) { votesUnsub(); votesUnsub = null; } };
    if (STATE.roomId) {
        const unsub = onSnapshot(doc(db,'rooms',STATE.roomId), snap => {
            const d = snap.data(); if (!d) return;
            voteActive = d.voteActive || false;
            if (d.voteOptions?.length) voteOptions = d.voteOptions;
            if (voteActive) { if (!votesUnsub) subscribeVotes(); } else { if (votesUnsub) { votesUnsub(); votesUnsub = null; } if (d.voteResults) { voteResults = d.voteResults; render(); } }
        }, e => console.warn('投票工具房間監聽失敗', e));
        toolModal._voteUnsub = unsub;
        if (voteActive) subscribeVotes();
    }
    render();
}

// ─── 分組計分 ───
function openGroupTool() {
    // 關閉浮窗點選事件來自 groupFloat，這裡只負責開工具視窗
    let groups = [...(STATE.groups || [])], scores = { ...( STATE.groupScores || {}) };
    const render = () => {
        const grid = document.getElementById('tgGrid');
        if (!grid) return; // 工具視窗已關閉，跳過 render
        const maxScore = Math.max(...groups.map(g => scores[g]||0), 0);
        grid.innerHTML = groups.map(g => {
            const s = scores[g] || 0, isTop = maxScore > 0 && s === maxScore;
            return `<div class="group-card">
                ${isTop ? '<span class="group-crown">👑</span>' : ''}
                <div class="group-name">${g}</div>
                <div class="group-score">${s}</div>
                <div class="group-controls">
                    <button class="btn btn-success btn-sm" data-g="${g}" data-d="1">＋</button>
                    <button class="btn btn-danger btn-sm" data-g="${g}" data-d="-1">－</button>
                </div>
            </div>`;
        }).join('') || '<div style="color:var(--text-muted);text-align:center;padding:12px;">尚未建立分組</div>';
        document.querySelectorAll('[data-g][data-d]').forEach(btn => {
            btn.addEventListener('click', () => {
                const g = btn.dataset.g, delta = parseInt(btn.dataset.d);
                scores[g] = Math.max(0, (scores[g]||0) + delta);
                STATE.groups = groups; STATE.groupScores = scores;
                // 只有在有教室的情況下才寫入 Firebase
                if (STATE.roomId) {
                    clearTimeout(window._groupSync);
                    window._groupSync = setTimeout(() => {
                        updateDoc(doc(db,'rooms',STATE.roomId), { groups, groupScores: scores }).catch(()=>{});
                    }, 500);
                }
                render(); updateGroupFloat();
            });
        });
        updateGroupFloat();
    };
    const updateGroupFloat = () => {
        if (!STATE.groupFloatVisible || groups.length === 0) { groupFloat.classList.remove('show'); groupFloat.style.display = 'none'; return; }
        const maxScore = Math.max(...groups.map(g => scores[g]||0), 0);
        // 現代分隔符設計：每組之間用細線 | 隔開，最高分顯示皇冠
        const items = groups.map(g => {
            const s = scores[g] || 0;
            const crown = maxScore > 0 && s === maxScore ? '👑 ' : '';
            return `<span style="display:inline-flex;align-items:center;gap:5px;padding:0 14px;font-weight:700;">${crown}<span style="color:var(--text-secondary);font-weight:500;">${g}</span><span style="font-size:20px;color:var(--primary);">${s}</span></span>`;
        });
        groupFloat.innerHTML = items.join('<span style="color:rgba(0,0,0,0.15);font-size:18px;user-select:none;">│</span>');
        groupFloat.style.display = 'flex'; groupFloat.style.alignItems = 'center';
        groupFloat.classList.add('show');
    };
    toolModalContent.innerHTML = `
        <div class="modal-title"><span class="material-symbols-outlined">group</span> 分組計分</div>
        <div style="display:flex;gap:8px;margin-bottom:10px;">
            <input type="text" id="tgInput" placeholder="輸入組名..." style="flex:1;" />
            <button class="btn btn-primary btn-sm" id="tgAdd"><span class="material-symbols-outlined">add</span> 新增</button>
        </div>
        <div class="group-grid" id="tgGrid"></div>
        <div class="btn-row" style="margin-top:10px;justify-content:space-between;">
            <div style="display:flex;gap:6px;">
                <button class="btn btn-ghost btn-sm" id="tgReset"><span class="material-symbols-outlined" style="font-size:15px;">refresh</span> 歸零</button>
                <button class="btn btn-danger btn-sm" id="tgDelete"><span class="material-symbols-outlined" style="font-size:15px;">delete</span> 刪除全部</button>
            </div>
            <button class="btn btn-primary" id="tgShow">顯示浮動計分板</button>
        </div>`;
    toolModal.classList.add('show');
    render();
    document.getElementById('tgAdd').onclick = () => {
        const v = document.getElementById('tgInput').value.trim();
        if (!v || groups.includes(v)) return;
        groups.push(v); scores[v] = 0;
        document.getElementById('tgInput').value = '';
        STATE.groups = groups; STATE.groupScores = scores;
        if (STATE.roomId) updateDoc(doc(db,'rooms',STATE.roomId), { groups, groupScores: scores }).catch(() => {});
        render();
    };
    document.getElementById('tgReset').onclick = async () => {
        if (!await window.asyncConfirm('確定歸零所有組別分數？')) return;
        groups.forEach(g => scores[g] = 0); STATE.groupScores = scores;
        if (STATE.roomId) updateDoc(doc(db,'rooms',STATE.roomId), { groupScores: scores }).catch(() => {}); render();
    };
    document.getElementById('tgDelete').onclick = async () => {
        if (!await window.asyncConfirm('確定刪除所有分組？')) return;
        groups = []; scores = {}; STATE.groups = []; STATE.groupScores = {}; STATE.groupFloatVisible = false;
        groupFloat.classList.remove('show'); groupFloat.style.display = 'none';
        if (STATE.roomId) updateDoc(doc(db,'rooms',STATE.roomId), { groups:[], groupScores:{} }).catch(() => {}); render();
    };
    document.getElementById('tgShow').onclick = () => {
        STATE.groupFloatVisible = true; updateGroupFloat(); toolModal.classList.remove('show');
    };
    if (STATE.roomId) {
        const unsub = onSnapshot(doc(db,'rooms',STATE.roomId), snap => {
            const d = snap.data(); if (!d) return;
            if (d.groups) { groups = d.groups; STATE.groups = groups; }
            if (d.groupScores) { scores = d.groupScores; STATE.groupScores = scores; }
            render(); // render() 內有 null check，關閉後不會出錯
        }, e => console.warn('分組工具房間監聽失敗', e));
        toolModal._groupUnsub = unsub;
    }
}

// ─── 搶答 ───
function openBuzzTool() {
    if (STATE.buzzUnsubscribe) { STATE.buzzUnsubscribe(); STATE.buzzUnsubscribe = null; }
    let buzzSecs = STATE.buzzCountdown || 5, buzzInterval = null;
    toolModalContent.innerHTML = `
        <div class="modal-title"><span class="material-symbols-outlined">bolt</span> 搶答</div>
        <div id="tbSetup">
            <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin:16px 0;">
                <button class="btn btn-ghost btn-sm" id="tbMinus">－</button>
                <span style="font-size:40px;font-weight:800;" id="tbSecs">${buzzSecs}</span>
                <button class="btn btn-ghost btn-sm" id="tbPlus">＋</button>
                <span>秒</span>
            </div>
            <div style="text-align:center;">
                <button class="btn btn-success btn-lg" id="tbStart"><span class="material-symbols-outlined">play_arrow</span> 開始搶答</button>
            </div>
        </div>
        <div id="tbCountdown" style="display:none;">
            <div class="timer-display" id="tbCountdownDisp">${buzzSecs}</div>
            <div style="text-align:center;color:var(--text-secondary);">倒數中，歸零後學生可搶答</div>
        </div>
        <div id="tbResult" style="display:none;">
            <div style="font-weight:700;margin-bottom:8px;">🎯 搶答結果（反應最快前30名）：</div>
            <div id="tbResultList" style="max-height:220px;overflow-y:auto;"></div>
        </div>
        <div class="btn-row" style="justify-content:center;margin-top:14px;">
            <button class="btn btn-ghost btn-sm" id="tbReset" style="display:none;"><span class="material-symbols-outlined">refresh</span> 再來一輪</button>
            <button class="btn btn-ghost btn-sm" id="tbClose"><span class="material-symbols-outlined">close</span> 關閉</button>
        </div>`;
    toolModal.classList.add('show');
    const setup = document.getElementById('tbSetup');
    const countdown = document.getElementById('tbCountdown');
    const result = document.getElementById('tbResult');
    const countdownDisp = document.getElementById('tbCountdownDisp');
    const resultList = document.getElementById('tbResultList');
    const resetBtn = document.getElementById('tbReset');

    const startResultListener = () => {
        if (STATE.buzzUnsubscribe) { STATE.buzzUnsubscribe(); STATE.buzzUnsubscribe = null; }
        STATE.buzzUnsubscribe = onSnapshot(
            query(collection(db,'rooms',STATE.roomId,'buzzes'), orderBy('timestamp','asc'), limit(30)),
            snap => {
                resultList.innerHTML = '';
                let rank = 1;
                snap.forEach(d => {
                    const name = d.data().name;
                    if (rank === 1) {
                        resultList.innerHTML += `<div class="buzz-first-result"><div class="medal">🥇</div><div class="name">${name}</div></div>`;
                    } else {
                        const medal = rank <= 3 ? ['','🥇','🥈','🥉'][rank] : `${rank}`;
                        resultList.innerHTML += `<div class="buzz-other-result">${medal} ${name}</div>`;
                    }
                    rank++;
                });
                if (snap.empty) resultList.innerHTML = '<div style="color:var(--text-muted);text-align:center;">等待學生搶答...</div>';
            }, e => console.warn('搶答監聽失敗', e)
        );
    };

    // 若搶答仍在進行（重新打開工具視窗時）
    if (STATE.buzzActive) { setup.style.display='none'; countdown.style.display='none'; result.style.display='block'; resetBtn.style.display='inline-flex'; startResultListener(); }

    document.getElementById('tbMinus').onclick = () => { if (buzzSecs > 1) { buzzSecs--; document.getElementById('tbSecs').textContent = buzzSecs; } };
    document.getElementById('tbPlus').onclick  = () => { if (buzzSecs < 30) { buzzSecs++; document.getElementById('tbSecs').textContent = buzzSecs; } };
    document.getElementById('tbStart').onclick = async () => {
        STATE.buzzCountdown = buzzSecs; STATE.buzzActive = true;
        await updateDoc(doc(db,'rooms',STATE.roomId), { buzzActive:true, buzzCountdown:buzzSecs });
        setup.style.display = 'none'; countdown.style.display = 'block'; countdownDisp.textContent = buzzSecs;
        // 立即開始監聽（不等倒數結束），這樣老師從第一秒就能看到誰按了
        startResultListener();
        let remain = buzzSecs;
        buzzInterval = setInterval(() => {
            remain--; countdownDisp.textContent = remain;
            if (remain <= 0) {
                clearInterval(buzzInterval);
                countdown.style.display = 'none'; result.style.display = 'block'; resetBtn.style.display = 'inline-flex';
                // 注意：不設 buzzActive=false，倒數結束後學生端的搶答鈕才變亮，要保持開啟讓學生按
            }
        }, 1000);
    };
    resetBtn.onclick = async () => {
        if (STATE.buzzUnsubscribe) { STATE.buzzUnsubscribe(); STATE.buzzUnsubscribe = null; }
        const snap = await getDocs(collection(db,'rooms',STATE.roomId,'buzzes'));
        if (!snap.empty) { const b = writeBatch(db); snap.forEach(d => b.delete(d.ref)); await b.commit(); }
        await updateDoc(doc(db,'rooms',STATE.roomId), { buzzActive:false });
        STATE.buzzActive = false; buzzSecs = 5;
        document.getElementById('tbSecs').textContent = buzzSecs;
        setup.style.display='block'; countdown.style.display='none'; result.style.display='none'; resetBtn.style.display='none';
        countdownDisp.textContent = buzzSecs;
    };
    document.getElementById('tbClose').onclick = () => {
        if (buzzInterval) clearInterval(buzzInterval);
        if (STATE.buzzActive) { updateDoc(doc(db,'rooms',STATE.roomId), { buzzActive:false }).catch(()=>{}); STATE.buzzActive = false; }
        if (STATE.buzzUnsubscribe) { STATE.buzzUnsubscribe(); STATE.buzzUnsubscribe = null; }
        toolModal.classList.remove('show');
    };
}

// ═══════════════════════════════════════════════
// 事件綁定
// ═══════════════════════════════════════════════
btnCreateRoom.addEventListener('click', createRoom);
customClassCheckbox.addEventListener('change', function() { customStudentCount.disabled = !this.checked; STATE.customClassEnabled = this.checked; });
publishBtn.addEventListener('click', publishQuestion);
startStopBtn.addEventListener('click', toggleStartStop);
if (startStopBtn2) startStopBtn2.addEventListener('click', toggleStartStop);
if (extendTimeBtn2) extendTimeBtn2.addEventListener('click', () => {
    if (STATE.flowState === 'answering') {
        STATE.currentTimerVal += 10;
        syncTimerDisplays(STATE.currentTimerVal);
    }
});
extendTimeBtn.addEventListener('click', () => {
    if (STATE.flowState === 'answering') { STATE.currentTimerVal += 10; timerLargeDisplay.textContent = STATE.currentTimerVal; timerLargeDisplay.className = 'timer-large'; }
});
sortByTimeCheck.addEventListener('change', () => { STATE.sortByTime = sortByTimeCheck.checked; renderCards(); });
gotoPage3Btn.addEventListener('click', () => goToPage(3));
gotoPage4Btn.addEventListener('click', async () => {
    if (STATE.roomId) {
        const snap = await getDoc(doc(db,'rooms',STATE.roomId));
        const d = snap.data();
        if (d?.revealedAnswer) { STATE.correctAnswer = d.revealedAnswer; STATE.isRevealed = true; }
    }
    if (STATE.questionType !== 'choice') {
        choiceRevealArea.classList.add('hidden'); textGradingArea.classList.remove('hidden');
        page4Subtitle.textContent = STATE.questionType === 'image' ? '檢視學生作品並給分' : '批改文字作答';
        renderTextGrading();
    } else {
        choiceRevealArea.classList.remove('hidden'); textGradingArea.classList.add('hidden');
        page4Subtitle.textContent = '公布正確答案';
        renderChoiceResultCards();
    }
    goToPage(4);
});
gotoPage5Btn.addEventListener('click', () => { updateRankList(); goToPage(5); });
clearNextBtn.addEventListener('click', clearAndNextQuestion);
backToPage2Btn.addEventListener('click', clearAndNextQuestion);
clearAllBtn.addEventListener('click', async () => {
    if (!await window.asyncConfirm('確定清除所有紀錄（含累計得分）？')) return;
    STATE.history = []; STATE.cumulativeScores = {}; STATE.roundAwarded = {};
    if (STATE.roomId) updateDoc(doc(db,'rooms',STATE.roomId), { cumulativeScores: {} }).catch(() => {});
    updateRankList();
    await alert('已清除所有記錄');
});
document.querySelectorAll('[data-answer]').forEach(btn => {
    btn.addEventListener('click', () => revealAnswer(btn.dataset.answer));
});
hideAnswerBtn.addEventListener('click', hideAnswer);
viewTextAnswersBtn.addEventListener('click', () => { if (!gotoPage4Btn.disabled) gotoPage4Btn.click(); });
exportExcelBtn.addEventListener('click', exportExcel);

// Dock
dockToggle.addEventListener('click', () => {
    floatingDock.classList.toggle('collapsed');
    dockToggle.querySelector('.material-symbols-outlined').textContent = floatingDock.classList.contains('collapsed') ? 'more_horiz' : 'close';
});
document.getElementById('dockQR').addEventListener('click', () => openQR());
document.getElementById('dockBroadcast').addEventListener('click', () => {
    if (!STATE.roomId) { alert('請先建立教室'); return; }
    broadcastModal.classList.add('show'); broadcastInput.focus();
});
document.getElementById('dockLockScreen').addEventListener('click', () => { if (!STATE.roomId) { alert('請先建立教室'); return; } toggleLockScreen(); });
document.getElementById('dockTimer').addEventListener('click', () => openTimerTool());
document.getElementById('dockDice').addEventListener('click', () => openDiceTool());
document.getElementById('dockPicker').addEventListener('click', () => { if (!STATE.roomId) { alert('請先建立教室'); return; } openPickerTool(); });
document.getElementById('dockVote').addEventListener('click', () => { if (!STATE.roomId) { alert('請先建立教室'); return; } openVoteTool(); });
document.getElementById('dockGroup').addEventListener('click', () => openGroupTool());
document.getElementById('dockBuzz').addEventListener('click', () => { if (!STATE.roomId) { alert('請先建立教室'); return; } openBuzzTool(); });

// 廣播頁2按鈕
broadcastBtn2.addEventListener('click', () => {
    if (!STATE.roomId) { alert('請先建立教室'); return; }
    broadcastModal.classList.add('show'); broadcastInput.focus();
});
broadcastCancel.addEventListener('click', () => broadcastModal.classList.remove('show'));
broadcastSend.addEventListener('click', sendBroadcast);
broadcastModal.addEventListener('click', e => { if (e.target === broadcastModal) broadcastModal.classList.remove('show'); });

// QR 關閉
function closeQRModal() {
        qrModal.classList.remove('show');
        if (window._qrStudentsUnsub) { window._qrStudentsUnsub(); window._qrStudentsUnsub = null; }
    }
    qrModalClose.addEventListener('click', closeQRModal);
    qrModal.addEventListener('click', e => { if (e.target === qrModal) closeQRModal(); });

// 工具彈窗關閉
toolModal.addEventListener('click', e => {
    if (e.target !== toolModal) return;
    toolModal.classList.remove('show');
    if (toolModal._voteUnsub) { toolModal._voteUnsub(); toolModal._voteUnsub = null; }
    if (toolModal._votesSubCleanup) { toolModal._votesSubCleanup(); toolModal._votesSubCleanup = null; }
    if (toolModal._groupUnsub) { toolModal._groupUnsub(); toolModal._groupUnsub = null; }
    if (toolTimerInterval) { clearInterval(toolTimerInterval); toolTimerRunning = false; }
});

// 分組浮窗：可拖曳 + 點擊打開工具視窗
(function setupGroupFloatDrag() {
    let isDragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0;
    groupFloat.addEventListener('pointerdown', e => {
        // 初始化絕對位置（從 transform 置中改為 px 定位）
        const rect = groupFloat.getBoundingClientRect();
        if (!groupFloat.dataset.positioned) {
            groupFloat.style.left   = rect.left + 'px';
            groupFloat.style.top    = rect.top  + 'px';
            groupFloat.style.bottom = 'auto';
            groupFloat.style.transform = 'none';
            groupFloat.dataset.positioned = '1';
        }
        isDragging = false; // reset, decide on move
        startX = e.clientX; startY = e.clientY;
        origLeft = parseFloat(groupFloat.style.left) || rect.left;
        origTop  = parseFloat(groupFloat.style.top)  || rect.top;
        groupFloat.setPointerCapture(e.pointerId);
    });
    groupFloat.addEventListener('pointermove', e => {
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (!isDragging && Math.abs(dx) + Math.abs(dy) > 4) {
            isDragging = true;
            groupFloat.classList.add('dragging');
        }
        if (isDragging) {
            groupFloat.style.left = Math.max(0, Math.min(window.innerWidth - groupFloat.offsetWidth, origLeft + dx)) + 'px';
            groupFloat.style.top  = Math.max(0, Math.min(window.innerHeight - groupFloat.offsetHeight, origTop + dy)) + 'px';
        }
    });
    groupFloat.addEventListener('pointerup', e => {
        if (!isDragging) {
            // 短點擊 → 打開工具視窗
            if (STATE.roomId) { openGroupTool(); toolModal.classList.add('show'); }
        }
        isDragging = false;
        groupFloat.classList.remove('dragging');
    });
})();

// ─── 管理者密碼（秘密功能） ───
let adminClickCount = 0, adminTimer = null;
document.querySelector('.brand').addEventListener('click', async () => {
    adminClickCount++;
    clearTimeout(adminTimer);
    adminTimer = setTimeout(() => adminClickCount = 0, 3000);
    if (adminClickCount >= 5) {
        adminClickCount = 0;
        const pw = await window.asyncPrompt('請輸入管理密碼：');
        if (pw === 'wt7902230') {
            if (await window.asyncConfirm('確定清除所有 Firebase 房間嗎？')) {
                try {
                    const snap = await getDocs(collection(db, 'rooms'));
                    for (const d of snap.docs) await deleteRoom(d.id);
                    await alert(`✅ 已清除 ${snap.size} 個房間`);
                } catch(e) { await alert('❌ 清除失敗：' + e.message); }
            }
        } else if (pw !== null) { await alert('密碼錯誤'); }
    }
});

// ═══════════════════════════════════════════════
// 過期房間自動清理
// ═══════════════════════════════════════════════
async function cleanupExpiredRooms() {
    try {
        const snap = await getDocs(collection(db, 'rooms'));
        const now = new Date();
        for (const d of snap.docs) {
            const data = d.data();
            if (data.expireAt && new Date(data.expireAt) < now) { await deleteRoom(d.id); }
        }
    } catch(e) { console.warn('自動清理失敗', e); }
}
setTimeout(cleanupExpiredRooms, 5000);
setInterval(cleanupExpiredRooms, 3600000);

// ═══════════════════════════════════════════════
// 初始化
// ═══════════════════════════════════════════════
async function init() {
    goToPage(1);
    await loadRoster();
    updateNavButtons(); updateFlowButtons(); applyI18n();
    applyAutoSkin();
    console.log('🚀 霧臺國小虛擬教室 v5.0 已啟動');
}
init();
