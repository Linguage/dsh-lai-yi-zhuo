import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHandler} from '../src/http.mjs'
test('Plugin serves its own UI and rejects traversal, writes and private files',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'board-games-test-'));await writeFile(join(dir,'index.html'),'<html>棋桌</html>')
  await mkdir(join(dir,'assets'));await writeFile(join(dir,'assets/engine.worker-hash.js'),'self.onmessage=()=>{}')
  const server=createServer(createHandler(dir));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`
  try{
    let r=await fetch(base+'/board-games/');assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/worker-src 'self'/)
    r=await fetch(base+'/board-games',{redirect:'manual'});assert.equal(r.status,308)
    r=await fetch(base+'/board-games/assets/engine.worker-hash.js');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/javascript/)
    for(const path of ['/board-games/package.json','/board-games/secret','/other/'])assert.equal((await fetch(base+path)).status,404)
    assert.equal((await fetch(base+'/board-games/%2e%2e%2fsecret')).status,400)
    assert.equal((await fetch(base+'/board-games/%ZZ')).status,400)
    assert.equal((await fetch(base+'/board-games/',{method:'POST'})).status,405)
    r=await fetch(base+'/board-games/',{method:'HEAD'});assert.equal(r.status,200);assert.equal(await r.text(),'')
  }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
})
