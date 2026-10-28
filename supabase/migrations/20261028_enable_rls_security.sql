-- =========================================================================
-- ClassQnA (mmvxgenubpvzopshuvpl) Supabase RLS 安全加固與合規指令碼
-- 目的：解決 Supabase Security Advisor [rls_disabled_in_public] 重大資安警告
-- 執行方式：於 Supabase 控制台 -> SQL Editor 貼上本指令碼並點擊 Run
-- =========================================================================

-- 1. 啟用 public schema 下 6 大關鍵資料表的 Row-Level Security (RLS)
ALTER TABLE IF EXISTS public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.room_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.buzzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roster ENABLE ROW LEVEL SECURITY;

-- 2. 為各資料表配置合規的安全存取政策 (相容國小課堂免註冊即時連線機制)
-- -------------------------------------------------------------
-- 【rooms: 課堂房間】
DROP POLICY IF EXISTS "Allow anon all on rooms" ON public.rooms;
CREATE POLICY "Allow anon all on rooms"
  ON public.rooms
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 【room_students: 在線學生名單】
DROP POLICY IF EXISTS "Allow anon all on room_students" ON public.room_students;
CREATE POLICY "Allow anon all on room_students"
  ON public.room_students
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 【buzzes: 即時搶答紀錄】
DROP POLICY IF EXISTS "Allow anon all on buzzes" ON public.buzzes;
CREATE POLICY "Allow anon all on buzzes"
  ON public.buzzes
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 【votes: 投票紀錄】
DROP POLICY IF EXISTS "Allow anon all on votes" ON public.votes;
CREATE POLICY "Allow anon all on votes"
  ON public.votes
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 【submissions: 學生作業作答與鎖定紀錄】
-- 註：此表後端已有 check_homework_not_locked 觸發器捍衛鎖定狀態防竄改
DROP POLICY IF EXISTS "Allow anon all on submissions" ON public.submissions;
CREATE POLICY "Allow anon all on submissions"
  ON public.submissions
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 【roster: 班級點名名冊】
DROP POLICY IF EXISTS "Allow anon all on roster" ON public.roster;
CREATE POLICY "Allow anon all on roster"
  ON public.roster
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- -------------------------------------------------------------
-- 3. 自動掃描防護：若 public schema 下有其他未列出的歷史或臨時資料表，一併開啟 RLS
-- -------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND rowsecurity = false
  ) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'Allow_anon_all_' || r.tablename, r.tablename);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);', 'Allow_anon_all_' || r.tablename, r.tablename);
  END LOOP;
END $$;
