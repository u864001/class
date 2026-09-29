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

export interface SubjectPreset {
  code: string; // 'CH', 'MA', 'SC', 'SS', 'EN', 'LF', 'OT'
  name: string; // '國語', '數學', '自然', '社會', '英語', '生活', '其他'
  fullName: string;
  icon: string;
  color: string;
  grades?: string[]; // e.g. LF is ['1', '2'], SC & SS are ['3', '4', '5', '6']
}

export const SUBJECT_PRESETS: SubjectPreset[] = [
  { code: 'CH', name: '國語', fullName: '國語文', icon: '📘', color: '#3b82f6' },
  { code: 'MA', name: '數學', fullName: '數學科', icon: '📐', color: '#10b981' },
  { code: 'EN', name: '英語', fullName: '英語文', icon: '🔤', color: '#8b5cf6' },
  { code: 'SC', name: '自然', fullName: '自然科學', icon: '🔬', color: '#06b6d4', grades: ['3', '4', '5', '6'] },
  { code: 'SS', name: '社會', fullName: '社會科', icon: '🌍', color: '#f59e0b', grades: ['3', '4', '5', '6'] },
  { code: 'LF', name: '生活', fullName: '生活課程', icon: '🌱', color: '#84cc16', grades: ['1', '2'] },
  { code: 'OT', name: '其他', fullName: '彈性/藝體/其他', icon: '🎨', color: '#ec4899' },
];

export function getSubjectsForGrade(grade?: string): SubjectPreset[] {
  if (!grade) return SUBJECT_PRESETS;
  return SUBJECT_PRESETS.filter((s) => !s.grades || s.grades.includes(grade));
}

export interface ParsedRoomCode {
  isFixed: boolean;
  baseClassCode: string;
  subjectCode?: string;
  subject?: SubjectPreset;
  preset?: FixedRoomPreset;
  displayLabel: string;
  shortLabel: string;
}

export function parseRoomCode(rawRoomId: string): ParsedRoomCode {
  const clean = (rawRoomId || '').trim().toUpperCase();
  const match = clean.match(/^(WT|LG)(\d{2})(\d{2})([A-Z]{2})?$/);

  if (match) {
    const baseCode = clean.slice(0, 6);
    const subCode = clean.length > 6 ? clean.slice(6) : undefined;
    const preset = FIXED_ROOM_PRESETS.find((p) => p.code === baseCode);
    const subject = SUBJECT_PRESETS.find((s) => s.code === subCode);

    let displayLabel = clean;
    let shortLabel = clean;

    if (preset && subject) {
      displayLabel = `${preset.campusName} ${preset.grade}年${preset.className === '1' ? '甲' : '乙'}班 - ${subject.name} (${clean})`;
      shortLabel = `${preset.shortLabel} ${subject.name}`;
    } else if (preset) {
      displayLabel = `${preset.fullLabel} (${clean})`;
      shortLabel = preset.shortLabel;
    }

    return {
      isFixed: true,
      baseClassCode: baseCode,
      subjectCode: subCode,
      subject,
      preset,
      displayLabel,
      shortLabel,
    };
  }

  return {
    isFixed: false,
    baseClassCode: clean,
    displayLabel: clean,
    shortLabel: clean,
  };
}

export interface ReservedCheckResult {
  isReserved: boolean;
  reason?: string;
  matchedPreset?: FixedRoomPreset;
  matchedSubject?: SubjectPreset;
}

/**
 * 檢查自訂教室代碼是否與全校固定班級代碼或其科目後綴組合衝突。
 * 規則包含：
 * 1. 任何 WT/LG 開頭 + 4 位數字班級碼 (如 WT0601, LG0202)
 * 2. 任何上述固定代碼 + 2 位英文字母科目後綴 (如 WT0601CH, LG0202EN, WT0101MA 等)
 * 3. 任何符合校區保留正規表示式 /^(WT|LG)\d{4}([A-Z]{2})?$/i 的代碼
 * 4. 所有 FIXED_ROOM_PRESETS 與 SUBJECT_PRESETS 的任何組合
 */
export function isReservedFixedCode(rawCode: string): ReservedCheckResult {
  const clean = (rawCode || '').trim().toUpperCase();
  if (!clean) return { isReserved: false };

  // 1. 正規表示式檢查：任何 WT / LG 開頭 + 4 位數字 + 選填 2 位英文字母
  const campusRegex = /^(WT|LG)(\d{2})(\d{2})([A-Z]{2})?$/;
  const match = clean.match(campusRegex);

  if (match) {
    const baseCode = clean.slice(0, 6);
    const subCode = clean.length > 6 ? clean.slice(6) : undefined;
    const preset = FIXED_ROOM_PRESETS.find((p) => p.code === baseCode);
    const subject = SUBJECT_PRESETS.find((s) => s.code === subCode);

    let reason = '此代碼符合校區固定班級代碼格式，為全校保留專用代碼';
    if (preset && subject) {
      reason = `此代碼為「${preset.campusName} ${preset.grade}年${preset.className === '1' ? '甲' : '乙'}班 - ${subject.name}」(${clean}) 專屬作業房號`;
    } else if (preset) {
      reason = `此代碼為「${preset.fullLabel}」(${clean}) 專屬固定班級房號`;
    } else {
      reason = `以 WT 或 LG 開頭搭配 4 位數字之編碼為學校官方校區保留格式 (${clean})`;
    }

    return {
      isReserved: true,
      reason,
      matchedPreset: preset,
      matchedSubject: subject,
    };
  }

  // 2. 比對所有預設班級代碼
  const directPreset = FIXED_ROOM_PRESETS.find((p) => p.code === clean);
  if (directPreset) {
    return {
      isReserved: true,
      reason: `此代碼為「${directPreset.fullLabel}」專屬保留代碼`,
      matchedPreset: directPreset,
    };
  }

  // 3. 比對所有預設班級 + 科目組合
  for (const p of FIXED_ROOM_PRESETS) {
    for (const s of SUBJECT_PRESETS) {
      if (clean === `${p.code}${s.code}`) {
        return {
          isReserved: true,
          reason: `此代碼為「${p.campusName} ${p.grade}年${p.className === '1' ? '甲' : '乙'}班 - ${s.name}」專用保留代碼`,
          matchedPreset: p,
          matchedSubject: s,
        };
      }
    }
  }

  return { isReserved: false };
}

