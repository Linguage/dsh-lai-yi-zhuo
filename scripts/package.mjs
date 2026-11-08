import {execFileSync} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root)
// Always build immediately before packaging so the tarball cannot contain an old UI or worker.
execFileSync(process.execPath,['scripts/build.mjs'],{stdio:'inherit'})
await mkdir('dist',{recursive:true})
const [packed]=JSON.parse(execFileSync('npm',['pack','--ignore-scripts','--json','--pack-destination','dist'],{
  encoding:'utf8',env:{...process.env,npm_config_cache:join(root,'.cache/npm')}
}))
for(const file of ['package.json','lib/index.js','lib/client.js','lib/http.mjs','web/index.html','cordis.patch.yml','README.md','LICENSE','THIRD_PARTY_NOTICES.txt'])
  if(!packed.files.some(f=>f.path===file))throw Error('Missing runtime file '+file)
if(!packed.files.some(f=>/^web\/assets\/engine\.worker-.*\.js$/.test(f.path)))throw Error('Missing AI worker')
if(!packed.files.some(f=>/^web\/assets\/table\.worker-.*\.js$/.test(f.path)))throw Error('Missing four-player AI worker')
for(const name of ['royal','cards'])if(!packed.files.some(f=>f.path.startsWith(`web/assets/${name}.worker-`)&&f.path.endsWith('.js')))throw Error('Missing '+name+' worker')
if(packed.files.some(f=>!/^(package.json|README.md|LICENSE|THIRD_PARTY_NOTICES.txt|icon.svg|cordis.patch.yml|lib\/[^/]+|web\/index.html|web\/assets\/[^/]+)$/.test(f.path)))throw Error('Unexpected file in package')
const sha256=createHash('sha256').update(await readFile('dist/'+packed.filename)).digest('hex')
await writeFile('dist/SHA256SUMS',sha256+'  '+packed.filename+'\n')
const report={file:'dist/'+packed.filename,bytes:packed.size,unpackedBytes:packed.unpackedSize,sha256,files:packed.files.map(f=>f.path)}
await mkdir('artifacts/qa',{recursive:true});await writeFile('artifacts/qa/package-results.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report))
