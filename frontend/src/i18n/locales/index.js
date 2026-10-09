// Central re-export of all locale dictionaries.
// Each locale file uses `export default { ... }` — we collect them here and
// expose a single `DICTIONARIES` map so i18n/index.jsx can do:
//   import { DICTIONARIES } from './locales';
import az from './az';
import en from './en';
import ru from './ru';

export const DICTIONARIES = { az, en, ru };
