import { analyzePowerQuality } from '../utils/powerQuality'

self.onmessage = event => {
  const { id, dataset } = event.data ?? {}
  try {
    const startedAt = performance.now()
    const analysis = analyzePowerQuality(dataset)
    self.postMessage({
      id,
      ok: true,
      analysis,
      elapsedMs: Math.round(performance.now() - startedAt),
    })
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error?.message ?? 'Falha ao analisar qualidade de energia',
    })
  }
}
