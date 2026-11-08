import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { createHandler } from '../src/http.mjs'
const server=createServer(createHandler(fileURLToPath(new URL('../web/',import.meta.url))))
server.listen(Number(process.env.PORT || 7346),'127.0.0.1',()=>console.log(`来一桌 http://127.0.0.1:${server.address().port}/board-games/`))
