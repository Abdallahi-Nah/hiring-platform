import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const st = JSON.parse(readFileSync(process.argv[2] + "/state5.json", "utf8"));
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
for (const c of st.cos ?? []) await db.from("job_forms").delete().eq("company_id", c);
for (const id of st.userIds ?? []) { const r = await db.auth.admin.deleteUser(id); if (r.error) console.log("user", r.error.message); }
for (const c of st.cos ?? []) { const r = await db.from("companies").delete().eq("id", c); if (r.error) console.log("company", r.error.message); }
const { count } = await db.from("companies").select("id", { count: "exact", head: true }).in("id", st.cos?.length ? st.cos : ["00000000-0000-0000-0000-000000000000"]);
const { data: users } = await db.auth.admin.listUsers({ perPage: 200 });
console.log("entreprises restantes:", count, "| comptes restants:", users.users.filter((u) => (st.userIds ?? []).includes(u.id)).length);
