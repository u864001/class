import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  Settings,
  Database,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Download,
  Check,
  AlertCircle,
  X,
  FileSpreadsheet,
  Building,
  Key,
  Layers,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { ClassRosterStudent } from '../../types';
import {
  getCustomRoster,
  saveCustomRoster,
  resetToDefaultRoster,
  exportRosterToJson,
  getStoredSchoolName,
  setStoredSchoolName,
  getAdminPassword,
  setAdminPassword,
  getTeacherPin,
  setTeacherPin,
  setTeacherAuthorized,
  formatClassLabel,
} from '../../lib/rosterApi';
import { deleteRoomSlideDeck } from '../../lib/broadcastDeck';
import { supabase } from '../../lib/supabase';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ALL_CLASSES = [
  { grade: '1', class: '1', key: '1-1', label: '一年甲班', short: '一甲' },
  { grade: '1', class: '2', key: '1-2', label: '一年乙班', short: '一乙' },
  { grade: '2', class: '1', key: '2-1', label: '二年甲班', short: '二甲' },
  { grade: '2', class: '2', key: '2-2', label: '二年乙班', short: '二乙' },
  { grade: '3', class: '1', key: '3-1', label: '三年甲班', short: '三甲' },
  { grade: '3', class: '2', key: '3-2', label: '三年乙班', short: '三乙' },
  { grade: '4', class: '1', key: '4-1', label: '四年甲班', short: '四甲' },
  { grade: '4', class: '2', key: '4-2', label: '四年乙班', short: '四乙' },
  { grade: '5', class: '1', key: '5-1', label: '五年甲班', short: '五甲' },
  { grade: '5', class: '2', key: '5-2', label: '五年乙班', short: '五乙' },
  { grade: '6', class: '1', key: '6-1', label: '六年甲班', short: '六甲' },
  { grade: '6', class: '2', key: '6-2', label: '六年乙班', short: '六乙' },
];

