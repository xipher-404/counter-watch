import { openDB } from 'idb';

const DB_NAME = 'counter-watch';
const DB_VERSION = 1;
const PORTRAITS_STORE = 'portraits';

let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PORTRAITS_STORE)) {
          db.createObjectStore(PORTRAITS_STORE);
        }
      },
    });
  }
  return dbPromise;
}

export async function savePortrait(heroId, fileBlob) {
  const d = await db();
  await d.put(PORTRAITS_STORE, fileBlob, heroId);
}

export async function getPortraitBlob(heroId) {
  const d = await db();
  return d.get(PORTRAITS_STORE, heroId);
}

export async function deletePortrait(heroId) {
  const d = await db();
  await d.delete(PORTRAITS_STORE, heroId);
}

export async function listSavedPortraits() {
  const d = await db();
  return d.getAllKeys(PORTRAITS_STORE);
}
