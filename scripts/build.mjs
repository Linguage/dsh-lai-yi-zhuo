import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
const root=fileURLToPath(new URL('../',import.meta.url))
await build({configFile:false,root:join(root,'ui'),base:'/board-games/',plugins:[react()],publicDir:false,
  worker:{format:'es'},build:{outDir:join(root,'web'),emptyOutDir:true,sourcemap:false}})
await mkdir(join(root,'lib'),{recursive:true})
for(const [from,to] of [['index.mjs','index.js'],['http.mjs','http.mjs'],['client.js','client.js']])
  await copyFile(join(root,'src',from),join(root,'lib',to))
