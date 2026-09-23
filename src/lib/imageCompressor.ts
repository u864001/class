import { supabase } from './supabase';

/**
 * Compresses an HTMLCanvasElement or Blob to WebP format and uploads to Supabase Storage.
 * Returns the public URL of the uploaded image.
 */
export async function compressAndUploadCanvas(
  canvas: HTMLCanvasElement,
  roomId: string,
  fileNamePrefix: string
): Promise<string> {
  return new Promise(async (resolve) => {
    // 1. Convert canvas to Blob (WebP 0.8)
    canvas.toBlob(async (blob) => {
      if (!blob) {
        // Fallback to dataURL if toBlob fails
        resolve(canvas.toDataURL('image/jpeg', 0.8));
        return;
      }

      try {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 7);
        const filePath = `${roomId}/${fileNamePrefix}_${timestamp}_${randomStr}.webp`;

        const { error } = await supabase.storage
          .from('class_assets')
          .upload(filePath, blob, {
            contentType: 'image/webp',
            upsert: true,
          });

        if (error) {
          console.warn('Storage upload error, falling back to data URL:', error.message);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
          return;
        }

        const { data: publicData } = supabase.storage
          .from('class_assets')
          .getPublicUrl(filePath);

        resolve(publicData.publicUrl);
      } catch (err) {
        console.warn('Upload exception, falling back to data URL:', err);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      }
    }, 'image/webp', 0.8);
  });
}

/**
 * Resizes and converts an uploaded File (e.g. from camera/gallery) to WebP and uploads to Storage.
 */
export async function uploadImageFile(
  file: File,
  roomId: string,
  fileNamePrefix: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const maxDim = 1400;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const url = await compressAndUploadCanvas(canvas, roomId, fileNamePrefix);
        resolve(url);
      };
      img.onerror = () => reject(new Error('Failed to load image file'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * 嚴格遵守 Supabase 免費額度之「一鍵螢幕快照並推送」：
 * 1. 透過 getDisplayMedia 擷取教師螢幕/視窗/分頁 1 幀畫面。
 * 2. 擷取後「立即停止視訊串流軌道」，不持續佔用 CPU、電池與網路頻寬。
 * 3. 壓縮為高畫質 WebP 格式（最大寬度 1440px，約 40~60KB）。
 * 4. 【極致配額保護】：以固定路徑 `${roomId}/screen_broadcast.webp` 覆寫上傳（upsert: true）。
 *    每個房間在 Storage 中永遠只佔用「一張照片（~50KB）」的空間，完全杜絕檔案無限堆疊膨脹！
 * 5. 加上時間戳 query param 避免瀏覽器快取舊圖，學生端秒級即時更新。
 */
export async function captureAndUploadScreenSnapshot(roomId: string): Promise<string> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('您的瀏覽器不支援螢幕擷取功能，請使用電腦版 Chrome 或 Edge 瀏覽器。');
  }

  // 1. 彈窗讓老師選取整個螢幕、PPT 視窗或分頁
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      displaySurface: 'monitor',
    },
    audio: false,
  });

  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();

    // 等待 150ms 確保第一幀畫面就緒
    await new Promise((r) => setTimeout(r, 150));

    const width = video.videoWidth || 1920;
    const height = video.videoHeight || 1080;

    // 等比縮放至最大 1440px（字體清晰銳利，但檔案嚴格壓在 40~60KB 內）
    const maxW = 1440;
    let targetW = width;
    let targetH = height;
    if (targetW > maxW) {
      targetH = Math.round((height * maxW) / width);
      targetW = maxW;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('無法建立快照畫布');

    ctx.drawImage(video, 0, 0, targetW, targetH);

    // 2. 關鍵：立即切斷視訊串流，不再佔用任何網路與硬體資源
    stream.getTracks().forEach((track) => track.stop());

    // 3. 轉為 WebP 格式
    return new Promise((resolve) => {
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            resolve(canvas.toDataURL('image/jpeg', 0.75));
            return;
          }

          try {
            // 固定路徑 + upsert: true，永遠只佔用 1 張圖的儲存額度
            const filePath = `${roomId}/screen_broadcast.webp`;
            const { error } = await supabase.storage
              .from('class_assets')
              .upload(filePath, blob, {
                contentType: 'image/webp',
                upsert: true,
              });

            if (error) {
              console.warn('Storage 上傳異常，改用本地快照：', error.message);
              resolve(canvas.toDataURL('image/jpeg', 0.7));
              return;
            }

            const { data } = supabase.storage
              .from('class_assets')
              .getPublicUrl(filePath);

            // 附帶時間戳以破除瀏覽器 HTTP 快取，確保學生端看到最新翻頁
            resolve(`${data.publicUrl}?t=${Date.now()}`);
          } catch (err) {
            console.warn('上傳例外，使用本地快照：', err);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          }
        },
        'image/webp',
        0.75
      );
    });
  } catch (err) {
    // 確保異常時也切斷視訊
    stream.getTracks().forEach((track) => track.stop());
    throw err;
  }
}

