import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.development", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data, error } = await supabase
  .from("cromo")
  .select("id, name, labels_id, category_id, number, variant")
  .order("labels_id", { ascending: true })
  .order("id", { ascending: true });

if (error) {
  console.error(error);
  process.exit(1);
}

const groups = new Map();
for (const row of data) {
  if (!groups.has(row.labels_id)) groups.set(row.labels_id, []);
  groups.get(row.labels_id).push(row);
}

console.log("Total cromos:", data.length);
console.log("Distinct labels_id:", groups.size);
console.log("");
console.log("Duplicates:");
for (const [labels_id, rows] of groups) {
  if (rows.length > 1) {
    console.log(`  labels_id=${labels_id} (${rows.length} cromos):`);
    for (const r of rows) {
      console.log(
        `    cromo id=${r.id} name="${r.name}" cat=${r.category_id} num=${r.number} var=${r.variant}`,
      );
    }
  }
}
