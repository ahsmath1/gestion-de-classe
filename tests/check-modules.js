import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsRoot = path.join(root, 'js');
const files = [];
function walk(dir) { for (const e of fs.readdirSync(dir, {withFileTypes:true})) { const p=path.join(dir,e.name); if(e.isDirectory()) walk(p); else if(p.endsWith('.js')) files.push(p); } }
walk(jsRoot);
let errors=[];
for (const file of files) {
  const src=fs.readFileSync(file,'utf8');
  try { new vm.SourceTextModule(src, { identifier:file }); }
  catch(e) { errors.push(`${path.relative(root,file)}: ${e.message}`); }
}
if(errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Syntaxe ES modules vérifiée : ${files.length} fichiers.`);
