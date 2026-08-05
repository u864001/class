// ============================================================
// tools.js - 教學工具功能（計時器、骰子、點名器、投票、小組評分）
// 霧臺國小教室Q&A - 教師端專用
// ============================================================

// ===== 工具：計時器 =====
let timerToolInterval = null;
let timerToolRunning = false;
let timerToolSeconds = 0;
let timerToolMode = 'countdown'; // 'countdown' | 'stopwatch'

export function openTimerTool() {
    // 這個函式會由 index.html 呼叫
    // 實際實作在 index.html 中，因為需要直接操作 DOM
    // 但為了模組化，我們定義一個標準介面
    console.log('計時器工具已開啟');
}

// ===== 工具：骰子 =====
export function rollDice() {
    return Math.floor(Math.random() * 6) + 1;
}

// ===== 工具：隨機點名器 =====
export function pickRandomStudent(students, excluded = []) {
    const available = students.filter(s => !excluded.includes(s.id));
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
}

// ===== 工具：投票 =====
export function calculateVoteResults(votes, options) {
    const results = {};
    for (const opt of options) {
        results[opt] = 0;
    }
    for (const vote of votes) {
        if (results[vote] !== undefined) {
            results[vote]++;
        }
    }
    return results;
}

// ===== 工具：小組評分 =====
export function updateGroupScores(groups, scores, groupId, delta) {
    const current = scores[groupId] || 0;
    scores[groupId] = Math.max(0, current + delta);
    return scores;
}

export function getTopGroup(groups, scores) {
    if (groups.length === 0) return null;
    let top = groups[0];
    let topScore = scores[top] || 0;
    for (const g of groups) {
        const s = scores[g] || 0;
        if (s > topScore) {
            topScore = s;
            top = g;
        }
    }
    return top;
}
