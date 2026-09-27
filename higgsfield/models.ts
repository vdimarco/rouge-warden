// List the models the Higgsfield API offers (free; no generation).
//   npm run models [-- <filter>]      e.g. npm run models -- video

import { api, fail, clip, done } from './lib.ts';

type Model = { slug: string; title: string; operation_type: string[] };
const filter = (process.argv[2] ?? '').toLowerCase();
const res = await api('/models?size=100');
if (!res.ok) fail(`the model list got HTTP ${res.status}: ${clip(await res.text().catch(() => ''))}`);
const { items = [] } = (await res.json()) as { items?: Model[] };
const rows = items.filter((m) => !filter || `${m.slug} ${m.title} ${m.operation_type.join(' ')}`.toLowerCase().includes(filter));
for (const m of rows) console.log(`${m.operation_type.join('/').padEnd(24)} ${m.slug.padEnd(56)} ${m.title}`);
console.error(`${rows.length} of ${items.length} models.`);
done();
