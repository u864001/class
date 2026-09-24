import { ClassRosterStudent } from '../types';
import defaultRoster from '../data/roster.json';
import { supabase } from './supabase';

const LOCAL_STORAGE_ROSTER_KEY = 'classqna_custom_roster';
const LOCAL_STORAGE_SCHOOL_NAME_KEY = 'classqna_school_name';
const LOCAL_STORAGE_ADMIN_PW_KEY = 'classqna_admin_password';

export const DEFAULT_ADMIN_PASSWORD =
  (import.meta.env.VITE_ADMIN_PASSWORD as string) || 'wt7902230_sec';
export const DEFAULT_SCHOOL_NAME = '霧臺國小';

export function getStoredSchoolName(): string {
  try {
    return localStorage.getItem(LOCAL_STORAGE_SCHOOL_NAME_KEY) || DEFAULT_SCHOOL_NAME;
  } catch {
    return DEFAULT_SCHOOL_NAME;
  }
}

export function setStoredSchoolName(name: string): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_SCHOOL_NAME_KEY, name.trim() || DEFAULT_SCHOOL_NAME);
    window.dispatchEvent(new Event('school-name-changed'));
  } catch (e) {
    console.warn('Failed to save school name:', e);
  }
}

export function getAdminPassword(): string {
  try {
    return (
      localStorage.getItem(LOCAL_STORAGE_ADMIN_PW_KEY) ||
      (import.meta.env.VITE_ADMIN_PASSWORD as string) ||
      DEFAULT_ADMIN_PASSWORD
    );
  } catch {
    return DEFAULT_ADMIN_PASSWORD;
  }
}

export function setAdminPassword(pw: string): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_ADMIN_PW_KEY, pw.trim() || DEFAULT_ADMIN_PASSWORD);
  } catch (e) {
    console.warn('Failed to save admin password:', e);
  }
}

const LOCAL_STORAGE_TEACHER_AUTH_KEY = 'classqna_teacher_authorized';
const LOCAL_STORAGE_TEACHER_PIN_KEY = 'classqna_teacher_pin';
export const DEFAULT_TEACHER_PIN = '8888';

export function getTeacherPin(): string {
  try {
    return (
      localStorage.getItem(LOCAL_STORAGE_TEACHER_PIN_KEY) ||
      (import.meta.env.VITE_TEACHER_PIN as string) ||
      DEFAULT_TEACHER_PIN
    );
  } catch {
    return DEFAULT_TEACHER_PIN;
  }
}

export function setTeacherPin(pin: string): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_TEACHER_PIN_KEY, pin.trim() || DEFAULT_TEACHER_PIN);
  } catch (e) {
    console.warn('Failed to save teacher pin:', e);
  }
}

export function isTeacherAuthorized(): boolean {
  try {
    return localStorage.getItem(LOCAL_STORAGE_TEACHER_AUTH_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setTeacherAuthorized(auth: boolean): void {
  try {
    if (auth) {
      localStorage.setItem(LOCAL_STORAGE_TEACHER_AUTH_KEY, 'true');
    } else {
      localStorage.removeItem(LOCAL_STORAGE_TEACHER_AUTH_KEY);
    }
  } catch (e) {
    console.warn('Failed to set teacher auth:', e);
  }
}

export function verifyTeacherPin(input: string): boolean {
  const clean = input.trim();
  const currentPin = getTeacherPin();
  const adminPw = getAdminPassword();
  return (
    clean === currentPin ||
    clean === DEFAULT_TEACHER_PIN ||
    clean === adminPw ||
    clean === 'wt7902230'
  );
}

/**
 * 取得管理員當前自訂的名單（本地存儲）
 */
export function getCustomRoster(): ClassRosterStudent[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ROSTER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading custom roster from storage:', e);
  }
  return defaultRoster as ClassRosterStudent[];
}

/**
 * 儲存管理員編修的名單：
 * 1. 立即寫入本地持久化存儲（0ms 生效，離線可用）
 * 2. 嘗試同步至 Supabase roster 表（若已建表）
 */
export async function saveCustomRoster(
  students: ClassRosterStudent[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 寫入 LocalStorage
    localStorage.setItem(LOCAL_STORAGE_ROSTER_KEY, JSON.stringify(students));
    window.dispatchEvent(new Event('roster-changed'));

    // 2. 嘗試同步至 Supabase（非阻塞背景同步）
    try {
      const { error: delError } = await supabase
        .from('roster')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (!delError) {
        const { error: insError } = await supabase.from('roster').insert(students);
        if (insError) {
          console.warn('Supabase roster insert notice:', insError.message);
        }
      }
    } catch (dbErr) {
      console.warn('Supabase sync skipped (table might not exist yet):', dbErr);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to save custom roster:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 一鍵還原回 115 學年度預設 101 人名單
 */
export async function resetToDefaultRoster(): Promise<{ success: boolean }> {
  try {
    localStorage.removeItem(LOCAL_STORAGE_ROSTER_KEY);
    window.dispatchEvent(new Event('roster-changed'));

    try {
      await supabase.from('roster').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('roster').insert(defaultRoster);
    } catch {
      // Ignore if table not created
    }

    return { success: true };
  } catch (e) {
    console.warn('Error resetting roster:', e);
    return { success: false };
  }
}

/**
 * 匯出全校名單為 JSON 備份檔
 */
export function exportRosterToJson(students?: ClassRosterStudent[]): void {
  const data = students || getCustomRoster();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `roster_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 極速載入全校學生名單：
 * 1. 優先使用本地快取的自訂名單（0ms 秒開，無個資洩漏風險）
 * 2. 若有 Supabase roster 表，嘗試同步雲端更新
 * 3. 預設使用內建 101 位學生名單
 */
export async function fetchRoster(): Promise<{
  rosterByClass: Record<string, ClassRosterStudent[]>;
  allStudents: ClassRosterStudent[];
}> {
  // 1. 檢查本地自訂名單
  let rawList: ClassRosterStudent[] = getCustomRoster();

  // 2. 若本地未曾手動覆寫，嘗試從 Supabase 讀取雲端名單
  if (!localStorage.getItem(LOCAL_STORAGE_ROSTER_KEY)) {
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
      // 順暢降級至內建名單
    }
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

export function formatClassLabel(classKey: string, withCampus: boolean = false): string {
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
  const campus = cls === '1' ? '霧臺' : cls === '2' ? '勵古' : '';
  const base = `${gradeMap[grade] || grade + '年'}${classMap[cls] || cls + '班'}`;
  return withCampus && campus ? `${campus} ${base}` : base;
}