/**
 * 驗證教師自訂社團 / 混齡跨班之教室代碼格式與衝突狀態
 */
export function validateCustomRoomCode(rawCode: string): { valid: boolean; error?: string } {
  const clean = (rawCode || '').trim().toUpperCase();
  if (!clean) {
    return { valid: false, error: '請輸入社團/自訂教室代碼' };
  }
  if (clean.length < 3) {
    return { valid: false, error: '代碼長度至少需 3 個字元（例如 CLUB01）' };
  }
  if (clean.length > 12) {
    return { valid: false, error: '代碼長度不能超過 12 個字元' };
  }
  if (!/^[A-Z0-9_-]+$/.test(clean)) {
    return { valid: false, error: '代碼僅允許英文字母、數字、減號 (-) 與底線 (_)' };
  }

  const reserved = isReservedFixedCode(clean);
  if (reserved.isReserved) {
    return {
      valid: false,
      error: reserved.reason || '此代碼為全校保留之固定班級/科目代碼，不可作為自訂代碼！',
    };
  }

  // 避免以校區縮寫 (WT/LG) 加數字開頭，防止與校區固定班級混淆
  if (/^(WT|LG)\d+/i.test(clean)) {
    return {
      valid: false,
      error: `代碼「${clean}」以校區縮寫 (WT/LG) 加數字開頭，易與校區固定班級混淆。社團請改用如 CLUB01、CARE01、ROBOT 等代碼`,
    };
  }

  return { valid: true };
}

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

export interface ActiveHomeworkItem {
  roomId: string;
  baseClassCode: string;
  subjectCode?: string;
  subjectName: string;
  subjectIcon: string;
  title: string;
  count: number;
  teacherName?: string;
}

export interface ActiveHomeworkSummary {
  byClass: Record<string, ActiveHomeworkItem[]>;
  byRoomId: Record<string, ActiveHomeworkItem>;
  customRooms: ActiveHomeworkItem[];
}

/**
 * 查詢所有目前進行中的回家作業 (status = 'homework_active')
 * 自動依班級與科目歸納，支援 WT0601CH 等後綴代碼以及自訂教室
 */
export async function fetchActiveHomeworkSummary(): Promise<ActiveHomeworkSummary> {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, status, question_note, teacher_name')
      .eq('status', 'homework_active');

    if (error || !data) return { byClass: {}, byRoomId: {}, customRooms: [] };

    const byClass: Record<string, ActiveHomeworkItem[]> = {};
    const byRoomId: Record<string, ActiveHomeworkItem> = {};
    const customRooms: ActiveHomeworkItem[] = [];

    for (const r of data) {
      const hw = parseHomework(r.question_note);
      if (!hw) continue;

      const parsed = parseRoomCode(r.id);
      const item: ActiveHomeworkItem = {
        roomId: r.id,
        baseClassCode: parsed.baseClassCode,
        subjectCode: parsed.subjectCode,
        subjectName: parsed.subject?.name || (parsed.isFixed ? '作業' : '自訂專案'),
        subjectIcon: parsed.subject?.icon || '📚',
        title: hw.title,
        count: hw.questions.length,
        teacherName: r.teacher_name,
      };

      byRoomId[r.id] = item;

      if (parsed.isFixed) {
        if (!byClass[parsed.baseClassCode]) {
          byClass[parsed.baseClassCode] = [];
        }
        byClass[parsed.baseClassCode].push(item);
      } else {
        customRooms.push(item);
      }
    }

    return { byClass, byRoomId, customRooms };
  } catch (err) {
    console.warn('fetchActiveHomeworkSummary error:', err);
    return { byClass: {}, byRoomId: {}, customRooms: [] };
  }
}

/**
 * 批次查詢哪些班級目前有進行中的回家作業 (status = 'homework_active')
 * 回傳 map: { WT0601: { title: "國語等作業", count: 3 }, WT0601CH: ... }
 */
export async function fetchActiveHomeworkMap(
  codes?: string[]
): Promise<Record<string, { title: string; count: number }>> {
  const summary = await fetchActiveHomeworkSummary();
  const map: Record<string, { title: string; count: number }> = {};

  Object.values(summary.byRoomId).forEach((it) => {
    map[it.roomId] = { title: it.title, count: it.count };
  });

  // Also provide summary for base class code (e.g. WT0601) if any subject has homework
  Object.entries(summary.byClass).forEach(([baseCode, items]) => {
    if (items.length > 0 && !map[baseCode]) {
      const subjectNames = items.map((i) => i.subjectName).join('、');
      map[baseCode] = {
        title: `${subjectNames}等 ${items.length} 份作業`,
        count: items.reduce((acc, it) => acc + it.count, 0),
      };
    }
  });

  return map;
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
