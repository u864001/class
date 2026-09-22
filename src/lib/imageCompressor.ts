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
