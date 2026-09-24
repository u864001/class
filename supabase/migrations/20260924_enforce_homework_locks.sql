-- =========================================================================
-- ClassQnA 2.0: 後端資料庫強制鎖定與受控權限保護 (終極生產加固版)
-- 請於 Supabase Dashboard -> SQL Editor 執行本指令碼以啟用完整後端防線
-- =========================================================================

-- -------------------------------------------------------------
-- 1. 受控教師評分專責 RPC 函式 (限制只有本函式可合法更動 earned_score)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION award_submission_score(
  p_submission_id text,
  p_score int
) RETURNS void
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  -- 於此交易內設置教師評分標記
  PERFORM set_config('app.teacher_grading', 'true', true);

  UPDATE public.submissions
  SET earned_score = p_score
  WHERE id = p_submission_id;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- 2. 受控教師解鎖專責 RPC 函式 (限制只有本函式可合法刪除鎖定紀錄)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION teacher_unlock_student(
  p_room_id text,
  p_student_id text,
  p_assignment_id text DEFAULT NULL
) RETURNS void
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_lock_round_id text;
BEGIN
  -- 於此交易內設置教師解鎖標記
  PERFORM set_config('app.teacher_unlocking', 'true', true);

  IF p_assignment_id IS NOT NULL AND p_assignment_id <> '' AND p_assignment_id <> 'ASG_DEFAULT' THEN
    v_lock_round_id := p_assignment_id || '_LOCK';
  ELSE
    v_lock_round_id := 'HW_FINAL_LOCK';
  END IF;

  DELETE FROM public.submissions
  WHERE room_id = upper(trim(p_room_id))
    AND student_id = p_student_id
    AND (round_id = v_lock_round_id OR round_id = 'HW_FINAL_LOCK');
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- 3. 全方位鎖定防竄改 Trigger 函式
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_homework_not_locked()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_lock_round_id text;
  v_is_locked boolean := false;
  v_is_room_reset boolean := false;
BEGIN
  -- -----------------------------------------------------------
  -- A. 檢查是否處於房間重置 / 備課清理模式
  -- -----------------------------------------------------------
  IF TG_OP = 'DELETE' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.rooms
      WHERE id = OLD.room_id
        AND status IN ('homework_prep', 'homework_closed', 'stopped', 'idle')
    ) INTO v_is_room_reset;
  END IF;

  -- -----------------------------------------------------------
  -- B. 處理 DELETE 操作
  -- -----------------------------------------------------------
  IF TG_OP = 'DELETE' THEN
    -- 若為房間重置清空，放行刪除
    IF v_is_room_reset THEN
      RETURN OLD;
    END IF;

    -- 若刪除的是鎖定紀錄本身
    IF right(OLD.round_id, 5) = '_LOCK' OR OLD.round_id = 'HW_FINAL_LOCK' THEN
      -- 必須由受控的 teacher_unlock_student RPC 發起，否則拒絕直接刪鎖！
      IF current_setting('app.teacher_unlocking', true) IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION '只有任課教師能解除鎖定，禁止外部直接刪除鎖定紀錄！';
      END IF;
      RETURN OLD;
    END IF;

    -- 若刪除的是題目答案，檢查是否處於鎖定狀態
    IF left(OLD.round_id, 4) = 'ASG_' THEN
      v_lock_round_id := regexp_replace(OLD.round_id, '_Q[0-9]+$', '_LOCK');
    ELSE
      v_lock_round_id := 'HW_FINAL_LOCK';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.submissions
      WHERE room_id = OLD.room_id
        AND student_id = OLD.student_id
        AND round_id = v_lock_round_id
    ) INTO v_is_locked;

    IF v_is_locked THEN
      RAISE EXCEPTION '作答已確認鎖定，禁止刪除題目答案紀錄！(Student % is locked for %)', OLD.student_id, v_lock_round_id;
    END IF;

    RETURN OLD;
  END IF;

  -- -----------------------------------------------------------
  -- C. 處理 UPDATE 操作
  -- -----------------------------------------------------------
  IF TG_OP = 'UPDATE' THEN
    -- 1. 嚴禁任何客戶端竄改關鍵主鍵與身分欄位 (使用 IS DISTINCT FROM 包含 NULL 安全)
    IF (NEW.room_id IS DISTINCT FROM OLD.room_id OR
        NEW.student_id IS DISTINCT FROM OLD.student_id OR
        NEW.round_id IS DISTINCT FROM OLD.round_id) THEN
      RAISE EXCEPTION '禁止變更作答之 room_id, student_id 或 round_id 識別欄位！';
    END IF;

    -- 2. 若評分 earned_score 有更動，必須由受控的 award_submission_score RPC 發起
    IF NEW.earned_score IS DISTINCT FROM OLD.earned_score THEN
      IF current_setting('app.teacher_grading', true) IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION '只有任課教師能修改分數，禁止外部直接更動 earned_score！';
      END IF;
    END IF;

    -- 3. 若學生作答內容完全未變（僅是教師更動分數），直接放行
    IF (NEW.choice IS NOT DISTINCT FROM OLD.choice) AND
       (NEW.text_answer IS NOT DISTINCT FROM OLD.text_answer) AND
       (NEW.image_url IS NOT DISTINCT FROM OLD.image_url) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- -----------------------------------------------------------
  -- D. 處理 INSERT 或 內容有變更的 UPDATE 操作
  -- -----------------------------------------------------------
  -- 若當前寫入的紀錄即為鎖定控制紀錄本身，直接放行
  IF NEW.round_id = 'HW_FINAL_LOCK' OR right(NEW.round_id, 5) = '_LOCK' THEN
    RETURN NEW;
  END IF;

  -- 學生新增題目答案時，若未經教師評分授權，強制限制 earned_score 預設為 0
  IF TG_OP = 'INSERT' AND NEW.earned_score IS DISTINCT FROM 0 THEN
    IF current_setting('app.teacher_grading', true) IS DISTINCT FROM 'true' THEN
      NEW.earned_score := 0;
    END IF;
  END IF;

  -- 解析對應之本次作業鎖定識別碼（精準比對，避免 wildcard 誤配）
  IF left(NEW.round_id, 4) = 'ASG_' THEN
    v_lock_round_id := regexp_replace(NEW.round_id, '_Q[0-9]+$', '_LOCK');
  ELSE
    v_lock_round_id := 'HW_FINAL_LOCK';
  END IF;

  -- 檢查資料庫中該學生於該作業是否已鎖定
  SELECT EXISTS (
    SELECT 1 FROM public.submissions
    WHERE room_id = NEW.room_id
      AND student_id = NEW.student_id
      AND round_id = v_lock_round_id
  ) INTO v_is_locked;

  -- 若已鎖定，由 PostgreSQL 引擎層強制拋出異常並回滾交易
  IF v_is_locked THEN
    RAISE EXCEPTION '作答已確認鎖定，後端拒絕修改或覆寫！(Student % is locked for %)', NEW.student_id, v_lock_round_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 綁定 Trigger 到 submissions 資料表 (支援 INSERT, UPDATE, DELETE)
DROP TRIGGER IF EXISTS trg_check_homework_locked ON submissions;
CREATE TRIGGER trg_check_homework_locked
BEFORE INSERT OR UPDATE OR DELETE ON submissions
FOR EACH ROW
EXECUTE FUNCTION check_homework_not_locked();

COMMENT ON FUNCTION check_homework_not_locked IS 'ClassQnA 終極後端防線：杜絕已鎖定學生被覆寫或刪除作答，同時確保教師評分與解鎖透過專責 RPC 授權執行';