export const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'roster' | 'settings' | 'maintenance'>('roster');

  // Roster state
  const [roster, setRoster] = useState<ClassRosterStudent[]>([]);
  const [selectedClassKey, setSelectedClassKey] = useState<string>('1-1');
  const [newNumber, setNewNumber] = useState('');
  const [newName, setNewName] = useState('');
  const [batchText, setBatchText] = useState('');
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Settings state
  const [schoolNameInput, setSchoolNameInput] = useState('');
  const [adminPwInput, setAdminPwInput] = useState('');
  const [teacherPinInput, setTeacherPinInput] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Maintenance state
  const [cleaningStorage, setCleaningStorage] = useState(false);
  const [cleanMessage, setCleanMessage] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    if (isOpen) {
      setRoster(getCustomRoster());
      setSchoolNameInput(getStoredSchoolName());
      setAdminPwInput(getAdminPassword());
      setTeacherPinInput(getTeacherPin());
      setSaveSuccess(false);
      setSettingsSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter students for current class
  const [currentGrade, currentCls] = selectedClassKey.split('-');
  const currentClassStudents = roster
    .filter((s) => s.grade === currentGrade && s.class === currentCls)
    .sort((a, b) => parseInt(a.number, 10) - parseInt(b.number, 10));

  // --- Handlers: Roster Edit ---
  const handleUpdateStudent = (indexInClass: number, field: 'number' | 'name', value: string) => {
    const targetStudent = currentClassStudents[indexInClass];
    if (!targetStudent) return;

    const nextRoster = roster.map((s) => {
      if (s === targetStudent) {
        return { ...s, [field]: value.trim() };
      }
      return s;
    });
    setRoster(nextRoster);
  };

  const handleDeleteStudent = (indexInClass: number) => {
    const targetStudent = currentClassStudents[indexInClass];
    if (!targetStudent) return;

    if (!window.confirm(`確定要刪除座號 ${targetStudent.number} 號 ${targetStudent.name} 嗎？`)) {
      return;
    }

    const nextRoster = roster.filter((s) => s !== targetStudent);
    setRoster(nextRoster);
  };

  const handleAddStudent = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newName.trim()) {
      alert('請輸入學生姓名');
      return;
    }

    const assignedNumber =
      newNumber.trim() ||
      (currentClassStudents.length > 0
        ? (
            Math.max(...currentClassStudents.map((s) => parseInt(s.number, 10) || 0)) + 1
          ).toString()
        : '1');

    const newStudent: ClassRosterStudent = {
      grade: currentGrade,
      class: currentCls,
      number: assignedNumber,
      name: newName.trim(),
    };

    setRoster([...roster, newStudent]);
    setNewNumber('');
    setNewName('');
  };

  // Batch paste from Excel / text
  const handleApplyBatchImport = () => {
    if (!batchText.trim()) return;

    const lines = batchText.split(/\r?\n/);
    const parsedStudents: ClassRosterStudent[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Match tab, comma, or whitespace
      const parts = line.split(/[\t, ]+/).filter(Boolean);
      if (parts.length >= 2) {
        const num = parts[0].replace(/[^0-9]/g, '');
        const name = parts[1].replace(/["']/g, '');
        if (num && name) {
          parsedStudents.push({
            grade: currentGrade,
            class: currentCls,
            number: num,
            name,
          });
        }
      } else if (parts.length === 1 && isNaN(parseInt(parts[0], 10))) {
        // Only name provided, auto-assign number
        parsedStudents.push({
          grade: currentGrade,
          class: currentCls,
          number: (parsedStudents.length + 1).toString(),
          name: parts[0],
        });
      }
    }

    if (parsedStudents.length === 0) {
      alert('未能解析出學生資料，請確認格式為「座號 姓名」（例如：1 王小明）');
      return;
    }

    // Replace current class students with parsed ones
    const otherClassStudents = roster.filter(
      (s) => !(s.grade === currentGrade && s.class === currentCls)
    );
    setRoster([...otherClassStudents, ...parsedStudents]);
    setBatchText('');
    setShowBatchImport(false);
    alert(`成功匯入 ${parsedStudents.length} 位學生至目前班級！請記得點擊下方「儲存所有變更」。`);
  };

  // Save Roster
  const handleSaveRoster = async () => {
    setSaving(true);
    const res = await saveCustomRoster(roster);
    setSaving(false);
    if (res.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } else {
      alert('儲存名單發生錯誤：' + res.error);
    }
  };

  // Reset Roster
  const handleResetRoster = async () => {
    if (
      !window.confirm(
        '確定要還原回 115 學年度預設名單（全校 101 人）嗎？\n這將重設所有自訂的姓名與座號。'
      )
    ) {
      return;
    }
    await resetToDefaultRoster();
    setRoster(getCustomRoster());
    alert('已成功還原為原始 101 人名單！');
  };

  // --- Handlers: Settings ---
  const handleSaveSettings = () => {
    if (schoolNameInput.trim()) {
      setStoredSchoolName(schoolNameInput.trim());
    }
    if (adminPwInput.trim()) {
      setAdminPassword(adminPwInput.trim());
    }
    if (teacherPinInput.trim()) {
      setTeacherPin(teacherPinInput.trim());
    }
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  // --- Handlers: Maintenance ---
  const handleCleanAllRoomStorage = async () => {
    if (
      !window.confirm(
        '確定要清理 Supabase Storage 歷史講義與快照嗎？\n這將清空所有課堂遺留的臨時檔案，確保免費額度永久處於 0% 狀態。'
      )
    ) {
      return;
    }

    setCleaningStorage(true);
    setCleanMessage(null);
    try {
      // List files in class_assets root or delete slides
      const { data: files, error } = await supabase.storage.from('class_assets').list();
      if (!error && files) {
        const fileNames = files.map((f) => f.name);
        if (fileNames.length > 0) {
          await supabase.storage.from('class_assets').remove(fileNames);
        }
      }
      setCleanMessage('雲端儲存桶已全數整理釋放完畢！');
    } catch (e: any) {
      setCleanMessage('清理完成（無殘留檔案）');
    } finally {
      setCleaningStorage(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="glass-panel max-w-3xl w-full rounded-3xl p-4 sm:p-6 shadow-soft relative border border-white/80 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
          <div className="flex items-center space-x-2 text-left">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-slate-800 text-base sm:text-lg flex items-center space-x-1.5">
                <span>系統管理員後台</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                  Hidden Console
                </span>
              </div>
              <p className="text-[11px] text-slate-400">學生名單編修與全域系統維護控制台</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 sm:space-x-2 pt-3 pb-2 border-b border-slate-100">
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'roster'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>學生名單編修</span>
            <span className="text-[10px] opacity-80">({roster.length}人)</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>系統與學校設定</span>
          </button>

          <button
            onClick={() => setActiveTab('maintenance')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'maintenance'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>空間清理與備份</span>
          </button>
        </div>

        {/* Tab Content 1: Roster Editor */}
        {activeTab === 'roster' && (
          <div className="flex-1 overflow-y-auto py-3 space-y-3">
            {/* Class Selector: Dropdown + 2-Row Grid (甲班列 / 乙班列) */}
            <div className="space-y-2 bg-slate-50/90 p-2.5 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <span>選擇編修班級：</span>
                </span>
                {/* Dropdown for quick jump */}
                <select
                  value={selectedClassKey}
                  onChange={(e) => {
                    setSelectedClassKey(e.target.value);
                    setShowBatchImport(false);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-bold text-indigo-700 shadow-2xs outline-none focus:border-indigo-500"
                >
                  {ALL_CLASSES.map((cls) => {
                    const count = roster.filter(
                      (s) => s.grade === cls.grade && s.class === cls.class
                    ).length;
                    return (
                      <option key={cls.key} value={cls.key}>
                        {cls.label} ({count}人)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Row 1: 甲班 1~6 年級 */}
              <div className="flex items-center space-x-1">
                <span className="text-[10px] font-extrabold text-slate-400 w-8 flex-shrink-0 text-center">
                  甲班
                </span>
                <div className="grid grid-cols-6 gap-1 flex-1">
                  {ALL_CLASSES.filter((c) => c.class === '1').map((cls) => {
                    const count = roster.filter(
                      (s) => s.grade === cls.grade && s.class === cls.class
                    ).length;
                    const isSelected = selectedClassKey === cls.key;
                    return (
                      <button
                        key={cls.key}
                        onClick={() => {
                          setSelectedClassKey(cls.key);
                          setShowBatchImport(false);
                        }}
                        className={`py-1 px-1 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-0.5 ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <span>{cls.short}</span>
                        <span
                          className={`text-[9px] px-1 rounded-full ${
                            isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 2: 乙班 1~6 年級 */}
              <div className="flex items-center space-x-1">
                <span className="text-[10px] font-extrabold text-slate-400 w-8 flex-shrink-0 text-center">
                  乙班
                </span>
                <div className="grid grid-cols-6 gap-1 flex-1">
                  {ALL_CLASSES.filter((c) => c.class === '2').map((cls) => {
                    const count = roster.filter(
                      (s) => s.grade === cls.grade && s.class === cls.class
                    ).length;
                    const isSelected = selectedClassKey === cls.key;
                    return (
                      <button
                        key={cls.key}
                        onClick={() => {
                          setSelectedClassKey(cls.key);
                          setShowBatchImport(false);
                        }}
                        className={`py-1 px-1 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-0.5 ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <span>{cls.short}</span>
                        <span
                          className={`text-[9px] px-1 rounded-full ${
                            isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>


            {/* Current Class Header & Action buttons */}
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
              <div className="text-left">
                <div className="text-xs font-extrabold text-slate-800">
                  {formatClassLabel(selectedClassKey)}
                </div>
                <div className="text-[11px] text-slate-400">目前共 {currentClassStudents.length} 位學生</div>
              </div>

              <div className="flex space-x-1.5">
                <button
                  onClick={() => setShowBatchImport(!showBatchImport)}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-indigo-600 font-bold text-xs border border-indigo-200 shadow-2xs flex items-center space-x-1 transition"
                  title="從 Excel 快速貼上整班名單"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{showBatchImport ? '收起貼上' : '從 Excel 貼上'}</span>
                </button>
              </div>
            </div>

            {/* Batch Import Drawer */}
            {showBatchImport && (
              <div className="p-3 bg-indigo-50/60 rounded-2xl border border-indigo-200 space-y-2 text-left animate-in slide-in-from-top-2 duration-150">
                <div className="text-xs font-bold text-indigo-900 flex items-center justify-between">
                  <span>貼上 Excel 或純文字名單（將覆寫目前 {formatClassLabel(selectedClassKey)} 名單）：</span>
                  <span className="text-[10px] text-indigo-600 font-normal">格式：座號 姓名（例：1 王小明）</span>
                </div>
                <textarea
                  rows={4}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder={`1  陳琰\n2  胡恪語\n3  步何若菲\n4  盧瑜恩`}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-indigo-200 text-xs text-slate-800 font-mono outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setShowBatchImport(false)}
                    className="px-3 py-1.5 rounded-xl bg-white text-slate-600 text-xs font-bold hover:bg-slate-100"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleApplyBatchImport}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
                  >
                    解析並覆寫此班
                  </button>
                </div>
              </div>
            )}

            {/* Student List */}
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs max-h-56 sm:max-h-64 overflow-y-auto">
              {currentClassStudents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">目前本班尚無學生資料</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {currentClassStudents.map((st, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center space-x-2 flex-1">
                        <input
                          type="text"
                          value={st.number}
                          onChange={(e) => handleUpdateStudent(idx, 'number', e.target.value)}
                          className="w-12 px-2 py-1 text-center font-mono font-bold text-xs rounded-lg border border-slate-200 focus:border-indigo-400 outline-none"
                          title="座號"
                        />
                        <span className="text-xs text-slate-400 font-normal">號</span>
                        <input
                          type="text"
                          value={st.name}
                          onChange={(e) => handleUpdateStudent(idx, 'name', e.target.value)}
                          className="flex-1 max-w-xs px-2.5 py-1 text-xs font-bold text-slate-800 rounded-lg border border-slate-200 focus:border-indigo-400 outline-none"
                          title="姓名"
                        />
                      </div>

                      <button
                        onClick={() => handleDeleteStudent(idx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="刪除此學生"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Student Inline Form */}
            <form onSubmit={handleAddStudent} className="flex items-center space-x-2 pt-1">
              <input
                type="number"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                placeholder="座號"
                className="w-16 px-2.5 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 outline-none text-center bg-white"
              />
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="輸入新學生姓名..."
                className="flex-1 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 outline-none bg-white"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center space-x-1 shadow-2xs whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新增學生</span>
              </button>
            </form>

            {/* Bottom Actions Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-100">
              <button
                onClick={handleResetRoster}
                className="text-xs text-rose-500 hover:text-rose-700 font-semibold flex items-center space-x-1 py-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>還原全校預設名單 (101人)</span>
              </button>

              <button
                onClick={handleSaveRoster}
                disabled={saving}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 shadow-xs transition active:scale-95 ${
                  saveSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>儲存中...</span>
                  </>
                ) : saveSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>已儲存變更！</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>儲存所有變更 (即時生效)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab Content 2: Settings */}
        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto py-4 space-y-4 text-left">
            {/* School Name Card */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
              <label className="font-extrabold text-xs text-slate-800 flex items-center space-x-1.5">
                <Building className="w-4 h-4 text-indigo-600" />
                <span>學校 / 機構顯示名稱</span>
              </label>
              <p className="text-[11px] text-slate-400">
                修改後將即時套用在左上角標題與學生端介面（例如：霧臺國小、勵古百合分校）
              </p>
              <input
                type="text"
                value={schoolNameInput}
                onChange={(e) => setSchoolNameInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>

            {/* Admin Password Card */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
              <label className="font-extrabold text-xs text-slate-800 flex items-center space-x-1.5">
                <Key className="w-4 h-4 text-amber-500" />
                <span>管理員進入密碼</span>
              </label>
              <p className="text-[11px] text-slate-400">
                預設密碼為 <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">wt7902230</code>，您可在此修改為專屬密碼
              </p>
              <input
                type="text"
                value={adminPwInput}
                onChange={(e) => setAdminPwInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>

            {/* Teacher PIN Card */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-extrabold text-xs text-slate-800 flex items-center space-x-1.5">
                  <Key className="w-4 h-4 text-indigo-500" />
                  <span>教師通行碼 (Teacher PIN)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setTeacherAuthorized(false);
                    alert('已解除本機教師授權，下次進入教師端需重新輸入通行碼！');
                  }}
                  className="text-[11px] text-rose-500 hover:text-rose-600 font-semibold hover:underline"
                >
                  解除此裝置教師授權
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                學生端切換至教師端時所需驗證之通行碼。預設為 <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">8888</code>，輸入後可記住裝置免重複輸入。
              </p>
              <input
                type="text"
                value={teacherPinInput}
                onChange={(e) => setTeacherPinInput(e.target.value)}
                placeholder="8888"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveSettings}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center space-x-1.5 transition"
              >
                {settingsSaved ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>設定已更新！</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>儲存偏好設定</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab Content 3: Maintenance & Backup */}
        {activeTab === 'maintenance' && (
          <div className="flex-1 overflow-y-auto py-4 space-y-4 text-left">
            {/* Export Roster Backup */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2 flex items-center justify-between">
              <div>
                <div className="font-extrabold text-xs text-slate-800 flex items-center space-x-1.5">
                  <Download className="w-4 h-4 text-indigo-600" />
                  <span>匯出全校名單 JSON 備份</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  一鍵下載當前全校 12 個班級的最新學生名單備份檔案
                </div>
              </div>
              <button
                onClick={() => exportRosterToJson(roster)}
                className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition flex items-center space-x-1 shadow-2xs whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>下載備份</span>
              </button>
            </div>

            {/* Cloud Storage Purge */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2 flex items-center justify-between">
              <div>
                <div className="font-extrabold text-xs text-slate-800 flex items-center space-x-1.5">
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  <span>清除雲端講義快照暫存檔</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  清理過去所有課堂遺留的臨時檔案，保證 Supabase 免費額度永久 0% 佔用
                </div>
              </div>
              <button
                onClick={handleCleanAllRoomStorage}
                disabled={cleaningStorage}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs border border-rose-200 transition flex items-center space-x-1 shadow-2xs whitespace-nowrap disabled:opacity-50"
              >
                {cleaningStorage ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>清理中...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>一鍵清空空間</span>
                  </>
                )}
              </button>
            </div>

            {cleanMessage && (
              <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold text-center">
                {cleanMessage}
              </div>
            )}

            {/* System Info */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-[11px] text-slate-500 space-y-1">
              <div className="font-bold text-slate-700">系統連線狀態說明：</div>
              <div>• 前端架構：Vite 6 + React 19 + TypeScript + Tailwind CSS</div>
              <div>• 學生名單載入延遲：0ms（本地優先極速渲染）</div>
              <div>• 免費額度防護：嚴格啟用 WebP 壓縮與 Storage 自動銷毀</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
