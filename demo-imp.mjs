import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const S = process.argv[2]; const puppeteer = createRequire(S + "/x.js")("puppeteer-core");
const BASE = "http://localhost:3100";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = (r, l) => { if (r.error) throw new Error(l + ": " + r.error.message); return r.data; };
const ok = (n, c) => console.log(c ? "PASS" : "FAIL", n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = "imp" + Date.now().toString(36); const pw = "Demo-" + tag + "-Aa1!";
const st = { tag, userIds: [], cos: [] }; const save = () => writeFileSync(S + "/state5.json", JSON.stringify(st, null, 1));
let b;
try {
  const mkCo = async (n) => { const c = must(await db.from("companies").insert({ name: "Imp Co " + n, slug: tag + n }).select().single(), "co"); st.cos.push(c.id); save(); return c; };
  const mkUser = async (email, role, co) => { const u = must(await db.auth.admin.createUser({ email, password: pw, email_confirm: true }), "user"); st.userIds.push(u.user.id); save(); must(await db.from("profiles").insert({ id: u.user.id, role, company_id: co.id, full_name: role + " " + co.name }), "profile"); return u.user.id; };
  const A = await mkCo("a"), B = await mkCo("b");
  const adminA = await mkUser(`${tag}-a@example.com`, "admin", A), revA = await mkUser(`${tag}-ra@example.com`, "reviewer", A), adminB = await mkUser(`${tag}-b@example.com`, "admin", B);
  must(await db.from("job_forms").insert({ title: "Assistant RH", company_id: A.id, created_by: adminA }), "existing job");
  b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, defaultViewport: { width: 1280, height: 900 }, args: ["--no-sandbox", "--disable-gpu", "--lang=en-US"] });
  const login = async (email) => { const ctx = await b.createBrowserContext(); const p = await ctx.newPage(); await p.setCookie({ name: "locale", value: "en", url: BASE }); p.on("pageerror", (e) => console.log("PAGEERR", e.message)); await p.goto(BASE + "/login", { waitUntil: "networkidle0" }); await p.type('input[type="email"]', email); await p.type('input[type="password"]', pw); await Promise.all([p.waitForNavigation({ waitUntil: "networkidle0" }), p.keyboard.press("Enter")]); return p; };
  const text = (p) => p.evaluate(() => document.body.innerText);
  const click = async (p, label) => { const o = await p.evaluate((label) => { const el = [...document.querySelectorAll("button,a")].find((e) => e.textContent.trim().includes(label) && e.offsetParent && !e.disabled); if (el) { el.click(); return true; } return false; }, label); if (!o) throw new Error("click " + label); };
  const upload = async (p, file) => { const inp = await p.$('input[type="file"]'); await inp.uploadFile(file); await sleep(500); };

  // ---- Admin A
  const pa = await login(`${tag}-a@example.com`);
  await pa.goto(BASE + "/admin/jobs", { waitUntil: "networkidle0" });
  ok("bouton « Import CSV » sur la page des offres", (await text(pa)).includes("Import CSV"));
  await click(pa, "Import CSV"); await pa.waitForFunction(() => document.body.innerText.includes("Import jobs from a CSV file"), { timeout: 20000 });
  const t0 = await text(pa);
  ok("tableau des colonnes (13 colonnes)", ["title", "work_mode", "employment_type", "salary_currency", "required_skills", "min_years"].every((c) => t0.includes(c)));
  await upload(pa, S + "/empty.csv"); await click(pa, "Check the file").catch(() => {});
  await upload(pa, S + "/notitle.csv"); await click(pa, "Check the file"); await pa.waitForFunction(() => document.body.innerText.includes("title column is missing"), { timeout: 20000 });
  ok("colonne titre absente : message clair", true);
  await upload(pa, S + "/bin.csv"); await click(pa, "Check the file"); await sleep(2500);
  const tb = await text(pa); ok("fichier binaire : aucune offre valide, rien ne plante", !/\d+ jobs imported/.test(tb));
  await upload(pa, S + "/big.csv"); await sleep(800); ok("fichier de plus de 1 Mo refusé côté navigateur", (await text(pa)).includes("too big"));
  await upload(pa, S + "/jobs-ok.csv"); await click(pa, "Check the file");
  await pa.waitForFunction(() => document.body.innerText.includes("valid,"), { timeout: 30000 });
  const tp = await text(pa); console.log("résumé:", (tp.match(/\d+ valid, \d+ with errors, \d+ with warnings/) ?? [""])[0]);
  ok("aperçu : 3 valides, 2 erreurs, 1 avertissement", /3 valid, 2 with errors, 1 with warnings/.test(tp));
  ok("aperçu : erreurs lisibles (colonne work_mode, salaire)", tp.includes("column work_mode") && tp.toLowerCase().includes("salary"));
  ok("aperçu : avertissement « existe déjà »", tp.includes("already exists"));
  const before = must(await db.from("job_forms").select("id").eq("company_id", A.id), "count");
  ok("aperçu : rien n'est enregistré", before.length === 1);
  await click(pa, "Import 3 jobs"); await pa.waitForFunction(() => document.body.innerText.includes("3 jobs imported"), { timeout: 30000 });
  ok("import terminé : « 3 jobs imported »", true);
  const jobs = must(await db.from("job_forms").select("id, title, is_active, company_id, created_by, department, location, work_mode, employment_type, deadline, salary_min, salary_max, salary_currency, reference, description, evaluation_criteria").eq("company_id", A.id).neq("title", "Assistant RH").order("title"), "jobs");
  const rh = must(await db.from("job_forms").select("id, title, is_active, salary_min, salary_max").eq("company_id", A.id).eq("title", "Assistant RH"), "rh");
  ok("3 nouvelles offres + l'ancienne « Assistant RH » intacte (2 au total pour ce titre ou 1 ancienne + 1 import)", jobs.length === 2 && rh.length === 2);
  const all = [...jobs, ...rh.filter((x) => x.salary_min === 800)];
  ok("toutes les offres importées sont inactives (brouillons)", all.every((j) => j.is_active === false));
  const dev = jobs.find((j) => j.title.startsWith("Développeur"));
  ok("offre complète : champs, date, salaire, devise, compétences, description multi-lignes", dev && dev.work_mode === "remote" && dev.employment_type === "full_time" && dev.deadline === "2099-12-31" && dev.salary_min === 3000 && dev.salary_max === 4500 && dev.salary_currency === "USD" && dev.reference === "ENG-001" && dev.description.includes("\n") && dev.evaluation_criteria.required_skills.join() === "TypeScript,NestJS" && dev.evaluation_criteria.min_years === 3);
  ok("entreprise et auteur viennent du compte, pas du fichier", all.every((j) => j.company_id === A.id) && jobs.every((j) => j.created_by === adminA));
  const ids = [...jobs.map((j) => j.id), ...rh.filter((x) => x.salary_min === 800).map((x) => x.id)];
  const qs = must(await db.from("questions").select("job_form_id, config").in("job_form_id", ids), "qs");
  ok("questions standard : 3 par offre (nom, email, téléphone)", ids.every((id) => qs.filter((q) => q.job_form_id === id).length === 3 && qs.some((q) => q.job_form_id === id && q.config?.identity === "email")));
  await pa.goto(BASE + "/admin/jobs", { waitUntil: "networkidle0" });
  ok("la liste des offres montre les offres importées", (await text(pa)).includes("Développeur Backend") && (await text(pa)).includes("Designer"));

  // ---- Relecteur : pas d'accès
  const pr = await login(`${tag}-ra@example.com`);
  await pr.goto(BASE + "/admin/jobs", { waitUntil: "networkidle0" }); ok("relecteur : pas de bouton d'import", !(await text(pr)).includes("Import CSV"));
  await pr.goto(BASE + "/admin/jobs/import", { waitUntil: "networkidle0" }); ok("relecteur : page d'import refusée (redirigé)", !pr.url().includes("/import"));

  // ---- Admin B : isolation, et import SANS les questions standard
  const pb = await login(`${tag}-b@example.com`);
  await pb.goto(BASE + "/admin/jobs", { waitUntil: "networkidle0" }); ok("admin B : ne voit aucune offre de A", !(await text(pb)).includes("Développeur Backend"));
  await pb.goto(BASE + "/admin/jobs/import", { waitUntil: "networkidle0" });
  await upload(pb, S + "/jobs-ok.csv"); await pb.evaluate(() => document.querySelector('input[type="checkbox"]').click());
  await click(pb, "Check the file"); await pb.waitForFunction(() => document.body.innerText.includes("valid,"), { timeout: 30000 });
  ok("admin B : « Assistant RH » n'est pas signalé comme existant (autre entreprise)", !(await text(pb)).includes("already exists"));
  await click(pb, "Import 3 jobs"); await pb.waitForFunction(() => document.body.innerText.includes("3 jobs imported"), { timeout: 30000 });
  const jb = must(await db.from("job_forms").select("id, company_id, created_by").eq("company_id", B.id), "jb");
  const ja = must(await db.from("job_forms").select("id").eq("company_id", A.id), "ja");
  ok("admin B : 3 offres dans l'entreprise B, A inchangée (4 offres)", jb.length === 3 && ja.length === 4 && jb.every((j) => j.created_by === adminB));
  const qb = must(await db.from("questions").select("id").in("job_form_id", jb.map((j) => j.id)), "qb");
  ok("sans la case : aucune question créée", qb.length === 0);
  // ---- RLS : B ne peut pas lire les offres de A avec sa propre session
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await sb.auth.signInWithPassword({ email: `${tag}-b@example.com`, password: pw });
  const { data: seen } = await sb.from("job_forms").select("id").eq("company_id", A.id);
  ok("RLS : B ne lit rien chez A", (seen ?? []).length === 0);
} catch (e) { console.log("ERREUR", e.message); }
finally { if (b) await b.close(); save(); }
