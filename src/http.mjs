import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml' }
export function createHandler(directory) {
  const root = resolve(directory)
  return async (req, res) => {
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { 'content-type':'text/plain; charset=utf-8', 'cache-control':'no-cache', 'x-content-type-options':'nosniff', ...headers })
      res.end(req.method === 'HEAD' ? undefined : body)
    }
    if (!['GET','HEAD'].includes(req.method)) return send(405,'仅支持读取。',{'allow':'GET, HEAD'})
    let pathname
    try { pathname = decodeURIComponent((req.url || '').split('?')[0]) } catch { return send(400,'无效地址。') }
    if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').includes('..')) return send(400,'无效地址。')
    if (pathname === '/board-games') return send(308,'',{'location':'/board-games/'})
    if (!pathname.startsWith('/board-games/')) return send(404,'未找到内容。')
    const relative = pathname.slice('/board-games/'.length) || 'index.html'
    // Serve only public build assets; never provide SPA fallback for unknown files.
    if (relative !== 'index.html' && !/^assets\/[A-Za-z0-9_.-]+\.(js|css|svg)$/.test(relative)) return send(404,'未找到内容。')
    try {
      const body = await readFile(resolve(root, relative))
      return send(200,body,{'content-type':types[extname(relative)],'content-length':body.length,'referrer-policy':'no-referrer',
        ...(relative === 'index.html' ? {'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"} : {})})
    } catch (error) { return send(error.code === 'ENOENT' ? 404 : 500, error.code === 'ENOENT' ? '未找到内容。' : '读取失败。') }
  }
}
