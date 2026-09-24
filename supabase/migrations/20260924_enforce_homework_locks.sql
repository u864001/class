-- =========================================================================
-- ClassQnA 2.0: 後端資料庫強制鎖定與防覆寫保護 Trigger (完整生產加固版)
-- 請於 Supabase Dashboard -> SQL Editor 執行本指令碼
-- =========================================================================

CREATE OR REPLACE FUNCTION check_homework_not_locked()
RETURNS TRIGGER
SECURITY DEFINER -- 以管理員權限執行，確保不受 RLS 影響 EXISTS 鎖定查詢
AS $$
DECLARE
  v_lock_round_id text;
  v_is_locked boolean;
BEGIN
  -- -------------------------------------------------------------
  -- A. 處理 DELETE 操作
  -- -------------------------------------------------------------
  IF TG_OP = 'DELETE' THEN
    -- 若刪除的是鎖定紀錄本身，放行（允許教師執行「解除鎖定」操作）
    IF OLD.round_id = 'HW_FINAL_LOCK' OR right(OLD.round_id, 5) = '_LOCK' THEN
      RETURN OLD;
    END IF;

    -- 若刪除的是題目答案，檢查是否處於鎖定狀態
    IF left(OLD.round_id, 4) = 'ASG_' THEN
      v_lock_round_id := regexp_replace(OLD.round_id, '_Q[0-9]+$', '_LOCK');
    ELSE
      v_lock_round_id := 'HW_FINAL_LOCK';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM submissions
      WHERE room_id = OLD.room_id
        AND student_id = OLD.student_id
        AND round_id = v_lock_round_id
    ) INTO v_is_locked;

    IF v_is_locked THEN
      RAISE EXCEPTION '作答已確認鎖定，禁止刪除題目答案紀錄！(Student % is locked for %)', OLD.student_id, v_lock_round_id;
    END IF;

    RETURN OLD;
  END IF;

  -- -------------------------------------------------------------
  -- B. 處理 UPDATE 操作
  -- -------------------------------------------------------------
  IF TG_OP = 'UPDATE' THEN
    -- 禁止任何客戶端竄改關鍵識別主鍵欄位
    IF (NEW.room_id <> OLD.room_id OR NEW.student_id <> OLD.student_id OR NEW.round_id <> OLD.round_id) THEN
      RAISE EXCEPTION '禁止變更作答之 room_id, student_id 或 round_id 識別欄位！';
    END IF;

    -- 【關鍵解方】：若僅是教師評分 (earned_score 變更)，而學生作答內容完全未變，予以直接放行！
    IF (NEW.choice IS NOT DISTINCT FROM OLD.choice) AND
       (NEW.text_answer IS NOT DISTINCT FROM OLD.text_answer) AND
       (NEW.image_url IS NOT DISTINCT FROM OLD.image_url) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- -------------------------------------------------------------
  -- C. 處理 INSERT 或 內容有變更的 UPDATE 操作
  -- -------------------------------------------------------------
  -- 若當前寫入的紀錄即為鎖定控制紀錄本身，直接放行
  IF NEW.round_id = 'HW_FINAL_LOCK' OR right(NEW.round_id, 5) = '_LOCK' THEN
    RETURN NEW;
  END IF;

  -- 解析對應之本次作業鎖定識別碼（精準字串比對，避免 wildcard 誤配）
  IF left(NEW.round_id, 4) = 'ASG_' THEN
    v_lock_round_id := regexp_replace(NEW.round_id, '_Q[0-9]+$', '_LOCK');
  ELSE
    v_lock_round_id := 'HW_FINAL_LOCK';
  END IF;

  -- 檢查資料庫中該學生於該作業是否已鎖定
  SELECT EXISTS (
    SELECT 1 FROM submissions
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

COMMENT ON FUNCTION check_homework_not_locked IS 'ClassQnA 後端防竄改防線：杜絕已鎖定學生被覆寫或刪除作答，同時確保教師評分正常通行';
