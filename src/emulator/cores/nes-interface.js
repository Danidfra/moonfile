export async function initNESCore(wasmURL = '/wasm/fceux.wasm', imports = {}) {
  console.log('[NES Interface] Initializing NES WebAssembly...');

  // Ensure MIME is correct and use streaming when possible
  let instance, module;
  const resp = await fetch(wasmURL, { credentials: 'same-origin' });

  if (!resp.ok) {
    throw new Error(`Failed to fetch WASM: ${resp.status} ${resp.statusText}`);
  }

  const contentType = resp.headers.get('content-type') || '';
  const canStream = 'instantiateStreaming' in WebAssembly && contentType.includes('application/wasm');

  if (canStream) {
    const result = await WebAssembly.instantiateStreaming(resp, imports);
    module = result.module;
    instance = result.instance;
  } else {
    const bytes = await resp.arrayBuffer();
    const result = await WebAssembly.instantiate(bytes, imports);
    module = result.module;
    instance = result.instance;
  }

  console.log('[NES Interface] NES core initialized');
  return { module, instance };
}