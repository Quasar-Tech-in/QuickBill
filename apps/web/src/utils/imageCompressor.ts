/**
 * Client-Side Image Compression Utility
 * Resizes large camera photos and reduces MBs down to optimal web payloads (< 100KB)
 * while preserving high fidelity.
 */

export interface CompressionResult {
  file: File;
  blob: Blob;
  dataUrl: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatio: string;
  width: number;
  height: number;
}

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
  mimeType?: string; // 'image/webp' or 'image/jpeg'
}

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 1000,
    maxHeight = 1000,
    quality = 0.82,
    mimeType = 'image/webp',
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read image file'));

    reader.onload = (event) => {
      const img = new Image();

      img.onerror = () => reject(new Error('Failed to load image for compression'));

      img.onload = () => {
        let { width, height } = img;

        // Calculate scaled dimensions while maintaining aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Unable to create canvas 2D rendering context'));
          return;
        }

        // Use high quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas toBlob failed'));
              return;
            }

            const dataUrl = canvas.toDataURL(mimeType, quality);
            const fileName = file.name.replace(/\.[^/.]+$/, '') + (mimeType === 'image/webp' ? '.webp' : '.jpg');
            const compressedFile = new File([blob], fileName, {
              type: mimeType,
              lastModified: Date.now(),
            });

            const originalSize = file.size;
            const compressedSize = blob.size;
            const savingsPercent = originalSize > 0
              ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100))
              : 0;

            resolve({
              file: compressedFile,
              blob,
              dataUrl,
              originalSizeBytes: originalSize,
              compressedSizeBytes: compressedSize,
              compressionRatio: `-${savingsPercent}%`,
              width,
              height,
            });
          },
          mimeType,
          quality
        );
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Format bytes to readable string (e.g. 1.2 MB, 84 KB)
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
