/**
 * Diagnóstico do aparelho para um futuro modelo de linguagem local (modo offline).
 * Hoje NÃO existe modelo local: `localModelReady` é sempre false.
 */
export async function deviceCapabilities() {
  let free = null;
  try { const e = await navigator.storage?.estimate?.(); if (e?.quota) free = Math.round((e.quota - (e.usage || 0)) / 1048576); } catch { /* ignora */ }
  return {
    webgpu: typeof navigator !== 'undefined' && 'gpu' in navigator,
    memoryGB: navigator.deviceMemory ?? null,
    cores: navigator.hardwareConcurrency ?? null,
    freeStorageMB: free,
    localModelReady: false
  };
}
