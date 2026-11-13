import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

/**
 * Design preview: `npm run demo` swaps the database, login and AI for fake
 * data (files in src/demo/), so every screen can be viewed on localhost with
 * no Supabase project or keys. Normal `npm run dev` / builds are unaffected.
 */
function demoMode(): Plugin {
  const swaps: Record<string, string> = {
    'src/lib/api.ts': 'src/demo/api.ts',
    'src/lib/supabase.ts': 'src/demo/supabase.ts',
    'src/context/AuthContext.tsx': 'src/demo/AuthContext.tsx',
    'src/lib/ai.ts': 'src/demo/ai.ts',
  }
  const root = process.cwd()
  return {
    name: 'demo-mode',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || importer.includes('/src/demo/')) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (!resolved) return null
      const rel = path.relative(root, resolved.id).split(path.sep).join('/')
      return swaps[rel] ? path.join(root, swaps[rel]) : null
    },
  }
}

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

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), mode === 'demo' ? demoMode() : localApi()],
  build: {
    // Libraries that rarely change get their own files, so browsers keep
    // them cached between app updates. Pages are split in App.tsx.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/](@supabase|iceberg-js|tslib)[\\/]/ },
          ],
        },
      },
    },
  },
}))
