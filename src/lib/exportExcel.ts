import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Submission, Room } from '../types';

export async function exportRoomResults(
  room: Room,
  submissions: Submission[]
) {
  // 1. Prepare Sheet 1: Leaderboard / Total Scores
  const studentTotals: Record<string, { id: string; name: string; totalScore: number }> = {};
  for (const [id, score] of Object.entries(room.cumulative_scores || {})) {
    const sub = submissions.find(s => s.student_id === id);
    studentTotals[id] = {
      id,
      name: sub?.student_name || id,
      totalScore: score
    };
  }

  const leaderboardData = Object.values(studentTotals)
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((item, index) => ({
      '名次': index + 1,
      '學生座號/ID': item.id,
      '學生姓名': item.name,
      '累積總得分': item.totalScore
    }));

  // 2. Prepare Sheet 2: Submissions Details
  const submissionData = submissions.map((sub, idx) => ({
    '編號': idx + 1,
    '輪次 ID': sub.round_id,
    '學生座號/ID': sub.student_id,
    '學生姓名': sub.student_name,
    '選擇題作答': sub.choice || '',
    '問答文字': sub.text_answer || '',
    '作品圖片網址': sub.image_url || '',
    '本題得分': sub.earned_score,
    '繳交時間': new Date(sub.created_at).toLocaleTimeString()
  }));

  const wb = XLSX.utils.book_new();
  const wsLeaderboard = XLSX.utils.json_to_sheet(leaderboardData);
  const wsSubmissions = XLSX.utils.json_to_sheet(submissionData);

  XLSX.utils.book_append_sheet(wb, wsLeaderboard, '總得分排行');
  XLSX.utils.book_append_sheet(wb, wsSubmissions, '詳細作答紀錄');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const excelBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  // 3. Check for images to bundle into ZIP
  const imagesToDownload = submissions.filter(s => !!s.image_url);

  if (imagesToDownload.length === 0) {
    // Download pure Excel
    const url = URL.createObjectURL(excelBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `課堂成果_${room.id}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // Bundle into ZIP
  const zip = new JSZip();
  zip.file(`成績與作答明細.xlsx`, excelBlob);

  const imgFolder = zip.folder('學生繪圖作品');
  for (const s of imagesToDownload) {
    try {
      if (!s.image_url) continue;
      const res = await fetch(s.image_url);
      const blob = await res.blob();
      const ext = s.image_url.endsWith('.webp') ? 'webp' : 'jpg';
      imgFolder?.file(`${s.student_id}_${s.student_name}.${ext}`, blob);
    } catch (e) {
      console.warn('Failed to fetch image for zip:', s.image_url, e);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = zipUrl;
  a.download = `課堂成果全包_${room.id}_${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(zipUrl);
}
