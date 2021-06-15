import { resolve, basename } from 'path'
import { existsSync, promises as fs } from 'fs'
import type { Plugin, ResolvedConfig } from 'vite'
import { generateSW } from 'workbox-build'
import { generateSimpleSWRegister, injectServiceWorker } from './html'
import { generateInjectManifest, generateRegisterSW, generateNetworkFirstWS } from './modules'
import { ResolvedVitePWAOptions, VitePWAOptions } from './types'
import { resolveOptions } from './options'
import { generateWebManifestFile } from './assets'
import { FILE_MANIFEST, FILE_SW_REGISTER, VIRTUAL_MODULES, VIRTUAL_MODULES_MAP, VIRTUAL_MODULES_RESOLVE_PREFIX } from './constants'

export function VitePWA(userOptions: Partial<VitePWAOptions> = {}): Plugin[] {
  let viteConfig: ResolvedConfig
  let options: ResolvedVitePWAOptions
  let useImportRegister = false
  let swDevGenerated = false

  const swDevOptions = {
    swUrl: 'dev-sw.js?dev-sw',
    workboxPaths: new Map<string, string>(),
  }

  return [
    {
      name: 'vite-plugin-pwa',
      enforce: 'post',
      apply: 'build',
      async configResolved(config) {
        viteConfig = config
        options = await resolveOptions(userOptions, viteConfig)
      },
      transformIndexHtml: {
        enforce: 'post',
        transform(html) {
          return injectServiceWorker(html, options)
        },
      },
      generateBundle(_, bundle) {
        if (options.manifest) {
          bundle[FILE_MANIFEST] = {
            isAsset: true,
            type: 'asset',
            name: undefined,
            source: generateWebManifestFile(options),
            fileName: FILE_MANIFEST,
          }
        }

        // if virtual register is requested, do not inject.
        if (options.injectRegister === 'auto' || options.strategies === 'networkFirst')
          options.injectRegister = useImportRegister ? null : 'script'

        if (options.injectRegister === 'script' && !existsSync(resolve(viteConfig.publicDir, FILE_SW_REGISTER))) {
          bundle[FILE_SW_REGISTER] = {
            isAsset: true,
            type: 'asset',
            name: undefined,
            source: generateSimpleSWRegister(options),
            fileName: FILE_SW_REGISTER,
          }
        }
      },
      async closeBundle() {
        if (!viteConfig.build.ssr) {
          if (options.strategies === 'injectManifest')
            await generateInjectManifest(options, viteConfig)
          else if (options.strategies === 'networkFirst')
            await generateNetworkFirstWS(options, viteConfig)
          else
            await generateSW(options.workbox)
        }
      },
      async buildEnd(error) {
        if (error)
          throw error
      },
    },
    {
      name: 'vite-plugin-pwa:virtual',
      async configResolved(config) {
        viteConfig = config
        options = await resolveOptions(userOptions, viteConfig)
      },
      resolveId(id) {
        return VIRTUAL_MODULES.includes(id) ? VIRTUAL_MODULES_RESOLVE_PREFIX + id : undefined
      },
      load(id) {
        if (id.startsWith(VIRTUAL_MODULES_RESOLVE_PREFIX))
          id = id.slice(VIRTUAL_MODULES_RESOLVE_PREFIX.length)
        else
          return

        if (VIRTUAL_MODULES.includes(id)) {
          useImportRegister = true
          return generateRegisterSW(
            options,
            viteConfig.command === 'build' ? 'build' : 'dev',
            VIRTUAL_MODULES_MAP[id],
          )
        }
      },
    },
    {
      name: 'vite-plugin-pwa:dev-sw',
      apply: 'serve',
      async configResolved(config) {
        viteConfig = config
        options = await resolveOptions(userOptions, viteConfig)
      },
      async load(id) {
        if (options.strategies === 'generateSW' && options.workbox.runtimeCaching) {
          if (id.endsWith(swDevOptions.swUrl)) {
            const globDirectory = resolve(__dirname, options.workbox.globDirectory, 'dev-dist')
            const swDest = resolve(__dirname, globDirectory, 'sw.js')
            if (!existsSync(swDest) || !swDevGenerated) {
              // we only need to generate sw with runtimeCaching on dist folder and then read the content
              const { filePaths } = await generateSW({
                ...options.workbox,
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true,
                additionalManifestEntries: undefined,
                globDirectory,
                swDest,
              })
              // we store workbox dependencies, and so we can then resolve them
              filePaths.forEach((we) => {
                const name = basename(we)
                // we exclude the sw itself
                if (name !== 'sw.js')
                  swDevOptions.workboxPaths.set(options.base + name, we)
              })
              swDevGenerated = true
            }
            return await fs.readFile(swDest, 'utf-8')
          }

          if (swDevOptions.workboxPaths.has(id))
            return await fs.readFile(swDevOptions.workboxPaths.get(id)!, 'utf-8')
        }
      },
      transformIndexHtml: {
        enforce: 'post',
        transform(html) {
          if (options.strategies === 'generateSW' && options.workbox.runtimeCaching) {
            return injectServiceWorker(
              html, {
                ...options,
                manifest: false,
                injectRegister: 'inline',
                filename: swDevOptions.swUrl,
              },
            )
          }
        },
      },
    },
  ]
}

export { cachePreset } from './cache'
export type { VitePWAOptions as Options }
