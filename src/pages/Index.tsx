import { Link } from "react-router-dom";
import { useSeoMeta } from '@unhead/react';
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { GameCard } from "@/components/GameCard";
import { FeatureCard } from "@/components/FeatureCard";
import { Gamepad2, Users, Zap } from "lucide-react";

const Index = () => {
  useSeoMeta({
    title: 'MoonFile - Decentralized Arcade',
    description: 'A decentralized hub of games powered by Nostr. Discover, play, and compete in games published via Nostr events.',
  });

  const featuredGames = [
    {
      title: "Space Invaders",
      genre: "Arcade",
      coverImage: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=300&fit=crop"
    },
    {
      title: "Racing Thunder",
      genre: "Racing",
      coverImage: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop"
    },
    {
      title: "Puzzle Master",
      genre: "Puzzle",
      coverImage: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=300&fit=crop"
    },
    {
      title: "Battle Arena",
      genre: "Multiplayer",
      coverImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=300&fit=crop"
    }
  ];

  const features = [
    {
      title: "NES Classics",
      description: "Relive the golden age of gaming with retro NES games fetched from Nostr events and playable via emulator.",
      icon: <Gamepad2 className="w-6 h-6 text-purple-400" />
    },
    {
      title: "Multiplayer",
      description: "Play with or against other users from around the world, with optional sats betting for competitive matches.",
      icon: <Users className="w-6 h-6 text-cyan-400" />
    },
    {
      title: "Casual Games",
      description: "Quick and fun iframe-embedded games perfect for casual gaming sessions and instant entertainment.",
      icon: <Zap className="w-6 h-6 text-blue-400" />
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950">
      <Header />

      <main>
        {/* Hero Section */}
        <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-purple-900/20" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,theme(colors.purple.600/15)_0%,theme(colors.cyan.600/10)_50%,transparent_70%)]" />

          <div className="relative z-10 container mx-auto px-4 text-center">
            <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent animate-gradient-x">
              Welcome to MoonFile
            </h1>
            <h2 className="text-2xl md:text-3xl text-white mb-8 font-light">
              A decentralized hub of games powered by Nostr
            </h2>
            <p className="text-lg md:text-xl text-white max-w-3xl mx-auto mb-12 leading-relaxed">
              Discover, play, and compete in games published via Nostr events — from retro NES emulated games
              to multiplayer web games embedded via iframe. All games are stored and verified on the decentralized Nostr network.
            </p>
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
            >
              <Link to="/games">
                Get Started
              </Link>
            </Button>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 px-4">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Featured Categories
              </h2>
              <p className="text-xl text-foreground/90 max-w-2xl mx-auto">
                Explore different types of games available on our decentralized platform
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {features.map((feature, index) => (
                <FeatureCard
                  key={index}
                  title={feature.title}
                  description={feature.description}
                  icon={feature.icon}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Featured Games Section */}
        <section className="py-24 px-4 bg-gradient-to-b from-transparent to-purple-900/10">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Featured Games
              </h2>
              <p className="text-xl text-foreground/90 max-w-2xl mx-auto">
                Check out some of the most popular games on our platform
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {featuredGames.map((game, index) => (
                <GameCard
                  key={index}
                  title={game.title}
                  genre={game.genre}
                  coverImage={game.coverImage}
                />
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-4">
          <div className="container mx-auto">
            <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-purple-900/20 to-cyan-900/20 rounded-2xl p-12 border border-purple-900/30">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
                Developers: Publish your games on MoonFile
              </h2>
              <p className="text-xl text-foreground/90 mb-8 leading-relaxed">
                Join our decentralized gaming ecosystem by publishing your games as Nostr events.
                Reach a global audience and leverage the power of decentralized technology.
              </p>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white text-lg px-8 py-6 rounded-full transition-all duration-300"
              >
                <Link to="/publish">
                  Learn How to Publish
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-purple-900/20 py-12 px-4">
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
              <p className="text-muted-foreground">
                Decentralized arcade powered by Nostr. Play, compete, and publish games on the decentralized web.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-foreground">Company</h4>
              <ul className="space-y-2">
                <li><Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">About</Link></li>
                <li><Link to="/contact" className="text-muted-foreground hover:text-primary transition-colors">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-foreground">Resources</h4>
              <ul className="space-y-2">
                <li><a href="https://docs.moonfile.dev" className="text-muted-foreground hover:text-primary transition-colors">Documentation</a></li>
                <li><a href="https://github.com/moonfile" className="text-muted-foreground hover:text-primary transition-colors">GitHub</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-foreground">Legal</h4>
              <ul className="space-y-2">
                <li><Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">Privacy</Link></li>
                <li><Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">Terms</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-purple-900/20 pt-8 text-center text-muted-foreground">
            <p>&copy; 2025 MoonFile. Powered by Nostr and decentralized technology.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
