import { VISION_ENDPOINT, VISION_ANON_KEY } from '../config.js';
import { HEROES } from '../engine/data.js';

export function isVisionConfigured() {
  return !!VISION_ENDPOINT;
}

// Downscale + re-encode to JPEG before upload. Phone photos of a screen are
// large; capping the long edge keeps the request small and cuts vision token
// cost without hurting hero recognition.
function fileToDownscaledBase64(file, maxDim = 1280) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mediaType: 'image/jpeg' });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('could not read image')); };
    img.src = url;
  });
}

// Send a photo to the cloud-vision endpoint and get back hero ids for `team`.
// The endpoint (a Supabase edge function) runs Claude vision against the roster
// we pass and returns { heroes: ["winston", ...] }.
export async function detectHeroesFromPhoto(file, team) {
  if (!VISION_ENDPOINT) throw new Error('vision endpoint not configured');
  const { base64, mediaType } = await fileToDownscaledBase64(file);
  const roster = HEROES.map((h) => ({ id: h.id, name: h.name }));
  const res = await fetch(VISION_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(VISION_ANON_KEY ? { Authorization: `Bearer ${VISION_ANON_KEY}`, apikey: VISION_ANON_KEY } : {}),
    },
    body: JSON.stringify({ image: base64, mediaType, team, roster }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error || ''; } catch { /* ignore */ }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  const data = await res.json();
  if (Array.isArray(data.heroes)) return data.heroes;
  if (Array.isArray(data[team])) return data[team];
  return [];
}
