// Builds the three React modules the game imports, as ES modules that share one copy of React,
// and the stylesheet for the Tailwind classes the scene's component uses.
import { build } from 'esbuild'
import { createRequire } from 'module'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
const require = createRequire(import.meta.url)
const out = process.argv[2]
const names = (m) => Object.keys(require(m)).filter((k) => k !== 'default' && /^[A-Za-z_$][\w$]*$/.test(k))
mkdirSync('entry', { recursive: true })
const entry = (file, mod) => writeFileSync(`entry/${file}`, `import M from '${mod}'\nexport default M\nexport const { ${names(mod).join(', ')} } = M\n`)
entry('react.js', 'react')
entry('react-jsx-runtime.js', 'react/jsx-runtime')
entry('react-dom-client.js', 'react-dom/client')
rmSync(out, { recursive: true, force: true })
await build({
  entryPoints: ['entry/react.js', 'entry/react-jsx-runtime.js', 'entry/react-dom-client.js'],
  bundle: true, splitting: true, format: 'esm', minify: true, outdir: out, target: 'es2020',
  define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'linked', chunkNames: 'chunk-[hash]',
})
