// Vérifie les traductions : mêmes clés, mêmes {variables}, aucun texte vide.
// Usage : npx tsx --tsconfig tsconfig.json scripts/check-i18n.ts
import { ar } from "../src/i18n/messages/ar";
import { en } from "../src/i18n/messages/en";
import { fr } from "../src/i18n/messages/fr";

type Node = string | { [k: string]: Node };
const PLURAL_KEYS = new Set(["zero", "one", "two", "few", "many", "other"]);

function flatten(node: Node, prefix = "", out: Record<string, string> = {}) {
  if (typeof node === "string") {
    out[prefix] = node;
  } else {
    for (const [k, v] of Object.entries(node)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

const base = flatten(en as unknown as Node);
let problems = 0;
for (const [name, messages] of [["fr", fr], ["ar", ar]] as const) {
  const flat = flatten(messages as unknown as Node);
  for (const key of Object.keys(base)) {
    const isPlural = PLURAL_KEYS.has(key.split(".").pop()!);
    if (!(key in flat)) {
      if (!isPlural) { console.log(`[${name}] clé manquante : ${key}`); problems++; }
      continue;
    }
    if (flat[key].trim() === "") { console.log(`[${name}] texte vide : ${key}`); problems++; }
    // Les formes de pluriel peuvent omettre {n} (ex. "une offre"), les autres textes non.
    if (!isPlural && vars(flat[key]) !== vars(base[key])) {
      console.log(`[${name}] variables différentes : ${key}  (en: {${vars(base[key])}}  ${name}: {${vars(flat[key])}})`);
      problems++;
    }
  }
  for (const key of Object.keys(flat)) if (!(key in base) && !PLURAL_KEYS.has(key.split(".").pop()!)) { console.log(`[${name}] clé en trop : ${key}`); problems++; }
}
console.log(`${Object.keys(base).length} textes de référence (en) ; ${problems} problème(s).`);
process.exit(problems ? 1 : 0);
