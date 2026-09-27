// List the models the Higgsfield API offers (free; no generation).
//   npm run models [-- <filter>]      e.g. npm run models -- video

import { api, fail, clip, done } from './lib.ts';

type Model = { slug: string; title: string; operation_type: string[] };
const filter = (process.argv[2] ?? '').toLowerCase();
const items: Model[] = [];
let total = 0;
for (let page = 1; page <= 20; page++) {
  const res = await api(`/models?page=${page}&size=100`);
  if (!res.ok) fail(`the model list got HTTP ${res.status}: ${clip(await res.text().catch(() => ''))}`);
  const d = (await res.json()) as { items?: Model[]; total?: number };
  total = d.total ?? 0;
  items.push(...(d.items ?? []));
  if (!d.items?.length || items.length >= total) break;
}
if (items.length < total) fail(`the model list stopped at ${items.length} of ${total} models.`);
const rows = items.filter((m) => !filter || `${m.slug} ${m.title} ${m.operation_type.join(' ')}`.toLowerCase().includes(filter));
for (const m of rows) console.log(`${m.operation_type.join('/').padEnd(24)} ${m.slug.padEnd(56)} ${m.title}`);
console.error(`${rows.length} of ${items.length} models.`);
done();
