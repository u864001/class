/**
 * 原鄉山林動物隨機暱稱產生器與姓名遮蔽工具
 */

export const POSITIVE_ADJECTIVES = [
  '積極的',
  '勇敢的',
  '聰明的',
  '敏捷的',
  '活潑的',
  '堅韌的',
  '熱情的',
  '專注的',
  '好奇的',
  '自信的',
  '沉著的',
  '溫暖的',
  '守護的',
  '智慧的',
  '奔放的',
  '閃亮的',
  '踏實的',
  '樂觀的',
  '友善的',
  '勤奮的',
];

export const INDIGENOUS_ANIMALS = [
  '山豬',
  '水鹿',
  '熊鷹',
  '穿山甲',
  '飛鼠',
  '黑熊',
  '雲豹',
  '百步蛇',
  '台灣藍鵲',
  '長鬃山羊',
  '石虎',
  '大冠鷲',
  '黃喉貂',
  '領角鴞',
  '山羌',
  '竹雞',
  '帝雉',
  '藍腹鷴',
  '赤腹松鼠',
  '莫氏樹蛙',
];

/**
 * 隨機產生「正向形容詞 + 原鄉山林動物」暱稱
 * 共有 20 * 20 = 400 種自然組合
 */
export function generateIndigenousNickname(): string {
  const adj = POSITIVE_ADJECTIVES[Math.floor(Math.random() * POSITIVE_ADJECTIVES.length)];
  const animal = INDIGENOUS_ANIMALS[Math.floor(Math.random() * INDIGENOUS_ANIMALS.length)];
  return `${adj}${animal}`;
}

/**
 * 學生公開選單名稱遮蔽工具
 * 在公用或投影畫面的下拉選單中遮蔽中間字以保護個資，
 * 學生點選進入教室後則解除遮蔽，在系統內保留完整真實全名。
 */
export function maskStudentName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed.includes('○') || trimmed.includes('*')) return trimmed;

  // 處理原住民名字包含隔音符號或點（如：瑪發里‧阿希漾）
  if (trimmed.includes('‧') || trimmed.includes('.')) {
    const parts = trimmed.split(/[‧.]/);
    if (parts.length >= 2) {
      const family = parts[0];
      const personal = parts[1];
      const maskedPersonal =
        personal.length <= 2
          ? personal[0] + '○'
          : personal[0] + '○'.repeat(personal.length - 2) + personal[personal.length - 1];
      return `${family}‧${maskedPersonal}`;
    }
  }

  // 2 字姓名：陳琰 -> 陳○
  if (trimmed.length === 2) {
    return trimmed[0] + '○';
  }

  // 3 字姓名：杜雷諾 -> 杜○諾
  if (trimmed.length === 3) {
    return trimmed[0] + '○' + trimmed[2];
  }

  // 4 字姓名：步何若菲 -> 步○○菲
  if (trimmed.length === 4) {
    return trimmed[0] + '○○' + trimmed[3];
  }

  // 5 字以上：保留頭尾，中間遮蔽
  if (trimmed.length > 4) {
    return (
      trimmed.slice(0, 2) +
      '○'.repeat(trimmed.length - 3) +
      trimmed.slice(-1)
    );
  }

  return trimmed;
}
