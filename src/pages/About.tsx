import { useSeoMeta } from '@unhead/react';
import { Header } from "@/components/Header";

const About = () => {
  useSeoMeta({
    title: 'About - MoonFile',
    description: 'Learn about MoonFile, the decentralized arcade platform powered by Nostr.',
  });

  return (
    <div className="min-h-screen bg-[#F9F9F9]">
      <Header />

      <main className="py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              About MoonFile
            </h1>
            <p className="text-xl text-gray-600">
              The future of gaming, decentralized
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-8 shadow-sm">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">Our Mission</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              MoonFile is building the world's first truly decentralized arcade platform. By leveraging
              the Nostr protocol, we're creating a gaming ecosystem where developers can publish games
              directly to a decentralized network, and players can discover and play games without
              centralized intermediaries.
            </p>
            <p className="text-gray-600 leading-relaxed">
              We believe that gaming should be open, transparent, and accessible to everyone. Our
              platform empowers developers to reach a global audience while maintaining full control
              over their creations, and provides players with a censorship-resistant gaming experience.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
              <h3 className="text-2xl font-bold mb-4 text-gray-800">For Developers</h3>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start">
                  <span className="text-purple-600 mr-2">•</span>
                  Publish games as Nostr events (kind 30078)
                </li>
                <li className="flex items-start">
                  <span className="text-purple-600 mr-2">•</span>
                  No app store approvals or restrictions
                </li>
                <li className="flex items-start">
                  <span className="text-purple-600 mr-2">•</span>
                  Reach a global audience instantly
                </li>
                <li className="flex items-start">
                  <span className="text-purple-600 mr-2">•</span>
                  Monetize through sats and Lightning Network
                </li>
              </ul>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
              <h3 className="text-2xl font-bold mb-4 text-gray-800">For Players</h3>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start">
                  <span className="text-cyan-600 mr-2">•</span>
                  Access games from anywhere, anytime
                </li>
                <li className="flex items-start">
                  <span className="text-cyan-600 mr-2">•</span>
                  No regional restrictions or censorship
                </li>
                <li className="flex items-start">
                  <span className="text-cyan-600 mr-2">•</span>
                  Support developers directly with Lightning payments
                </li>
                <li className="flex items-start">
                  <span className="text-cyan-600 mr-2">•</span>
                  Own your gaming data and achievements
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-100 to-cyan-100 rounded-2xl p-8 border border-purple-200 text-center">
            <h2 className="text-3xl font-bold mb-4 text-gray-800">Join the Revolution</h2>
            <p className="text-gray-700 mb-6">
              MoonFile is more than just a gaming platform—it's a movement toward a more open
              and decentralized internet. By using Nostr, we're ensuring that gaming remains
              free, fair, and accessible to everyone, everywhere.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default About;