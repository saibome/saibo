import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const flags = {};
for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^--([\w-]+)=(.*)$/);
  if (m) flags[m[1]] = m[2];
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const date = today();
const filePath = join('src', 'content', 'notes', `${date}.md`);

if (existsSync(filePath)) {
  console.error(`文件已存在: ${filePath}`);
  process.exit(1);
}

const mood = flags.mood || '晴';
writeFileSync(filePath, `---\ndate: ${date}\nmood: ${mood}\n---\n`, 'utf8');
console.log(`已创建: ${filePath}`);
