/**
 * Test Page
 * 
 * Page for testing NES WebAssembly functionality
 */

import { useSeoMeta } from '@unhead/react';
import { Header } from '@/components/Header';
import { NesWasmTest } from '@/components/NesWasmTest';

const TestPage = () => {
  useSeoMeta({
    title: 'NES WASM Test - Retro Arcade',
    description: 'Test page for NES WebAssembly emulator functionality.',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      <Header />

      <main className="py-24 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              NES WASM Test
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Test the NES WebAssembly emulator core functionality
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg">
            <NesWasmTest />
          </div>
        </div>
      </main>
    </div>
  );
};

export default TestPage;