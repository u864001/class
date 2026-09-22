import { ClassRosterStudent } from '../types';

const ROSTER_URL = "https://script.google.com/macros/s/AKfycbyTN6NbWdLc-OfKoa_3iyX5uHCwpDuEeIYSRSVgFcE4aM3RHHfgJthaAMXoiul2YTkH6A/exec";

export async function fetchRoster(): Promise<{ rosterByClass: Record<string, ClassRosterStudent[]>; allStudents: ClassRosterStudent[] }> {
  try {
    const res = await fetch(ROSTER_URL, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    if (!json.data || !Array.isArray(json.data)) throw new Error('Invalid roster response');

    const rosterByClass: Record<string, ClassRosterStudent[]> = {};
    const allStudents: ClassRosterStudent[] = [];

    for (const r of json.data) {
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
  } catch (err) {
    console.warn('Failed to fetch online roster, using fallback data:', err);
    return { rosterByClass: {}, allStudents: [] };
  }
}

export function formatClassLabel(classKey: string): string {
  const [grade, cls] = classKey.split('-');
  const gradeMap: Record<string, string> = { '1': '一年', '2': '二年', '3': '三年', '4': '四年', '5': '五年', '6': '六年' };
  const classMap: Record<string, string> = { '1': '甲班', '2': '乙班', '3': '丙班', '4': '丁班' };
  return `${gradeMap[grade] || grade + '年'}${classMap[cls] || cls + '班'}`;
}
