import { VISION_ENDPOINT, VISION_ANON_KEY } from '../config.js';

export function isVisionConfigured() {
  return !!VISION_ENDPOINT;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result); // data:image/...;base64,XXXX
      resolve({ base64: result.slice(result.indexOf(',') + 1), mediaType: file.type || 'image/jpeg' });
    };
    reader.onerror = () => reject(new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}

// Send a photo to the cloud-vision endpoint and get back hero ids for `team`.
// The endpoint (a Supabase edge function) runs Claude vision and returns
// { heroes: ["winston", ...] } (or { mine:[...], enemy:[...] }). Phase B.
export async function detectHeroesFromPhoto(file, team) {
  if (!VISION_ENDPOINT) throw new Error('vision endpoint not configured');
  const { base64, mediaType } = await fileToBase64(file);
  const res = await fetch(VISION_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(VISION_ANON_KEY ? { Authorization: `Bearer ${VISION_ANON_KEY}`, apikey: VISION_ANON_KEY } : {}),
    },
    body: JSON.stringify({ image: base64, mediaType, team }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data.heroes)) return data.heroes;
  if (Array.isArray(data[team])) return data[team];
  return [];
}
