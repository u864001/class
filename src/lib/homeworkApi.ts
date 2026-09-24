import { supabase } from './supabase';
import { HomeworkQuestion, HomeworkData, Room } from '../types';

export interface FixedRoomPreset {
  code: string;
  classKey: string;
  label: string;
  grade: string;
  className: string;
}

export const FIXED_ROOM_PRESETS: FixedRoomPreset[] = [
  {
    code: 'WT0601',
    classKey: '6-1',
    label: '霧臺國小 六年甲班 (WT0601)',
    grade: '6',
    className: '1',
  },
  {
    code: 'WT0401',
    classKey: '4-1',
    label: '霧臺國小 四年甲班 (WT0401)',
    grade: '4',
    className: '1',
  },
  {
    code: 'LG0502',
    classKey: '5-2',
    label: '勵谷分校 五年乙班 (LG0502)',
    grade: '5',
    className: '2',
  },
  {
    code: 'LG0102',
    classKey: '1-2',
    label: '勵谷分校 一年乙班 (LG0102)',
    grade: '1',
    className: '2',
  },
];

/**
 * 序列化作業題目為 JSON 字串存入 rooms 表之 question_note
 */
export function serializeHomework(title: string, questions: HomeworkQuestion[]): string {
  const data: HomeworkData = {
    is_homework: true,
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
        title: parsed.title || '課堂回家作業',
        questions: Array.isArray(parsed.questions) ? parsed.questions : [],
        created_at: parsed.created_at,
      };
    }
  } catch {
    // Not a JSON homework note
  }
  return null;
}

/**
 * 徹底清空此固定代碼房間在 Supabase 中的所有雲端資源：
 * 1. 刪除 Storage bucket 'class_assets' 內此房間資料夾的所有圖檔（釋放容量歸零）
 * 2. 刪除 submissions 表中所有該房間之作答明細
 * 3. 刪除 room_students 表中所有該房間之學員狀態
 * 4. 將 rooms 表狀態重置為 'homework_prep' 並清空 question_note
 */
export async function cleanRoomAllAssetsAndSubmissions(
  roomId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanId = roomId.trim().toUpperCase();

    // 1. 清理 Supabase Storage class_assets 該房間資料夾
    try {
      const pathsToRemove: string[] = [];

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

    // 2. 刪除 submissions
    const { error: subErr } = await supabase
      .from('submissions')
      .delete()
      .eq('room_id', cleanId);
    if (subErr) console.warn('Submissions delete notice:', subErr.message);

    // 3. 刪除 room_students
    const { error: stuErr } = await supabase
      .from('room_students')
      .delete()
      .eq('room_id', cleanId);
    if (stuErr) console.warn('Room students delete notice:', stuErr.message);

    // 4. 重設 rooms 表
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

    return { success: true };
  } catch (err: any) {
    console.error('cleanRoomAllAssetsAndSubmissions failed:', err);
    return { success: false, error: err.message || '清理失敗' };
  }
}
