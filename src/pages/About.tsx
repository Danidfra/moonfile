import { useSeoMeta } from '@unhead/react';
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Users, Zap } from "lucide-react";

const About = () => {
  useSeoMeta({
    title: 'About - MoonFile',
    description: 'Learn about MoonFile, the decentralized arcade platform powered by Nostr.',
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
                  <div className="w-6 h-6 bg-white rounded-sm" />
                </div>
              </div>
            </div>
            <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent animate-gradient-x">
              About MoonFile
            </h1>
            <h2 className="text-2xl md:text-3xl text-gray-300 mb-8 font-light">
              The future of gaming, decentralized
            </h2>
            <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed">
              Building the world's first truly decentralized arcade platform powered by Nostr
            </p>
          </div>
        </section>

        {/* Mission Section */}
        <section className="py-24 px-4 bg-gray-900/50">
          <div className="container mx-auto max-w-4xl">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-8 backdrop-blur-sm">
              <h2 className="text-3xl font-bold mb-6 text-white">Our Mission</h2>
              <p className="text-gray-300 mb-6 leading-relaxed">
                MoonFile is building the world's first truly decentralized arcade platform. By leveraging
                the Nostr protocol, we're creating a gaming ecosystem where developers can publish games
                directly to a decentralized network, and players can discover and play games without
                centralized intermediaries.
              </p>
              <p className="text-gray-300 leading-relaxed">
                We believe that gaming should be open, transparent, and accessible to everyone. Our
                platform empowers developers to reach a global audience while maintaining full control
                over their creations, and provides players with a censorship-resistant gaming experience.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 backdrop-blur-sm">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-600/20 to-cyan-600/20 rounded-lg flex items-center justify-center">
                    <Zap className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">For Developers</h3>
                </div>
                <ul className="space-y-3 text-gray-300">
                  <li className="flex items-start">
                    <span className="text-purple-400 mr-2">•</span>
                    Publish games as Nostr events (kind 30078)
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-400 mr-2">•</span>
                    No app store approvals or restrictions
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-400 mr-2">•</span>
                    Reach a global audience instantly
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-400 mr-2">•</span>
                    Monetize through sats and Lightning Network
                  </li>
                </ul>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 backdrop-blur-sm">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-600/20 to-blue-600/20 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-cyan-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">For Players</h3>
                </div>
                <ul className="space-y-3 text-gray-300">
                  <li className="flex items-start">
                    <span className="text-cyan-400 mr-2">•</span>
                    Access games from anywhere, anytime
                  </li>
                  <li className="flex items-start">
                    <span className="text-cyan-400 mr-2">•</span>
                    No regional restrictions or censorship
                  </li>
                  <li className="flex items-start">
                    <span className="text-cyan-400 mr-2">•</span>
                    Support developers directly with Lightning payments
                  </li>
                  <li className="flex items-start">
                    <span className="text-cyan-400 mr-2">•</span>
                    Own your gaming data and achievements
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-4 bg-gray-900/30">
          <div className="container mx-auto">
            <div className="max-w-4xl mx-auto text-center">
              <div className="bg-gradient-to-br from-purple-900/20 to-cyan-900/20 rounded-2xl p-12 border border-purple-500/30 backdrop-blur-sm">
                <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  Join the Revolution
                </h2>
                <p className="text-xl text-gray-300 mb-8 leading-relaxed">
                  MoonFile is more than just a gaming platform—it's a movement toward a more open
                  and decentralized internet. By using Nostr, we're ensuring that gaming remains
                  free, fair, and accessible to everyone, everywhere.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    asChild
                    size="lg"
                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-purple-500/50 transition-all duration-300"
                  >
                    <Link to="/games">
                      Explore Games
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white text-lg px-8 py-6 rounded-full transition-all duration-300"
                  >
                    <Link to="/publish">
                      Publish Your Game
                    </Link>
                  </Button>
                </div>
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

export default About;