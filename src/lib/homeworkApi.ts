import { supabase } from './supabase';
import { HomeworkQuestion, HomeworkData, Room } from '../types';

export interface FixedRoomPreset {
  code: string;
  campus: 'wutai' | 'ligu';
  campusName: string;
  classKey: string;
  grade: string;
  className: string;
  shortLabel: string;
  fullLabel: string;
}

export const FIXED_ROOM_PRESETS: FixedRoomPreset[] = [
  // 霧臺校區 (甲班)
  {
    code: 'WT0101',
    campus: 'wutai',
    campusName: '霧臺校區',
    classKey: '1-1',
    grade: '1',
    className: '1',
    shortLabel: '一甲',
    fullLabel: '霧臺 一年甲班 (WT0101)',
  },
  {
    code: 'WT0201',
    campus: 'wutai',
    campusName: '霧臺校區',
    classKey: '2-1',
    grade: '2',
    className: '1',
    shortLabel: '二甲',
    fullLabel: '霧臺 二年甲班 (WT0201)',
  },
  {
    code: 'WT0301',
    campus: 'wutai',
    campusName: '霧臺校區',
    classKey: '3-1',
    grade: '3',
    className: '1',
    shortLabel: '三甲',
    fullLabel: '霧臺 三年甲班 (WT0301)',
  },
  {
    code: 'WT0401',
    campus: 'wutai',
    campusName: '霧臺校區',
    classKey: '4-1',
    grade: '4',
    className: '1',
    shortLabel: '四甲',
    fullLabel: '霧臺 四年甲班 (WT0401)',
  },
  {
    code: 'WT0501',
    campus: 'wutai',
    campusName: '霧臺校區',
    classKey: '5-1',
    grade: '5',
    className: '1',
    shortLabel: '五甲',
    fullLabel: '霧臺 五年甲班 (WT0501)',
  },
  {
    code: 'WT0601',
    campus: 'wutai',
    campusName: '霧臺校區',
    classKey: '6-1',
    grade: '6',
    className: '1',
    shortLabel: '六甲',
    fullLabel: '霧臺 六年甲班 (WT0601)',
  },

  // 勵古百合校區 (簡稱勵古，乙班)
  {
    code: 'LG0102',
    campus: 'ligu',
    campusName: '勵古校區',
    classKey: '1-2',
    grade: '1',
    className: '2',
    shortLabel: '一乙',
    fullLabel: '勵古 一年乙班 (LG0102)',
  },
  {
    code: 'LG0202',
    campus: 'ligu',
    campusName: '勵古校區',
    classKey: '2-2',
    grade: '2',
    className: '2',
    shortLabel: '二乙',
    fullLabel: '勵古 二年乙班 (LG0202)',
  },
  {
    code: 'LG0302',
    campus: 'ligu',
    campusName: '勵古校區',
    classKey: '3-2',
    grade: '3',
    className: '2',
    shortLabel: '三乙',
    fullLabel: '勵古 三年乙班 (LG0302)',
  },
  {
    code: 'LG0402',
    campus: 'ligu',
    campusName: '勵古校區',
    classKey: '4-2',
    grade: '4',
    className: '2',
    shortLabel: '四乙',
    fullLabel: '勵古 四年乙班 (LG0402)',
  },
  {
    code: 'LG0502',
    campus: 'ligu',
    campusName: '勵古校區',
    classKey: '5-2',
    grade: '5',
    className: '2',
    shortLabel: '五乙',
    fullLabel: '勵古 五年乙班 (LG0502)',
  },
  {
    code: 'LG0602',
    campus: 'ligu',
    campusName: '勵古校區',
    classKey: '6-2',
    grade: '6',
    className: '2',
    shortLabel: '六乙',
    fullLabel: '勵古 六年乙班 (LG0602)',
  },
];

export const WUTAI_PRESETS = FIXED_ROOM_PRESETS.filter((p) => p.campus === 'wutai');
export const LIGU_PRESETS = FIXED_ROOM_PRESETS.filter((p) => p.campus === 'ligu');

/**
/**
 * 序列化作業題目為 JSON 字串存入 rooms 表之 question_note
 * 每次作業均附帶唯一的 assignment_id，實現跨次作業徹底隔離
 */
