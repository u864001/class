-- =========================================================================
-- ClassQnA 2.0: 後端資料庫強制鎖定與防覆寫保護 Trigger
-- 請於 Supabase Dashboard -> SQL Editor 執行本指令碼以啟用後端層級的強制防線
-- =========================================================================

CREATE OR REPLACE FUNCTION check_homework_not_locked()
RETURNS TRIGGER AS $$
DECLARE
  v_lock_round_id text;
  v_is_locked boolean;
BEGIN
  -- 1. 若當前寫入的紀錄即為鎖定控制紀錄本身，直接放行
  IF NEW.round_id = 'HW_FINAL_LOCK' OR NEW.round_id LIKE '%_LOCK' THEN
    RETURN NEW;
  END IF;

  -- 2. 解析對應之本次作業鎖定識別碼
  -- 若題目 ID 為 ASG_xxx_Q1 格式，則對應鎖定識別為 ASG_xxx_LOCK
  IF NEW.round_id LIKE 'ASG_%' THEN
    -- 取前段作業唯一碼部分
    v_lock_round_id := regexp_replace(NEW.round_id, '_Q[0-9]+.*$', '_LOCK');
  ELSE
    v_lock_round_id := 'HW_FINAL_LOCK';
  END IF;

  -- 3. 檢查資料庫中該學生於該作業是否已鎖定
  SELECT EXISTS (
    SELECT 1 FROM submissions
    WHERE room_id = NEW.room_id
      AND student_id = NEW.student_id
      AND (round_id = v_lock_round_id OR (v_lock_round_id = 'HW_FINAL_LOCK' AND round_id = 'HW_FINAL_LOCK'))
  ) INTO v_is_locked;

  -- 4. 若已鎖定，由 PostgreSQL 引擎層強制拋出異常並回滾交易
  IF v_is_locked THEN
    RAISE EXCEPTION '作答已確認鎖定，後端拒絕修改或覆寫！(Student % is locked for %)', NEW.student_id, v_lock_round_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 綁定 Trigger 到 submissions 資料表
DROP TRIGGER IF EXISTS trg_check_homework_locked ON submissions;
CREATE TRIGGER trg_check_homework_locked
BEFORE INSERT OR UPDATE ON submissions
FOR EACH ROW
EXECUTE FUNCTION check_homework_not_locked();

-- 提示執行成功
COMMENT ON FUNCTION check_homework_not_locked IS 'ClassQnA 後端防竄改防線：杜絕已鎖定學生被多分頁或外部請求竄改作答';
