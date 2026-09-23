import { supabase } from './supabase';

export interface BroadcastDeckState {
  version: 2;
  slides: string[];
  currentIndex: number;
  mode: 'sync' | 'free';
  updatedAt: number;
}

/**
 * Parses the broadcast_image_url field into a structured slide deck.
 * Supports backward compatibility with single image URLs.
 */
export function parseBroadcastDeck(payload: string | null | undefined): BroadcastDeckState | null {
  if (!payload || !payload.trim()) return null;

  const trimmed = payload.trim();
  if (trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed);
      if (Array.isArray(data.slides)) {
        return {
          version: 2,
          slides: data.slides,
          currentIndex: Math.max(0, Math.min(data.currentIndex ?? 0, data.slides.length - 1)),
          mode: data.mode === 'free' ? 'free' : 'sync',
          updatedAt: data.updatedAt || Date.now(),
        };
      }
    } catch (e) {
      console.warn('Failed to parse broadcast deck JSON:', e);
    }
  }

  // Fallback for single image URL
  return {
    version: 2,
    slides: [trimmed],
    currentIndex: 0,
    mode: 'sync',
    updatedAt: Date.now(),
  };
}

export function serializeBroadcastDeck(state: BroadcastDeckState): string {
  return JSON.stringify(state);
}

/**
 * 嚴格遵守 Supabase 免費額度之「一鍵銷毀全部快照」：
 * 刪除本房間在 Storage 中所有講義快照檔案，容量瞬間歸零！
 */
export async function deleteRoomSlideDeck(roomId: string, slideUrls?: string[]): Promise<void> {
  const filePaths: string[] = [];
  
  // 動態列出該教室資料夾下所有歷史快照檔案（包含帶時間戳的圖片）
  try {
    const { data: files } = await supabase.storage.from('class_assets').list(roomId);
    if (files && files.length > 0) {
      for (const f of files) {
        // 嚴格限定只清除講義快照 (slide_ 或 screen_ 開頭)，絕不誤刪學生作答畫作！
        if (f.name && (f.name.startsWith('slide_') || f.name.startsWith('screen_'))) {
          filePaths.push(`${roomId}/${f.name}`);
        }
      }
    }
  } catch (err) {
    console.warn('Error listing room files in storage:', err);
  }

  if (slideUrls && slideUrls.length > 0) {
    for (const url of slideUrls) {
      try {
        const cleanUrl = url.split('?')[0]; // Remove timestamp query param
        const parts = cleanUrl.split('/class_assets/');
        if (parts[1]) {
          filePaths.push(decodeURIComponent(parts[1]));
        }
      } catch (e) {
        console.warn('Error parsing slide path for deletion:', url, e);
      }
    }
  }

  // 保證清除可能存在的單圖快照與 0~25 頁快照
  filePaths.push(`${roomId}/screen_broadcast.webp`);
  for (let i = 0; i <= 25; i++) {
    filePaths.push(`${roomId}/slide_${i}.webp`);
  }

  const uniquePaths = Array.from(new Set(filePaths));

  if (uniquePaths.length > 0) {
    try {
      const { error } = await supabase.storage.from('class_assets').remove(uniquePaths);
      if (error) {
        console.warn('Supabase storage remove error:', error.message);
      } else {
        console.log(`[Storage Cleanup] 成功清空 ${uniquePaths.length} 個講義檔案路徑，空間已完全釋放歸零！`);
      }
    } catch (err) {
      console.warn('Exception during storage cleanup:', err);
    }
  }
}

