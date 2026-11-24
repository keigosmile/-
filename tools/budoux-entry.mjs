import { loadDefaultJapaneseParser } from 'budoux';
const p = loadDefaultJapaneseParser();
window.BudouxJa = { parse: (s) => p.parse(s) };
