// ============================================================
// Tool 2 - 教師端繪圖功能
// 功能：圖片上傳、九宮格監控、同步廣播、JSZip 打包
// ============================================================

// ----- 1. 上傳圖片至 Firebase Storage -----
async function uploadQuestionImage(file, roomId, roundId, teacherName) {
    const storage = firebase.storage();
    const imageRef = storage.ref(`teachers/${teacherName}/${roomId}/question_${roundId}.png`);
    try {
        const snapshot = await imageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        return downloadURL;
    } catch (e) {
        console.error('上傳圖片失敗', e);
        throw new Error('上傳圖片失敗：' + e.message);
    }
}

// ----- 2. 發布圖片題 -----
async function publishImageQuestion(roomId, roundId, imageUrl, note, timerSeconds) {
    const db = firebase.firestore();
    const roomRef = db.doc(`rooms/${roomId}`);
    await roomRef.update({
        currentRoundId: roundId,
        questionType: 'image',
        questionImageUrl: imageUrl,
        questionNote: note || '圖片題',
        isAnswering: false,
        timerSeconds: timerSeconds || 30,
        revealedAnswer: null,
        clearAll: true,
        specifiedStudents: [],
        teacherFocus: null,
    });
    // 等待清除完成
    await new Promise(resolve => setTimeout(resolve, 300));
    await roomRef.update({ clearAll: false });
}

// ----- 3. 監聽學生圖片答案（九宮格）-----
function listenImageAnswers(roomId, roundId, onUpdate) {
    const db = firebase.firestore();
    const q = db.collection(`rooms/${roomId}/answers`)
        .where('roundId', '==', roundId)
        .where('imageUrl', '!=', null);

    return q.onSnapshot((snapshot) => {
        const results = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            results.push({
                studentId: data.studentId,
                name: data.name || data.studentId,
                imageUrl: data.imageUrl,
                timestamp: data.timestamp?.toDate?.() || new Date(),
            });
        });
        // 依座號排序
        results.sort((a, b) => a.studentId.localeCompare(b.studentId));
        onUpdate(results);
    }, (err) => {
        console.warn('監聽圖片答案失敗', err);
    });
}

// ----- 4. 同步廣播（教師點選縮圖）-----
async function setTeacherFocus(roomId, imageUrl) {
    const db = firebase.firestore();
    const roomRef = db.doc(`rooms/${roomId}`);
    await roomRef.update({ teacherFocus: imageUrl || null });
}

// ----- 5. JSZip 打包下載（成績 + 所有圖片）-----
async function downloadAllWithImages(roomId, history, studentImages, teacherName) {
    try {
        // 動態載入 JSZip
        if (typeof window.JSZip === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                script.onload = resolve;
                script.onerror = () => reject(new Error('JSZip 載入失敗'));
                document.head.appendChild(script);
            });
        }

        const JSZip = window.JSZip;
        const zip = new JSZip();

        // 1. 生成 Excel 成績表
        const excelData = generateExcelData(history);
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        XLSX.utils.book_append_sheet(wb, ws, '成績表');
        const excelBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        zip.file(`成績表_${roomId}.xlsx`, excelBuffer);

        // 2. 加入所有學生圖片
        const imageFolder = zip.folder('學生圖片');
        let successCount = 0;
        for (const item of studentImages) {
            if (!item.imageUrl) continue;
            try {
                const response = await fetch(item.imageUrl);
                if (!response.ok) continue;
                const blob = await response.blob();
                const ext = blob.type.split('/')[1] || 'png';
                const fileName = `${item.studentId}_${item.name}.${ext}`;
                imageFolder.file(fileName, blob);
                successCount++;
            } catch (e) {
                console.warn('下載圖片失敗', item.studentId, e);
            }
        }

        // 3. 下載 ZIP
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `課堂記錄_${roomId}_${new Date().toISOString().slice(0,10)}.zip`;
        link.click();
        URL.revokeObjectURL(link.href);

        return { success: true, imageCount: successCount };
    } catch (e) {
        console.error('打包下載失敗', e);
        throw new Error('打包下載失敗：' + e.message);
    }
}

// ----- 6. 生成 Excel 資料（輔助函式）-----
function generateExcelData(history) {
    const rows = [
        ['題號', '題型', '題目批註', '配分', '座號', '姓名', '作答選項', '文字答案', '是否正確', '得分']
    ];
    for (const h of history) {
        const score = h.score || 1;
        for (const ans of h.answers) {
            let isCorrect = '';
            let earnedScore = 0;
            if (h.type === 'choice') {
                if (ans.choice && ans.choice === h.correctAnswer) {
                    isCorrect = '✅ 正確';
                    earnedScore = score;
                } else if (ans.choice) {
                    isCorrect = '❌ 錯誤';
                }
            } else if (h.type === 'text') {
                // 文字題：從累計分數判斷
                earnedScore = ans.earnedScore || 0;
                isCorrect = earnedScore > 0 ? '✅ 正確' : '';
            } else if (h.type === 'image') {
                // 圖片題：僅記錄有繳交
                isCorrect = ans.imageUrl ? '📷 已繳交' : '';
                earnedScore = ans.imageUrl ? score : 0;
            }
            rows.push([
                h.question,
                h.type === 'choice' ? '選擇題' : h.type === 'text' ? '文字題' : '圖片題',
                h.note || '',
                score,
                ans.studentId || '',
                ans.name || '',
                ans.choice || '',
                ans.text || '',
                isCorrect,
                earnedScore,
            ]);
        }
    }
    return rows;
}

// ----- 7. 監聽教師廣播狀態（學生端用）-----
function listenTeacherFocus(roomId, onFocus) {
    const db = firebase.firestore();
    const roomRef = db.doc(`rooms/${roomId}`);
    return roomRef.onSnapshot((snapshot) => {
        const data = snapshot.data();
        if (data && data.teacherFocus) {
            onFocus(data.teacherFocus);
        }
    }, (err) => {
        console.warn('監聽廣播失敗', err);
    });
}

// ----- 8. 顯示廣播 Modal（學生端用）-----
function showBroadcastModal(imageUrl) {
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
        clearTimeout(modal._timeout);
        modal._timeout = setTimeout(() => {
            modal.style.display = 'none';
        }, 10000);
    }
}

// ----- 匯出 -----
export {
    uploadQuestionImage,
    publishImageQuestion,
    listenImageAnswers,
    setTeacherFocus,
    downloadAllWithImages,
    listenTeacherFocus,
    showBroadcastModal,
};
