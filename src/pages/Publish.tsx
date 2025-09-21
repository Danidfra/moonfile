import { useSeoMeta } from '@unhead/react';
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Upload, Zap, Shield, Globe } from "lucide-react";
import { Link } from "react-router-dom";

const Publish = () => {
  useSeoMeta({
    title: 'Publish Games - MoonFile',
    description: 'Learn how to publish your games on MoonFile using Nostr events and kind 31996.',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      <Header />

      <main>
        {/* Hero Section */}
        <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-cyan-900/10 to-blue-900/10" />

          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600/20 to-cyan-600/20 rounded-2xl backdrop-blur-sm border border-purple-500/30">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/50">
                  <Upload className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
            <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent animate-gradient-x">
              Publish Your Games
            </h1>
            <h2 className="text-2xl md:text-3xl text-gray-300 mb-8 font-light">
              Share your games with the world using Nostr
            </h2>
            <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed">
              Publish your games as Nostr events (kind 31996) and reach a global audience instantly
            </p>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-24 px-4 bg-gray-900/50">
          <div className="container mx-auto max-w-6xl">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
              <Card className="border-gray-800 bg-gray-900 backdrop-blur-sm">
                <CardHeader className="text-center">
                  <div className="w-12 h-12 mx-auto bg-purple-600/20 rounded-lg flex items-center justify-center mb-4 border border-purple-500/30">
                    <Globe className="w-6 h-6 text-purple-400" />
                  </div>
                  <CardTitle className="text-lg text-white">Global Reach</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-400 text-center">
                    Instantly reach players worldwide without regional restrictions
                  </p>
                </CardContent>
              </Card>

              <Card className="border-gray-800 bg-gray-900 backdrop-blur-sm">
                <CardHeader className="text-center">
                  <div className="w-12 h-12 mx-auto bg-purple-600/20 rounded-lg flex items-center justify-center mb-4 border border-purple-500/30">
                    <Shield className="w-6 h-6 text-purple-400" />
                  </div>
                  <CardTitle className="text-lg text-white">Censorship Free</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-400 text-center">
                    No app store approvals or content restrictions
                  </p>
                </CardContent>
              </Card>

              <Card className="border-gray-800 bg-gray-900 backdrop-blur-sm">
                <CardHeader className="text-center">
                  <div className="w-12 h-12 mx-auto bg-cyan-600/20 rounded-lg flex items-center justify-center mb-4 border border-cyan-500/30">
                    <Zap className="w-6 h-6 text-cyan-400" />
                  </div>
                  <CardTitle className="text-lg text-white">Lightning Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-400 text-center">
                    Accept Bitcoin payments and sats tipping directly
                  </p>
                </CardContent>
              </Card>

              <Card className="border-gray-800 bg-gray-900 backdrop-blur-sm">
                <CardHeader className="text-center">
                  <div className="w-12 h-12 mx-auto bg-purple-600/20 rounded-lg flex items-center justify-center mb-4 border border-purple-500/30">
                    <Code className="w-6 h-6 text-purple-400" />
                  </div>
                  <CardTitle className="text-lg text-white">Developer Control</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-400 text-center">
                    Full control over your game updates and monetization
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Getting Started */}
            <div className="grid md:grid-cols-2 gap-12 mb-16">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 backdrop-blur-sm">
                <h2 className="text-3xl font-bold mb-6 text-white">Getting Started</h2>
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      1
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-2">Prepare Your Game</h3>
                      <p className="text-gray-300">
                        Package your game files. For NES games, prepare ROM files and emulator configuration.
                        For web games, prepare HTML, CSS, and JavaScript files.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      2
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-2">Create Game Event</h3>
                      <p className="text-gray-300">
                        Create a kind 31996 event with your game metadata and binary data encoded in base64.
                        Include all required tags for game information and file details.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      3
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-2">Publish to Nostr</h3>
                      <p className="text-gray-300">
                        Sign and publish your event to Nostr relays. MoonFile will automatically
                        index and display your game on the platform.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 backdrop-blur-sm">
                <h2 className="text-3xl font-bold mb-6 text-white">Kind 31996 Event Format</h2>
                <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-cyan-400">
{`{
  "id": "7f6c9ab8e1a6d3d57a68b2c98c88f0e1b476a5d987fd10b0f24923a2c1a09f99",
  "pubkey": "npub1exampleauthor...",
  "created_at": 1737472000,
  "kind": 31996,
  "tags": [
    ["d","game:space-invaders:v1.0"],
    ["name","Space Invaders (Homebrew NES)"],
    ["summary","Classic alien-shooting arcade remake for the NES."],
    ["genre","shooter","arcade"],
    ["mode","solo"],
    ["status","released"],
    ["ver","1.0"],
    ["credits","npub1exampleauthor..."],
    ["levels","10"],
    ["platforms","nes-rom"],
    ["image","cover","https://example.com/spaceinvaders-cover.png"],
    ["image","screenshot","https://example.com/spaceinvaders-screen1.png"],
    ["icon","https://example.com/spaceinvaders-icon.png"],
    ["banner","https://example.com/spaceinvaders-banner.png"],
    ["mime","application/x-nes-rom"],
    ["encoding","base64"],
    ["compression","none"],
    ["size","32768"],
    ["sha256","8f2c44f3e23c4cfef57e3dcb7764f569d90e48fa8f18f90a0be7d9f7f8d9e777"]
  ],
  "content": "<BASE64_ROM_DATA>",
  "sig": "b1c23d4afcb29a99aa9df2b49821e90dfb3c21cf4ad63b68e7e6f0a9a17ecbd3..."
}`}
                  </pre>
                </div>
                <div className="mt-6 space-y-4">
                  <h3 className="font-semibold text-white mb-2">Required Tags:</h3>
                  <ul className="text-sm text-gray-300 space-y-2">
                    <li><span className="text-purple-400">d</span>: Unique game identifier</li>
                    <li><span className="text-purple-400">name</span>: Game title</li>
                    <li><span className="text-purple-400">summary</span>: Game description</li>
                    <li><span className="text-purple-400">genre</span>: Game genre(s)</li>
                    <li><span className="text-purple-400">platforms</span>: Supported platforms</li>
                    <li><span className="text-purple-400">mime</span>: MIME type of game data</li>
                    <li><span className="text-purple-400">encoding</span>: Data encoding format</li>
                    <li><span className="text-purple-400">size</span>: Size in bytes</li>
                    <li><span className="text-purple-400">sha256</span>: SHA256 hash of game data</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Tools and Resources */}
            <div className="bg-gradient-to-br from-purple-900/20 to-cyan-900/20 rounded-2xl p-12 border border-purple-500/30 backdrop-blur-sm text-center">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Developer Tools
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                We provide tools and libraries to make publishing games on MoonFile easier.
                Check out our documentation and SDKs for different platforms.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  asChild
                  variant="outline"
                  className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white text-lg px-8 py-6 rounded-full transition-all duration-300"
                >
                  <a href="https://docs.moonfile.dev" target="_blank" rel="noopener noreferrer">
                    <Code className="w-4 h-4 mr-2" />
                    Documentation
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white text-lg px-8 py-6 rounded-full transition-all duration-300"
                >
                  <Link to="/games">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Tool
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white text-lg px-8 py-6 rounded-full transition-all duration-300"
                >
                  <a href="https://github.com/moonfile" target="_blank" rel="noopener noreferrer">
                    <Globe className="w-4 h-4 mr-2" />
                    SDK & Libraries
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12 px-4 bg-gray-900">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-5 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">MF</span>
                </div>
                <span className="font-bold text-xl bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  MoonFile
                </span>
              </div>
              <p className="text-gray-400">
                Decentralized arcade powered by Nostr. Play, compete, and publish games on the decentralized web.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-white">Company</h4>
              <ul className="space-y-2">
                <li><Link to="/about" className="text-gray-400 hover:text-purple-400 transition-colors">About</Link></li>
                <li><Link to="/contact" className="text-gray-400 hover:text-purple-400 transition-colors">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-white">Resources</h4>
              <ul className="space-y-2">
                <li><a href="https://docs.moonfile.dev" className="text-gray-400 hover:text-purple-400 transition-colors">Documentation</a></li>
                <li><a href="https://github.com/moonfile" className="text-gray-400 hover:text-purple-400 transition-colors">GitHub</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-white">Legal</h4>
              <ul className="space-y-2">
                <li><Link to="/privacy" className="text-gray-400 hover:text-purple-400 transition-colors">Privacy</Link></li>
                <li><Link to="/terms" className="text-gray-400 hover:text-purple-400 transition-colors">Terms</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-gray-500">
            <p>&copy; 2025 MoonFile. Powered by Nostr and decentralized technology.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Publish;