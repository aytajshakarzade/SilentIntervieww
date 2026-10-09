// reportPrefs — favorite/archive state for reports.
//
// The backend Report entity has no "favorite" or "archived" concept
// (see ReportQueryParameters.cs — only InterviewSessionId/MinScore/MaxScore
// are supported). Rather than pretend these sync across devices, we store
// them locally per-browser and label them as such in the UI.
import { STORAGE_KEYS } from '../constants/storageKeys';

const FAVORITES_KEY = `${STORAGE_KEYS.auth}.report-favorites`;
const ARCHIVED_KEY = `${STORAGE_KEYS.auth}.report-archived`;

function readSet(key) {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function writeSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    /* storage unavailable — state simply won't persist */
  }
}

export function getFavorites() {
  return readSet(FAVORITES_KEY);
}

export function toggleFavorite(reportId) {
  const set = readSet(FAVORITES_KEY);
  if (set.has(reportId)) set.delete(reportId); else set.add(reportId);
  writeSet(FAVORITES_KEY, set);
  return set;
}

export function getArchived() {
  return readSet(ARCHIVED_KEY);
}

export function toggleArchived(reportId) {
  const set = readSet(ARCHIVED_KEY);
  if (set.has(reportId)) set.delete(reportId); else set.add(reportId);
  writeSet(ARCHIVED_KEY, set);
  return set;
}
