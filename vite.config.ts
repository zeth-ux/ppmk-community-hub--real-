import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * In `npm run dev`, serve the Vercel function in /api/ai.ts locally, so the
 * AI features work on your laptop too. (On Vercel, Vercel runs it itself.)
 * Server-only secrets such as GEMINI_API_KEY are read from .env.local and
 * never sent to the browser (only VITE_* variables are).
 */
function localApi(): Plugin {
  return {
    name: 'local-api',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const key of ['GEMINI_API_KEY', 'GEMINI_MODEL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
        if (env[key] && !process.env[key]) process.env[key] = env[key]
      }

      server.middlewares.use('/api/ai', async (req, res) => {
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)

          const headers = new Headers()
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value)
          }

          const request = new Request(`http://localhost${req.originalUrl ?? '/api/ai'}`, {
            method: req.method,
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
          })

          const mod = (await server.ssrLoadModule('/api/ai.ts')) as {
            POST: (request: Request) => Promise<Response>
          }
          const response = await mod.POST(request)

          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
          console.error(error)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Local AI server error, see the terminal.' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localApi()],
})
