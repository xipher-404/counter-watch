import { getPortraitBlob, listSavedPortraits } from './storage.js';

const blobUrlCache = new Map();
let savedKeysCache = null;

export async function refreshPortraitCache() {
  savedKeysCache = new Set(await listSavedPortraits());
}

export function hasSavedPortrait(heroId) {
  return savedKeysCache ? savedKeysCache.has(heroId) : false;
}

export async function getPortraitURL(hero) {
  if (savedKeysCache === null) await refreshPortraitCache();
  if (savedKeysCache.has(hero.id)) {
    if (blobUrlCache.has(hero.id)) return blobUrlCache.get(hero.id);
    const blob = await getPortraitBlob(hero.id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      blobUrlCache.set(hero.id, url);
      return url;
    }
  }
  return `assets/heroes/${hero.portrait_file}`;
}

export function invalidatePortrait(heroId) {
  if (blobUrlCache.has(heroId)) {
    URL.revokeObjectURL(blobUrlCache.get(heroId));
    blobUrlCache.delete(heroId);
  }
  if (savedKeysCache) savedKeysCache.delete(heroId);
}

export function markPortraitSaved(heroId) {
  if (savedKeysCache) savedKeysCache.add(heroId);
  if (blobUrlCache.has(heroId)) {
    URL.revokeObjectURL(blobUrlCache.get(heroId));
    blobUrlCache.delete(heroId);
  }
}

export function placeholderInitials(hero) {
  const parts = hero.name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}
