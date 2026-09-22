// ============================================================
// Tool 2 - 學生端繪圖功能 (tldraw 整合)
// 功能：動態載入 tldraw、底圖載入（支援 PNG/JPG/PDF/HEIC）、
//       繪圖、匯出 PNG、上傳 Storage、送出答案
// ============================================================

// ----- 1. 依賴載入 -----
// 注意：PDF.js 與 HEIC 轉換器會在需要時動態載入

// ----- 2. 狀態 -----
let tldrawEditor = null;
let tldrawContainer = null;
let bgShapeId = null;
let isSubmitting = false;
let isLocked = false;

// ----- 3. DOM 工具函式 -----
function getEl(id) {
    const el = document.getElementById(id);
    if (!el) console.warn(`Element not found: ${id}`);
    return el;
}

function setStatus(msg, type = 'info') {
    const statusEl = getEl('studentStatusMessage');
    if (statusEl) {
        statusEl.textContent = msg;
        statusEl.className = 'exam-status ' + type;
    }
}

// ----- 4. 動態載入 PDF.js (僅在需要時載入) -----
async function loadPDFJS() {
    if (window.pdfjsLib) return window.pdfjsLib;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            // 設定 worker
            if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve(window.pdfjsLib);
            } else {
                reject(new Error('PDF.js 載入失敗'));
            }
        };
        script.onerror = () => reject(new Error('PDF.js 載入失敗'));
        document.head.appendChild(script);
    });
}

// ----- 5. 動態載入 HEIC 轉換器 (僅在需要時載入) -----
async function loadHEICConverter() {
    if (window.heic2any) return window.heic2any;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.1.0/heic2any.min.js';
        script.onload = () => {
            if (window.heic2any) {
                resolve(window.heic2any);
            } else {
                reject(new Error('HEIC 轉換器載入失敗'));
            }
        };
        script.onerror = () => reject(new Error('HEIC 轉換器載入失敗'));
        document.head.appendChild(script);
    });
}

// ----- 6. 將圖片轉為 DataURL (支援各種格式) -----
async function imageToDataURL(imageUrl) {
    // 檢查檔案格式
    const lowerUrl = imageUrl.toLowerCase();

    // --- 處理 PDF ---
    if (lowerUrl.endsWith('.pdf') || lowerUrl.includes('.pdf?')) {
        try {
            const pdfjsLib = await loadPDFJS();
            const pdf = await pdfjsLib.getDocument(imageUrl).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            return canvas.toDataURL('image/png');
        } catch (e) {
            console.error('PDF 轉換失敗', e);
            throw new Error('PDF 轉換失敗：' + e.message);
        }
    }

    // --- 處理 HEIC ---
    if (lowerUrl.endsWith('.heic') || lowerUrl.endsWith('.heif') ||
        lowerUrl.includes('.heic?') || lowerUrl.includes('.heif?')) {
        try {
            const heic2any = await loadHEICConverter();
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const result = await heic2any({ blob, toType: 'image/jpeg' });
            const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(result);
            });
            return dataUrl;
        } catch (e) {
            console.error('HEIC 轉換失敗', e);
            throw new Error('HEIC 轉換失敗：' + e.message);
        }
    }

    // --- 一般圖片 (PNG/JPG/WebP/GIF/BMP/SVG) ---
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('讀取圖片失敗'));
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error('圖片載入失敗', e);
        throw new Error('圖片載入失敗：' + e.message);
    }
}

