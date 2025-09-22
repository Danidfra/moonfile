export async function initNESCore(url = '/wasm/fceux.wasm', imports = {}) {
  console.log('[NES Interface] Initializing NES WebAssembly...');
  const resp = await fetch(url, { credentials: 'same-origin' });
  if (!resp.ok) throw new Error(`Failed to fetch WASM: ${resp.status} ${resp.statusText}`);

  const ct = (resp.headers.get('content-type') || '').toLowerCase();
  const canStream = ('instantiateStreaming' in WebAssembly) && ct.includes('application/wasm');

  try {
    if (canStream) {
      return await WebAssembly.instantiateStreaming(resp, imports);
    }
    const bytes = await resp.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } catch (err) {
    console.error('[NES Interface] WASM init failed:', err);
    // Re-throw a clear error so UI can show a friendly message
    throw new Error('WASM blocked by Content Security Policy. Ensure script-src includes "wasm-unsafe-eval".');
  }
}