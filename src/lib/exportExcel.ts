import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Submission, Room } from '../types';
import { supabase } from './supabase';
import { parseHomework } from './homeworkApi';

export interface ExportResult {
  success: boolean;
  isZip: boolean;
  totalImages: number;
  failedImages: number;
  isComplete: boolean;
}

export async function exportRoomResults(
  room: Room,
  fallbackSubmissions: Submission[] = []
): Promise<ExportResult> {
  // 1. Fetch all historical submissions across all rounds for this room
  let allSubmissions = fallbackSubmissions;
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('room_id', room.id.toUpperCase())
      .order('created_at', { ascending: true });

    if (!error && data && data.length > 0) {
      allSubmissions = data as Submission[];
    }
  } catch (err) {
    console.warn('Could not fetch all room submissions, using fallback:', err);
  }

  // 2. Prepare Sheet 1: Leaderboard / Total Scores
  const studentTotals: Record<string, { id: string; name: string; totalScore: number }> = {};
  for (const [id, score] of Object.entries(room.cumulative_scores || {})) {
    const sub = allSubmissions.find((s) => s.student_id === id);
    studentTotals[id] = {
      id,
      name: sub?.student_name || id,
      totalScore: score,
    };
  }

  const leaderboardData = Object.values(studentTotals)
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((item, index) => ({
      名次_Rank: index + 1,
      學生座號_ID: item.id,
      學生姓名_Name: item.name,
      累積總得分_Score: item.totalScore,
    }));

  // Check if room is in homework mode
  const hwData = parseHomework(room.question_note);
  const qMap = new Map(hwData?.questions?.map((q) => [q.id, q]));

  // 3. Prepare Sheet 2: Submissions Details (exclude lock control records)
  const submissionData = allSubmissions
    .filter((sub) => sub.round_id !== 'HW_FINAL_LOCK' && !sub.round_id.endsWith('_LOCK'))
    .map((sub, idx) => {
      const qInfo = qMap.get(sub.round_id);
      return {
        編號_No: idx + 1,
        題目編號_Question: qInfo ? `第 ${qInfo.num} 題 (${qInfo.type})` : sub.round_id,
        題目說明_Prompt: qInfo ? qInfo.note : '',
        學生座號_ID: sub.student_id,
        學生姓名_Name: sub.student_name,
        選擇題作答_Choice: sub.choice || '',
        問答文字_Text: sub.text_answer || '',
        作品圖片網址_ImageUrl: sub.image_url || '',
        本題得分_EarnedScore: sub.earned_score || 0,
        繳交時間_Time: new Date(sub.created_at).toLocaleString(),
      };
    });

  const wb = XLSX.utils.book_new();
  const wsLeaderboard = XLSX.utils.json_to_sheet(leaderboardData);
  const wsSubmissions = XLSX.utils.json_to_sheet(submissionData);

  XLSX.utils.book_append_sheet(wb, wsLeaderboard, '總得分排行_Leaderboard');
  XLSX.utils.book_append_sheet(wb, wsSubmissions, '詳細作答紀錄_Details');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const excelBlob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  // 4. Check for images to bundle into ZIP
  const imagesToDownload = allSubmissions.filter((s) => !!s.image_url);

  if (imagesToDownload.length === 0) {
    // Download pure Excel
    const baseTitle = hwData ? `作業成果_${hwData.title}_${room.id}` : `課堂成果_${room.id}`;
    const url = URL.createObjectURL(excelBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    return {
      success: true,
      isZip: false,
      totalImages: 0,
      failedImages: 0,
      isComplete: true,
    };
  }

  // Bundle into ZIP
  const baseTitle = hwData ? `作業成果全包_${hwData.title}_${room.id}` : `課堂成果全包_${room.id}`;
  const zip = new JSZip();
  zip.file(`成績與作答明細.xlsx`, excelBlob);

  const imgFolder = zip.folder('學生繪圖作品');
  let failedImageCount = 0;

  for (const s of imagesToDownload) {
    try {
      if (!s.image_url) continue;
      // Fetch with cache busting and no-cache header to always retrieve the latest image
      const fetchUrl = s.image_url.includes('?')
        ? `${s.image_url}&_t=${Date.now()}`
        : `${s.image_url}?_t=${Date.now()}`;
      const res = await fetch(fetchUrl, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const ext =
        blob.type === 'image/webp' || s.image_url.includes('.webp') ? 'webp' : 'jpg';
      const cleanRound = (s.round_id || 'R1').replace(/[^a-zA-Z0-9_-]/g, '');
      imgFolder?.file(`${cleanRound}_${s.student_id}_${s.student_name}.${ext}`, blob);
    } catch (e) {
      failedImageCount++;
      console.warn('Failed to fetch image for zip:', s.image_url, e);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = zipUrl;
  a.download = `${baseTitle}_${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(zipUrl);

  return {
    success: true,
    isZip: true,
    totalImages: imagesToDownload.length,
    failedImages: failedImageCount,
    isComplete: failedImageCount === 0,
  };
}