// ----- 7. 載入 tldraw (動態) -----
async function loadTldraw() {
    if (typeof window.Tldraw !== 'undefined') return;

    // 載入 CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/tldraw@2/tldraw.css';
    document.head.appendChild(link);

    // 載入 React 與 tldraw (使用 importmap)
    // 注意：這需要在 HTML 中先定義 importmap
    // 我們會在 student.html 中加上 importmap
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
            import React from 'react';
            import { createRoot } from 'react-dom/client';
            import { Tldraw, useEditor } from 'tldraw';

            window._tldrawModules = { React, createRoot, Tldraw, useEditor };
            window._tldrawLoaded = true;
            console.log('✅ tldraw 已透過 dynamic import 載入');
        `;
        script.onload = () => {
            // 等待模組載入完成
            const check = () => {
                if (window._tldrawLoaded) {
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        };
        script.onerror = () => reject(new Error('tldraw 載入失敗'));
        document.body.appendChild(script);
    });
}

// ----- 8. 初始化 tldraw 畫布 -----
async function initTldrawCanvas(containerId, imageUrl, onReady) {
    const container = document.getElementById(containerId);
    if (!container) {
        throw new Error('容器不存在: ' + containerId);
    }
    tldrawContainer = container;

    // 載入 tldraw
    await loadTldraw();

    // 使用 importmap 載入的 React 與 tldraw
    const { React, createRoot, Tldraw, useEditor } = window._tldrawModules;

    // 建立渲染用的容器
    const rootElement = document.createElement('div');
    rootElement.id = 'tldraw-root';
    rootElement.style.cssText = 'width:100%;height:100%;';
    container.appendChild(rootElement);

    // 建立 App 元件
    function App({ onMount }) {
        const editor = useEditor();

        React.useEffect(() => {
            if (editor && onMount) {
                onMount(editor);
            }
        }, [editor]);

        return React.createElement(Tldraw, { onMount: (editor) => {
            if (onMount) onMount(editor);
        }});
    }

    // 渲染
    const root = createRoot(rootElement);
    root.render(React.createElement(App, { onMount: async (editor) => {
        tldrawEditor = editor;

        // 如果有圖片 URL，載入底圖
        if (imageUrl) {
            try {
                await loadBackgroundImage(editor, imageUrl);
                setStatus('✅ 底圖已載入，請開始繪圖', 'ready');
            } catch (e) {
                console.error('載入底圖失敗', e);
                setStatus('⚠️ 底圖載入失敗：' + e.message, 'error');
                // 仍可繪圖（空白畫布）
            }
        } else {
            setStatus('✏️ 請在畫布上繪圖', 'ready');
        }

        if (onReady) onReady(editor);
    }}));

    // 等待 editor 初始化
    return new Promise((resolve) => {
        const check = () => {
            if (tldrawEditor) {
                resolve(tldrawEditor);
            } else {
                setTimeout(check, 200);
            }
        };
        check();
    });
}

// ----- 9. 載入底圖 (支援各種格式 + 鎖定) -----
async function loadBackgroundImage(editor, imageUrl) {
    if (!editor) throw new Error('Editor 未初始化');

    // 1. 轉為 DataURL
    const dataUrl = await imageToDataURL(imageUrl);

    // 2. 取得圖片尺寸
    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('圖片解析失敗'));
    });

    const w = img.width;
    const h = img.height;

    // 3. 計算縮放比例 (讓圖片完整顯示在畫布中)
    const viewport = editor.getViewportScreenBounds();
    const scale = Math.min(
        (viewport.width - 40) / w,
        (viewport.height - 40) / h,
        1 // 圖片小於畫布時不放大
    );

    const displayWidth = w * scale;
    const displayHeight = h * scale;

    // 4. 建立 Asset
    const assetId = editor.createAsset({
        type: 'image',
        props: {
            name: '底圖',
            src: dataUrl,
            w: displayWidth,
            h: displayHeight,
        },
    });

    // 5. 建立形狀 (置中)
    const shapeId = editor.createShape({
        type: 'image',
        x: (viewport.width - displayWidth) / 2,
        y: (viewport.height - displayHeight) / 2,
        props: {
            assetId: assetId,
            w: displayWidth,
            h: displayHeight,
        },
    });

    // 6. 鎖定底圖 (防止學生移動或刪除)
    editor.updateShape({
        id: shapeId,
        type: 'image',
        isLocked: true,
    });

    bgShapeId = shapeId;
    console.log('✅ 底圖已載入並鎖定', { w, h, displayWidth, displayHeight });
}

// ----- 10. 匯出 PNG -----
async function exportTldrawImage(editor) {
    if (!editor) throw new Error('Editor 未初始化');
    try {
        const blob = await editor.exportAs('png', {
            format: 'png',
            quality: 1,
            includeBackground: true,
        });
        return blob;
    } catch (e) {
        console.error('匯出失敗', e);
        throw new Error('匯出圖片失敗：' + e.message);
    }
}

// ----- 11. 上傳至 Firebase Storage -----
async function uploadStudentImage(blob, roomId, roundId, studentId) {
    // 使用 firebase.storage()
    const storage = firebase.storage();
    const imageRef = storage.ref(`students/${roomId}/${roundId}/${studentId}.png`);
    try {
        const snapshot = await imageRef.put(blob);
        const downloadURL = await snapshot.ref.getDownloadURL();
        return downloadURL;
    } catch (e) {
        console.error('上傳失敗', e);
        throw new Error('上傳圖片失敗：' + e.message);
    }
}

// ----- 12. 送出答案 -----
async function submitImageAnswer(roomId, roundId, studentId, studentName) {
    if (isSubmitting) return;
    if (!tldrawEditor) {
        setStatus('⚠️ 繪圖工具尚未準備好', 'error');
        return;
    }
    if (isLocked) {
        setStatus('🔒 已送出，無法修改', 'locked');
        return;
    }

    isSubmitting = true;
    try {
        setStatus('📤 正在送出...', 'loading');

        // 1. 匯出 PNG
        const blob = await exportTldrawImage(tldrawEditor);

        // 2. 上傳至 Storage
        const imageUrl = await uploadStudentImage(blob, roomId, roundId, studentId);

        // 3. 寫入 Firestore
        const db = firebase.firestore();
        const ansRef = db.doc(`rooms/${roomId}/answers/${studentId}`);
        await ansRef.set({
            studentId: studentId,
            name: studentName,
            roundId: roundId,
            imageUrl: imageUrl,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });

        // 4. 鎖定畫布
        isLocked = true;
        if (tldrawEditor) {
            // 設為唯讀 (tldraw 可以設定 readonly)
            // 注意：tldraw 的 readonly 可能需要額外設定
            // 這裡我們透過 UI 層來防止進一步操作
        }

        setStatus('✅ 已成功送出！', 'ready');
        return imageUrl;

    } catch (e) {
        console.error('送出失敗', e);
        setStatus('❌ 送出失敗：' + e.message, 'error');
        throw e;
    } finally {
        isSubmitting = false;
    }
}

// ----- 13. 重置畫布 (清除畫記，保留底圖) -----
function clearDrawings(editor) {
    if (!editor) return;
    try {
        const shapes = editor.getShapes();
        const toDelete = shapes.filter(s => s.id !== bgShapeId);
        if (toDelete.length > 0) {
            editor.deleteShapes(toDelete.map(s => s.id));
        }
        return toDelete.length;
    } catch (e) {
        console.warn('清除畫記失敗', e);
        return 0;
    }
}

// ----- 14. 監聽教師指令 (圖片題專用) -----
function listenImageTeacherCommands(roomId, onImageUpdate, onFocus) {
    const db = firebase.firestore();
    const roomRef = db.doc(`rooms/${roomId}`);

    return roomRef.onSnapshot((snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        // 檢查是否有新的圖片題
        if (data.questionType === 'image' && data.questionImageUrl) {
            onImageUpdate(data.questionImageUrl, data.currentRoundId);
        }

        // 檢查教師廣播 (teacherFocus)
        if (data.teacherFocus) {
            onFocus(data.teacherFocus);
        }
    }, (err) => {
        console.warn('監聽教師指令失敗', err);
    });
}

// ----- 15. 顯示廣播 Modal -----
function showBroadcastModal(imageUrl) {
    // 檢查是否已有 Modal
    let modal = document.getElementById('broadcastModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'broadcastModal';
        modal.style.cssText = `
            position: fixed; top:0; left:0; right:0; bottom:0;
            background: rgba(0,0,0,0.85);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            cursor: pointer;
            backdrop-filter: blur(4px);
        `;
        modal.innerHTML = `
            <div style="max-width:95%; max-height:95%; position:relative;">
                <img id="broadcastImage" src="" style="max-width:100%; max-height:90vh; border-radius:16px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); object-fit:contain;" />
                <p style="color:#8899aa; text-align:center; margin-top:12px; font-size:14px;">👆 點擊任意處關閉</p>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    const img = document.getElementById('broadcastImage');
    if (img) {
        img.src = imageUrl;
        modal.style.display = 'flex';
        // 10 秒後自動關閉
        clearTimeout(modal._timeout);
        modal._timeout = setTimeout(() => {
            modal.style.display = 'none';
        }, 10000);
    }
}

// ============================================================
// 匯出供主程式呼叫的 API
// ============================================================
export {
    // 核心
    initTldrawCanvas,
    loadBackgroundImage,
    exportTldrawImage,
    submitImageAnswer,
    clearDrawings,

    // 監聽
    listenImageTeacherCommands,
    showBroadcastModal,

    // 狀態
    getEditor: () => tldrawEditor,
    isLocked: () => isLocked,
    setLocked: (val) => { isLocked = val; },

    // 輔助
    imageToDataURL,
};
