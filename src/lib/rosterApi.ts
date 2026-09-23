import { ClassRosterStudent } from '../types';
import defaultRoster from '../data/roster.json';
import { supabase } from './supabase';

/**
 * 極速載入全校學生名單：
 * 1. 優先使用本地乾淨名單（0ms 秒開，無個資洩漏風險）
 * 2. 若 Supabase 建有 roster 表，自動同步最新雲端名單
 */
export async function fetchRoster(): Promise<{
  rosterByClass: Record<string, ClassRosterStudent[]>;
  allStudents: ClassRosterStudent[];
}> {
  let rawList: ClassRosterStudent[] = defaultRoster as ClassRosterStudent[];

  // 嘗試從 Supabase 讀取（若使用者有建立 roster 資料表）
  try {
    const { data, error } = await supabase
      .from('roster')
      .select('grade, class, number, name')
      .order('grade', { ascending: true })
      .order('class', { ascending: true });

    if (!error && data && data.length > 0) {
      rawList = data as ClassRosterStudent[];
    }
  } catch {
    // 若尚未在 Supabase 建表，直接順暢使用本地最新名單，毫秒級秒開
  }

  const rosterByClass: Record<string, ClassRosterStudent[]> = {};
  const allStudents: ClassRosterStudent[] = [];

  for (const r of rawList) {
    const grade = r.grade?.toString().trim();
    const cls = r.class?.toString().trim();
    const num = r.number?.toString().trim();
    const name = r.name?.trim();
    if (!grade || !cls || !num || !name) continue;

    const key = `${grade}-${cls}`;
    if (!rosterByClass[key]) rosterByClass[key] = [];
    const s: ClassRosterStudent = { grade, class: cls, number: num, name };
    rosterByClass[key].push(s);
    allStudents.push(s);
  }

  for (const k in rosterByClass) {
    rosterByClass[k].sort((a, b) => parseInt(a.number, 10) - parseInt(b.number, 10));
  }

  return { rosterByClass, allStudents };
}

export function formatClassLabel(classKey: string): string {
  const [grade, cls] = classKey.split('-');
  const gradeMap: Record<string, string> = {
    '1': '一年',
    '2': '二年',
    '3': '三年',
    '4': '四年',
    '5': '五年',
    '6': '六年',
  };
  const classMap: Record<string, string> = {
    '1': '甲班',
    '2': '乙班',
    '3': '丙班',
    '4': '丁班',
  };
  return `${gradeMap[grade] || grade + '年'}${classMap[cls] || cls + '班'}`;
}

/**
 * 將本地 101 位學生名單一鍵推送到 Supabase roster 表
 */
export async function pushRosterToSupabase(): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  try {
    // 清空舊名單並批次寫入
    await supabase.from('roster').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error } = await supabase.from('roster').insert(defaultRoster);
    if (error) throw error;
    return { success: true, count: defaultRoster.length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

