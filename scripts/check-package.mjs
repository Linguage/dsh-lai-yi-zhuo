import assert from 'node:assert/strict'
import {readFile,mkdtemp,writeFile,mkdir,readdir} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {createServer} from 'node:http'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {runInNewContext} from 'node:vm'
const manifest=JSON.parse(await readFile('package.json','utf8')),filename=`${manifest.name}-${manifest.version}.tgz`,packed=resolve('dist',filename),temp=await mkdtemp(join(tmpdir(),'dsh-board-games-package-'))
const sha=createHash('sha256').update(await readFile(packed)).digest('hex');assert((await readFile('dist/SHA256SUMS','utf8')).includes(sha+'  '+filename))
execFileSync('tar',['-xzf',packed,'-C',temp]);const root=join(temp,'package'),pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'))
assert.equal(pkg.name,manifest.name);assert.equal(pkg.version,manifest.version);assert(!Object.keys(pkg.dependencies||{}).length);assert(!(await readdir(root)).includes('node_modules'))
for(const name of ['chess.js','react','react-dom','scheduler'])assert((await readFile(join(root,'THIRD_PARTY_NOTICES.txt'),'utf8')).includes(name))
const host=await import(pathToFileURL(join(root,'lib/index.js')));let route
host.apply({effect(fn){fn()},webServer:{register(r){route=r;return()=>{}}}});assert.equal(route.path,'/board-games')
let client
runInNewContext(await readFile(join(root,'lib/client.js'),'utf8'),{window:{__ModuleLoader__:{load(m){assert.equal(m.id,pkg.name);client=m.factory(()=>({createElement:(...args)=>args}))}}}})
const slots=[];client.apply({slots:{inject(name,fn){fn()},register(config,render){slots.push({config,render})}}});assert(slots.some(s=>s.config.id==='board-games'&&s.config.label()==='来一桌'));assert.equal(slots.find(s=>s.config.key==='board-games').render()[1].src,'/board-games/')
const server=createServer(route.handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}/board-games/`
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true}),errors=[],external=[],workers=[]
try{
 for(const viewport of [{width:1280,height:900},{width:390,height:844},{width:844,height:390},{width:320,height:720}]){
  const context=await browser.newContext({viewport}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:'))external.push(r.url())});page.on('worker',w=>workers.push(w.url()))
  await page.goto(base);await page.getByRole('heading',{name:'来一桌',exact:true}).waitFor();await page.getByRole('button',{name:'进入棋桌',exact:true}).click();await page.getByRole('button',{name:'选择中国象棋',exact:true}).click();await page.getByRole('button',{name:'开始对弈',exact:false}).click()
  await page.getByRole('button',{name:'a4 红方兵',exact:true}).click();await page.getByRole('button',{name:'a5 空位',exact:true}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('dsh-board-games-xiangqi-v1')).moves.length===2)
  assert.equal(await page.locator('.xiangqi-glyph').count(),await page.locator('.royal-cell .royal-piece').count());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`artifacts/qa/xiangqi-aligned-${viewport.width}.png`,fullPage:true})
  if(viewport.width===1280){const bounds=await page.locator('.table-frame').boundingBox();assert(bounds.y+bounds.height<=viewport.height+1,'desktop Xiangqi should fit vertically')}
  if(viewport.width===390){
   await page.getByRole('button',{name:'返回棋桌',exact:true}).click();await page.getByRole('button',{name:'选择国际象棋',exact:true}).click();await page.getByRole('button',{name:'开始对弈',exact:false}).click();await page.screenshot({path:'artifacts/qa/chess-final-390.png',fullPage:true})
  }
  await context.close()
 }
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('worker',w=>workers.push(w.url()));await page.goto(base)
 // The other three workers must run from the extracted package too.
 for(const [group,title,key] of [['chess','五子棋','dsh-board-games-session-v1'],['cards','掼蛋','dsh-board-games-guandan-v1'],['cards','双扣','dsh-board-games-shuangkou-v1']]){
  await page.evaluate(g=>sessionStorage.setItem('dsh-table-group',g),group);await page.reload();await page.getByRole('button',{name:'选择'+title,exact:true}).click();await page.getByRole('button',{name:'1 档 入门',exact:true}).click();await page.getByRole('button',{name:/开始对弈|开始练习/}).click();await page.getByRole('button',{name:title==='五子棋'?'开启下棋建议':'开启建议',exact:true}).click();await page.waitForFunction(()=>!!document.querySelector('.hint-ring,.hint-card'))
 }
 for(const worker of ['royal','engine','cards','table'])assert(workers.some(w=>w.includes(worker+'.worker-')),worker+' worker did not run')
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await context.close();const report={passed:true,version:manifest.version,sha256:sha,isolatedDirectory:root,noNodeModules:true,noRuntimeDependencies:true,hostRegistration:true,clientRegistration:true,workers:4,xiangqiAlignmentViewports:4,errors,externalRequests:external,installedHostTested:false}
 await mkdir('artifacts/qa',{recursive:true});await writeFile('artifacts/qa/isolated-package-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
