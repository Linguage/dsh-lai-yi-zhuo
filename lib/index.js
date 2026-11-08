import { fileURLToPath } from 'node:url'
import { createHandler } from './http.mjs'
export const name = 'board-games'
export const inject = ['webServer']
export function apply(ctx) {
  const directory = fileURLToPath(new URL('../web/', import.meta.url))
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: '/board-games', handler: createHandler(directory) }))
}
