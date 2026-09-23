/**
 * Supabase & Backend Storage Integration Service
 * Compresses and routes item images to FastAPI backend (/api/v1/items/upload-image)
 * with direct Supabase Storage bucket ('item-images') sync and detailed logging.
 */

import { CompressionResult } from '../utils/imageCompressor';

const SUPABASE_PROJECT_REF = import.meta.env.VITE_SUPABASE_PROJECT || 'dhuxosaclrchhfmvrria';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || `https://${SUPABASE_PROJECT_REF}.supabase.co`;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_pCciqXpswa6hLDVFgc6Rsg_JKjtDGhE';
const BUCKET_NAME = 'item-images';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export interface UploadImageResult {
  url: string;
  id: string;
  name: string;
  sizeBytes: number;
  originalSizeBytes: number;
  storageProvider: 'supabase' | 'local_media' | 'local_optimized';
  supabaseStatus?: number | null;
  supabaseError?: string | null;
}

/**
 * Uploads a compressed image via Backend API (which uploads to Supabase and logs all steps),
 * with graceful direct Supabase and local fallbacks.
 */
export async function uploadItemImage(
  businessId: string,
  itemId: string,
  compressed: CompressionResult,
  imageIndex: number
): Promise<UploadImageResult> {
  const imageId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const sanitizedName = compressed.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${businessId || 'default'}/${itemId || 'temp'}/${imageIndex}_${imageId}_${sanitizedName}`;

  // 1. Primary Strategy: Upload via FastAPI Backend Endpoint
  // This triggers server-side Pillow verification, Supabase storage sync, and detailed backend terminal logs.
  try {
    const formData = new FormData();
    const imageBlob = compressed.blob || new Blob([compressed.file], { type: 'image/webp' });
    const imageFile = new File([imageBlob], sanitizedName.endsWith('.webp') ? sanitizedName : `${sanitizedName}.webp`, {
      type: 'image/webp',
    });

    formData.append('file', imageFile);
    formData.append('item_id', itemId || 'temp');
    formData.append('order', String(imageIndex));
    formData.append('is_primary', String(imageIndex === 0));

    const authUserJson = localStorage.getItem('qb_auth_user');
    let authToken = '';
    if (authUserJson) {
      try {
        const parsed = JSON.parse(authUserJson);
        authToken = parsed.token || '';
      } catch (e) {
        // ignore parse error
      }
    }

    const headers: Record<string, string> = {
      'X-Business-ID': businessId || '65f2a1b9a000000000000001',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    console.info(
      `%c[QuickBill Upload]%c Sending image to backend ${API_BASE_URL}/items/upload-image...`,
      'background: #2563eb; color: #fff; font-weight: bold; border-radius: 3px; padding: 2px 6px;',
      'color: #2563eb;'
    );

    const backendRes = await fetch(`${API_BASE_URL}/items/upload-image`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (backendRes.ok) {
      const data = await backendRes.json();
      console.info(
        `%c[QuickBill Upload Success]%c Image stored via ${data.storageProvider}. URL: ${data.url}`,
        'background: #16a34a; color: #fff; font-weight: bold; border-radius: 3px; padding: 2px 6px;',
        'color: #16a34a;',
        data
      );
      return {
        url: data.url,
        id: data.id || imageId,
        name: data.name || compressed.file.name,
        sizeBytes: data.sizeBytes || compressed.compressedSizeBytes,
        originalSizeBytes: data.originalSizeBytes || compressed.originalSizeBytes,
        storageProvider: data.storageProvider === 'supabase' ? 'supabase' : 'local_media',
        supabaseStatus: data.supabaseStatus,
        supabaseError: data.supabaseError,
      };
    } else {
      console.warn(
        `%c[QuickBill Backend Upload Error]%c Server returned ${backendRes.status}. Attempting direct Supabase fallback...`,
        'background: #ea580c; color: #fff; font-weight: bold; border-radius: 3px; padding: 2px 6px;',
        'color: #ea580c;'
      );
    }
  } catch (backendErr) {
    console.warn(
      `%c[QuickBill Backend Offline]%c Backend not reachable (${backendErr}). Attempting direct Supabase upload...`,
      'background: #f59e0b; color: #000; font-weight: bold; border-radius: 3px; padding: 2px 6px;',
      'color: #f59e0b;'
    );
  }

  // 2. Secondary Strategy: Direct Browser-to-Supabase Storage REST Upload
  try {
    const uploadEndpoint = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${filePath}`;
    console.info(`[Direct Supabase Upload] POST ${uploadEndpoint}`);

    const response = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': compressed.file.type || 'image/webp',
        'x-upsert': 'true',
      },
      body: compressed.blob,
    });

    if (response.ok) {
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${filePath}`;
      console.info(`[Direct Supabase Upload Success] Public CDN: ${publicUrl}`);
      return {
        url: publicUrl,
        id: imageId,
        name: compressed.file.name,
        sizeBytes: compressed.compressedSizeBytes,
        originalSizeBytes: compressed.originalSizeBytes,
        storageProvider: 'supabase',
        supabaseStatus: response.status,
      };
    } else {
      const errText = await response.text();
      console.warn(`[Direct Supabase Error] HTTP ${response.status}: ${errText}`);
    }
  } catch (err) {
    console.warn('[Direct Supabase Network Error]:', err);
  }

  // 3. High-speed local optimized Data URL fallback
  console.info('%c[QuickBill Storage Fallback]%c Storing client-compressed WebP Data URL in local tenant state.', 'background: #64748b; color: #fff; padding: 2px 6px;', 'color: #64748b;');
  return {
    url: compressed.dataUrl,
    id: imageId,
    name: compressed.file.name,
    sizeBytes: compressed.compressedSizeBytes,
    originalSizeBytes: compressed.originalSizeBytes,
    storageProvider: 'local_optimized',
  };
}

/**
 * Deletes item images from Supabase Storage and local media files.
 * Triggered only after the user commits changes by saving or deleting a product.
 */
export async function deleteItemImages(
  businessId: string,
  imageUrls: string[]
): Promise<{ deletedPaths?: string[]; success: boolean }> {
  const validUrls = imageUrls.filter(u => u && !u.startsWith('data:'));
  if (validUrls.length === 0) return { success: true };

  // 1. Primary: Call backend deletion endpoint
  try {
    const authUserJson = localStorage.getItem('qb_auth_user');
    let authToken = '';
    if (authUserJson) {
      try {
        const parsed = JSON.parse(authUserJson);
        authToken = parsed.token || '';
      } catch (e) {
        // ignore parse error
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Business-ID': businessId || '65f2a1b9a000000000000001',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    console.info(
      `%c[QuickBill Delete]%c Requesting deletion of ${validUrls.length} image(s) after save...`,
      'background: #dc2626; color: #fff; font-weight: bold; border-radius: 3px; padding: 2px 6px;',
      'color: #dc2626;',
      validUrls
    );

    const res = await fetch(`${API_BASE_URL}/items/delete-images`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ image_urls: validUrls }),
    });

    if (res.ok) {
      const data = await res.json();
      console.info(
        `%c[QuickBill Delete Success]%c Cleaned up remote storage objects from Supabase.`,
        'background: #16a34a; color: #fff; font-weight: bold; border-radius: 3px; padding: 2px 6px;',
        'color: #16a34a;',
        data
      );
      return { success: true, deletedPaths: data.deletedPaths };
    }
  } catch (err) {
    console.warn('[QuickBill Backend Delete Error]:', err);
  }

  // 2. Secondary fallback: Direct Supabase REST deletion
  try {
    const prefixes = validUrls.map(u => {
      if (u.includes('/item-images/')) return u.split('/item-images/')[1].split('?')[0];
      return u.replace(/^\/+/, '');
    });

    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes }),
    });

    if (res.ok) {
      console.info('[Direct Supabase Delete Success] Cleaned up Supabase objects:', prefixes);
      return { success: true, deletedPaths: prefixes };
    }
  } catch (err) {
    console.warn('[Direct Supabase Delete Error]:', err);
  }

  return { success: false };
}
