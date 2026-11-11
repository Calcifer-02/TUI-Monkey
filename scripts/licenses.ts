import {readdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const sections: string[] = [];
const seen = new Set<string>();
async function collect(name: string) {
  if (seen.has(name)) return;
  seen.add(name);
  const dir = join('node_modules', name);
  try {
    const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
    const files = (await readdir(dir)).filter(f => /^(licen[cs]e|copying|notice)(\.|$)/i.test(f));
    sections.push(`=== ${name}@${pkg.version} (${pkg.license ?? 'see source'}) ===`);
    for (const file of files) sections.push(await readFile(join(dir, file), 'utf8'));
    for (const dep of Object.keys(pkg.dependencies ?? {})) await collect(dep);
  } catch (e) { throw new Error(`Лицензия недоступна: ${name}`, {cause: e}); }
}
for (const name of ['ink', 'react', 'zod', 'string-width', 'react-devtools-core']) await collect(name);
const bunLicense = await fetch('https://raw.githubusercontent.com/oven-sh/bun/bun-v1.3.12/LICENSE.md');
if (!bunLicense.ok) throw new Error('Лицензия Bun недоступна.');
sections.push('=== Bun runtime ===\n' + await bunLicense.text());
await writeFile('extension/DEPENDENCY_LICENSES.txt', sections.join('\n\n'));
