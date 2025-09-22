export async function initNESCore(url = '/wasm/fceux.wasm', imports = {}) {
  console.log('[NES Interface] Initializing NES WebAssembly...');
  const resp = await fetch(url, { credentials: 'same-origin' });
  if (!resp.ok) throw new Error(`Failed to fetch WASM: ${resp.status} ${resp.statusText}`);

  // Log fetch details before WebAssembly.instantiate
  console.log('[NES Interface] Fetch details:', {
    url: resp.url,
    status: resp.status,
    statusText: resp.statusText,
    contentType: resp.headers.get('content-type'),
    contentLength: resp.headers.get('content-length')
  });

  const ct = (resp.headers.get('content-type') || '').toLowerCase();
  const canStream = ('instantiateStreaming' in WebAssembly) && ct.includes('application/wasm');

  try {
    if (canStream) {
      console.log('[NES Interface] Using instantiateStreaming');
      return await WebAssembly.instantiateStreaming(resp, imports);
    }

    console.log('[NES Interface] Using arrayBuffer + instantiate');
    const bytes = await resp.arrayBuffer();

    // Convert to Uint8Array to inspect first 8 bytes (magic bytes)
    const uint8Array = new Uint8Array(bytes);
    const first8Bytes = uint8Array.slice(0, 8);
    console.log('[NES Interface] First 8 bytes (magic):', first8Bytes);
    console.log('[NES Interface] Expected magic: [0, 97, 115, 109, 1, 0, 0, 0]');
    console.log('[NES Interface] Magic matches expected:',
      first8Bytes[0] === 0 &&
      first8Bytes[1] === 97 &&
      first8Bytes[2] === 115 &&
      first8Bytes[3] === 109 &&
      first8Bytes[4] === 1 &&
      first8Bytes[5] === 0 &&
      first8Bytes[6] === 0 &&
      first8Bytes[7] === 0
    );

    return await WebAssembly.instantiate(bytes, imports);
  } catch (err) {
    console.error('[NES Interface] WASM init failed:', err);
    // Re-throw a clear error so UI can show a friendly message
    throw new Error('WASM blocked by Content Security Policy. Ensure script-src includes "wasm-unsafe-eval".');
  }
}