export function serializeHomework(
  title: string,
  questions: HomeworkQuestion[],
  assignmentId?: string
): string {
  const data: HomeworkData = {
    is_homework: true,
    assignment_id:
      assignmentId ||
      `ASG_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    title: title.trim() || '課堂回家作業',
    questions,
    created_at: new Date().toISOString(),
  };
  return JSON.stringify(data);
}

/**
 * 從 rooms 表之 question_note 解析作業資料
 */
export function parseHomework(rawNote?: string | null): HomeworkData | null {
  if (!rawNote || !rawNote.trim()) return null;
  try {
    const parsed = JSON.parse(rawNote);
    if (parsed && typeof parsed === 'object' && (parsed.is_homework || Array.isArray(parsed.questions))) {
      return {
        is_homework: true,
        assignment_id: parsed.assignment_id || undefined,
        title: parsed.title || '課堂回家作業',
        questions: Array.isArray(parsed.questions) ? parsed.questions : [],
        created_at: parsed.created_at,
        closed_at: parsed.closed_at,
      };
    }
  } catch {
    // Not a JSON homework note
  }
  return null;
}

/**
 * 簡易而實用的裝置型號與瀏覽器識別（用作提交紀錄與覆蓋查證日誌）
 */
export function getDeviceInfo(): string {
  if (typeof navigator === 'undefined') return '裝置未知';
  const ua = navigator.userAgent;
  let os = '裝置';
  if (/iPad|iPhone|iPod/.test(ua)) os = 'iPad/iOS';
  else if (/Android/.test(ua)) os = 'Android 平板/手機';
  else if (/Macintosh/.test(ua)) os = 'Mac 電腦';
  else if (/Windows/.test(ua)) os = 'Windows 電腦';
  else if (/CrOS/.test(ua)) os = 'Chromebook';

  let browser = '';
  if (/Edg/.test(ua)) browser = 'Edge';
  else if (/Chrome/.test(ua)) browser = 'Chrome';
  else if (/Safari/.test(ua)) browser = 'Safari';
  else if (/Firefox/.test(ua)) browser = 'Firefox';

  return `${os}${browser ? ' (' + browser + ')' : ''}`;
}

/**
 * 取得或產生此裝置的匿名識別序號（存於 localStorage）
 */
export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem('classqna_device_id');
    if (!id) {
      id = 'DEV_' + Math.random().toString(36).substring(2, 7).toUpperCase();
      localStorage.setItem('classqna_device_id', id);
    }
    return id;
  } catch {
    return 'DEV_ANON';
  }
}

export const LOCK_ROUND_ID = 'HW_FINAL_LOCK';

export interface LockMetadata {
  locked: boolean;
  locked_at: string;
  assignment_id?: string;
  device: string;
  deviceId: string;
}

/**
 * 學生確認作答完畢，鎖死答案不允許再修改
 * 支援 assignmentId 隔離，避免跨次作業干擾
 */
export async function lockStudentHomework(
  roomId: string,
  studentId: string,
  studentName: string,
  assignmentId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanRoomId = roomId.trim().toUpperCase();
    const roundId = assignmentId ? `${assignmentId}_LOCK` : LOCK_ROUND_ID;

    const meta: LockMetadata = {
      locked: true,
      locked_at: new Date().toISOString(),
      assignment_id: assignmentId,
      device: getDeviceInfo(),
      deviceId: getOrCreateDeviceId(),
    };

    const { error } = await supabase.from('submissions').upsert(
      {
        room_id: cleanRoomId,
        round_id: roundId,
        student_id: studentId,
        student_name: studentName,
        text_answer: JSON.stringify(meta),
      },
      {
        onConflict: 'room_id,round_id,student_id',
      }
    );

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Lock student error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 教師在後台為學生解除鎖定（允許該學生重新修改送出）
 */
export async function unlockStudentHomework(
  roomId: string,
  studentId: string,
  assignmentId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanRoomId = roomId.trim().toUpperCase();

    // 1. Try secure teacher unlock RPC
    const { error: rpcErr } = await supabase.rpc('teacher_unlock_student', {
      p_room_id: cleanRoomId,
      p_student_id: studentId,
      p_assignment_id: assignmentId || null,
    });

    // 2. Fallback to direct delete if RPC is not yet installed in Supabase
    if (rpcErr) {
      const targetRoundIds = [LOCK_ROUND_ID];
      if (assignmentId) {
        targetRoundIds.push(`${assignmentId}_LOCK`);
      }

      const { error } = await supabase
        .from('submissions')
        .delete()
        .eq('room_id', cleanRoomId)
        .in('round_id', targetRoundIds)
        .eq('student_id', studentId);

      if (error) throw error;
    }

    return { success: true };
  } catch (err: any) {
    console.error('Unlock student error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 學生端專用：將手機拍照或手繪畫布在客戶端先進行極致壓縮 (最大 1440px, WebP 0.8)，
 * 並上傳至按作業隔離之固定單一路徑：
 * `${roomId}/${assignmentId}/hw_${questionId}_${studentId}.webp`
 * 保證 upsert 覆寫無孤兒檔案，且單圖大小由 4MB 驟降至 150KB 內！
 */
export async function uploadStudentHomeworkImage(
  roomId: string,
  assignmentId: string,
  questionId: string,
  studentId: string,
  source: HTMLCanvasElement | File | Blob
): Promise<string> {
  const cleanRoomId = roomId.trim().toUpperCase();
  const cleanAsgId = (assignmentId || 'ASG_DEFAULT').replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanQId = questionId.replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanStuId = studentId.replace(/[^a-zA-Z0-9_-]/g, '');

  // 1. Guard: Check if student has locked this assignment before allowing storage upload
  const lockRoundId = cleanAsgId !== 'ASG_DEFAULT' ? `${cleanAsgId}_LOCK` : LOCK_ROUND_ID;
  const { data: lockCheck } = await supabase
    .from('submissions')
    .select('id')
    .eq('room_id', cleanRoomId)
    .eq('round_id', lockRoundId)
    .eq('student_id', cleanStuId)
    .maybeSingle();

  if (lockCheck) {
    throw new Error('作答已確認鎖定，禁止再次上傳或替換作品圖檔！');
  }

  let canvas: HTMLCanvasElement;

  if (source instanceof HTMLCanvasElement) {
    canvas = source;
  } else {
    // If it's File or Blob, load into an Image and scale via Canvas
    canvas = await new Promise<HTMLCanvasElement>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1440;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas 2D context not available'));
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(c);
        };
        img.onerror = () => reject(new Error('無法解析此圖片格式'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('檔案讀取失敗'));
      reader.readAsDataURL(source);
    });
  }

  // Convert canvas to WebP Blob (0.8 quality)
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else {
          canvas.toBlob(
            (jb) => (jb ? resolve(jb) : reject(new Error('圖片壓縮失敗'))),
            'image/jpeg',
            0.75
          );
        }
      },
      'image/webp',
      0.8
    );
  });

  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const filePath = `${cleanRoomId}/${cleanAsgId}/hw_${cleanQId}_${cleanStuId}.${ext}`;

  const { error } = await supabase.storage
    .from('class_assets')
    .upload(filePath, blob, {
      contentType: blob.type,
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    throw new Error('雲端儲存槽上傳失敗: ' + error.message);
  }

  const { data: publicData } = supabase.storage
    .from('class_assets')
    .getPublicUrl(filePath);

  return `${publicData.publicUrl}?t=${Date.now()}`;
}

/**
 * 批次查詢哪些班級目前有進行中的回家作業 (status = 'homework_active')
 * 回傳 map: { WT0601: { title: "自然第3單元", questionCount: 3 }, ... }
 */
export async function fetchActiveHomeworkMap(
  codes?: string[]
): Promise<Record<string, { title: string; count: number }>> {
  try {
    const codesToQuery = codes || FIXED_ROOM_PRESETS.map((p) => p.code);
    const { data, error } = await supabase
      .from('rooms')
      .select('id, status, question_note')
      .in('id', codesToQuery)
      .eq('status', 'homework_active');

    if (error || !data) return {};

    const result: Record<string, { title: string; count: number }> = {};
    for (const r of data) {
      const hw = parseHomework(r.question_note);
      if (hw) {
        result[r.id] = {
          title: hw.title,
          count: hw.questions.length,
        };
      }
    }
    return result;
  } catch (err) {
    console.warn('fetchActiveHomeworkMap error:', err);
    return {};
  }
}

/**
 * 徹底清空此固定代碼房間在 Supabase 中的所有雲端資源：
 * 1. 刪除 Storage bucket 'class_assets' 內此房間資料夾的所有圖檔（釋放容量歸零）
 * 2. 刪除 submissions 表中所有該房間之作答明細
 * 3. 刪除 room_students 表中所有該房間之學員狀態
 * 4. 將 rooms 表狀態重置為 'homework_prep' 並清空 question_note
 */
export async function cleanRoomAllAssetsAndSubmissions(
  roomId: string,
  assignmentId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanId = roomId.trim().toUpperCase();

    // 1. 清理 Supabase Storage class_assets 該房間資料夾
    try {
      const pathsToRemove: string[] = [];

      // 若有指定作業 ID，優先清查該次作業專屬目錄
      if (assignmentId) {
        const cleanAsgId = assignmentId.replace(/[^a-zA-Z0-9_-]/g, '');
        const { data: asgFiles } = await supabase.storage
          .from('class_assets')
          .list(`${cleanId}/${cleanAsgId}`);
        if (asgFiles && asgFiles.length > 0) {
          for (const file of asgFiles) {
            pathsToRemove.push(`${cleanId}/${cleanAsgId}/${file.name}`);
          }
        }
      }

      // 檢查根目錄檔案
      const { data: rootFiles } = await supabase.storage.from('class_assets').list(cleanId);
      if (rootFiles && rootFiles.length > 0) {
        for (const file of rootFiles) {
          if (file.id) {
            pathsToRemove.push(`${cleanId}/${file.name}`);
          }
        }
      }

      // 檢查 drawings 子目錄
      const { data: drawingFiles } = await supabase.storage.from('class_assets').list(`${cleanId}/drawings`);
      if (drawingFiles && drawingFiles.length > 0) {
        for (const file of drawingFiles) {
          pathsToRemove.push(`${cleanId}/drawings/${file.name}`);
        }
      }

      // 檢查 homework 子目錄
      const { data: hwFiles } = await supabase.storage.from('class_assets').list(`${cleanId}/homework`);
      if (hwFiles && hwFiles.length > 0) {
        for (const file of hwFiles) {
          pathsToRemove.push(`${cleanId}/homework/${file.name}`);
        }
      }

      // 檢查 annotations 子目錄
      const { data: annFiles } = await supabase.storage.from('class_assets').list(`${cleanId}/annotations`);
      if (annFiles && annFiles.length > 0) {
        for (const file of annFiles) {
          pathsToRemove.push(`${cleanId}/annotations/${file.name}`);
        }
      }

      if (pathsToRemove.length > 0) {
        await supabase.storage.from('class_assets').remove(pathsToRemove);
      }
    } catch (storageErr) {
      console.warn('Storage cleanup warning:', storageErr);
    }

    // 1. 先將 rooms 表狀態重置為 'homework_prep' 並清空題目
    // 此舉能立即終止任何學生作答，並讓資料庫 Trigger 識別目前為房間重置模式，允許批次刪除
    const { error: roomErr } = await supabase
      .from('rooms')
      .update({
        status: 'homework_prep',
        question_note: '',
        current_round_id: null,
        revealed_answer: null,
        broadcast_text: '',
        broadcast_image_url: '',
        cumulative_scores: {},
      })
      .eq('id', cleanId);

    if (roomErr) throw roomErr;

    // 2. 先刪除所有鎖定紀錄
    await supabase
      .from('submissions')
      .delete()
      .eq('room_id', cleanId)
      .or(`round_id.eq.${LOCK_ROUND_ID},round_id.like.%_LOCK`);

    // 3. 刪除所有作答明細
    const { error: subErr } = await supabase
      .from('submissions')
      .delete()
      .eq('room_id', cleanId);
    if (subErr) console.warn('Submissions delete notice:', subErr.message);

    // 4. 刪除 room_students 在線狀態
    const { error: stuErr } = await supabase
      .from('room_students')
      .delete()
      .eq('room_id', cleanId);
    if (stuErr) console.warn('Room students delete notice:', stuErr.message);

    return { success: true };
  } catch (err: any) {
    console.error('cleanRoomAllAssetsAndSubmissions failed:', err);
    return { success: false, error: err.message || '清理失敗' };
  }
}
