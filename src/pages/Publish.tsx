import { useSeoMeta } from '@unhead/react';
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Upload, Zap, Shield, Globe } from "lucide-react";

const Publish = () => {
  useSeoMeta({
    title: 'Publish Games - MoonFile',
    description: 'Learn how to publish your games on MoonFile using Nostr events and kind 30078.',
  });

  return (
    <div className="min-h-screen bg-[#F9F9F9]">
      <Header />

      <main className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Publish Your Games
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Share your games with the world using the power of Nostr and kind 30078 events
            </p>
          </div>

          {/* Benefits Section */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            <Card className="border-gray-200 bg-white shadow-sm">
              <CardHeader className="text-center">
                <div className="w-12 h-12 mx-auto bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Globe className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle className="text-lg">Global Reach</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 text-center">
                  Instantly reach players worldwide without regional restrictions
                </p>
              </CardContent>
            </Card>

            <Card className="border-gray-200 bg-white shadow-sm">
              <CardHeader className="text-center">
                <div className="w-12 h-12 mx-auto bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle className="text-lg">Censorship Free</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 text-center">
                  No app store approvals or content restrictions
                </p>
              </CardContent>
            </Card>

            <Card className="border-gray-200 bg-white shadow-sm">
              <CardHeader className="text-center">
                <div className="w-12 h-12 mx-auto bg-cyan-100 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-cyan-600" />
                </div>
                <CardTitle className="text-lg">Lightning Payments</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 text-center">
                  Accept Bitcoin payments and sats tipping directly
                </p>
              </CardContent>
            </Card>

            <Card className="border-gray-200 bg-white shadow-sm">
              <CardHeader className="text-center">
                <div className="w-12 h-12 mx-auto bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Code className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle className="text-lg">Developer Control</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 text-center">
                  Full control over your game updates and monetization
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Getting Started */}
          <div className="grid md:grid-cols-2 gap-12 mb-16">
            <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
              <h2 className="text-3xl font-bold mb-6 text-gray-800">Getting Started</h2>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2">Prepare Your Game</h3>
                    <p className="text-gray-600">
                      Package your game as a web application with HTML, CSS, and JavaScript files.
                      For NES games, prepare ROM files and emulator configuration.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2">Create Game Manifest</h3>
                    <p className="text-gray-600">
                      Create a JSON manifest describing your game including title, description,
                      genre, and file URLs hosted on decentralized storage.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2">Publish as Nostr Event</h3>
                    <p className="text-gray-600">
                      Create a kind 30078 event containing your game manifest and publish it to
                      Nostr relays. MoonFile will automatically index and display your game.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
              <h2 className="text-3xl font-bold mb-6 text-gray-800">Kind 30078 Event Format</h2>
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-cyan-400">
{`{
  "kind": 30078,
  "content": "",
  "tags": [
    ["d", "unique-game-identifier"],
    ["title", "Your Game Title"],
    ["description", "Short game description"],
    ["genre", "puzzle"],
    ["manifest", "https://your-storage.com/game-manifest.json"],
    ["image", "https://your-storage.com/cover-image.jpg"],
    ["version", "1.0.0"]
  ]
}`}
                </pre>
              </div>
              <p className="text-sm text-gray-600 mt-4">
                The game manifest JSON should include file URLs, game type (iframe/nes),
                and any additional metadata needed to run the game.
              </p>
            </div>
          </div>

          {/* Tools and Resources */}
          <div className="bg-gradient-to-br from-purple-100 to-cyan-100 rounded-2xl p-12 border border-purple-200 text-center">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">Developer Tools</h2>
            <p className="text-gray-700 mb-8 max-w-2xl mx-auto">
              We provide tools and libraries to make publishing games on MoonFile easier.
              Check out our documentation and SDKs for different platforms.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                variant="outline"
                className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white"
              >
                <Code className="w-4 h-4 mr-2" />
                Documentation
              </Button>
              <Button
                variant="outline"
                className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Tool
              </Button>
              <Button
                variant="outline"
                className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white"
              >
                <Globe className="w-4 h-4 mr-2" />
                SDK & Libraries
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Publish;