import { useSeoMeta } from '@unhead/react';
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Github, Twitter } from "lucide-react";

const Contact = () => {
  useSeoMeta({
    title: 'Contact - MoonFile',
    description: 'Get in touch with the MoonFile team. We\'d love to hear from you!',
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
                  <Mail className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
            <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent animate-gradient-x">
              Get in Touch
            </h1>
            <h2 className="text-2xl md:text-3xl text-gray-300 mb-8 font-light">
              We'd love to hear from you!
            </h2>
            <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed">
              Have questions about MoonFile? Want to contribute? Reach out to our team and join the decentralized gaming revolution.
            </p>
          </div>
        </section>

        {/* Contact Section */}
        <section className="py-24 px-4 bg-gray-900/50">
          <div className="container mx-auto max-w-6xl">
            <div className="grid md:grid-cols-2 gap-12">
              {/* Contact Form */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 backdrop-blur-sm">
                <h2 className="text-3xl font-bold mb-6 text-white">Send us a message</h2>
                <form className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                      Name
                    </label>
                    <Input
                      id="name"
                      placeholder="Your name"
                      className="bg-gray-800 border-gray-700 focus:border-purple-500 text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      className="bg-gray-800 border-gray-700 focus:border-purple-500 text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-gray-300 mb-2">
                      Subject
                    </label>
                    <Input
                      id="subject"
                      placeholder="What's this about?"
                      className="bg-gray-800 border-gray-700 focus:border-purple-500 text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">
                      Message
                    </label>
                    <Textarea
                      id="message"
                      placeholder="Your message..."
                      rows={5}
                      className="bg-gray-800 border-gray-700 focus:border-purple-500 text-white"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-lg py-6 rounded-full shadow-lg hover:shadow-purple-500/50 transition-all duration-300"
                  >
                    Send Message
                  </Button>
                </form>
              </div>

              {/* Contact Info */}
              <div className="space-y-8">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 backdrop-blur-sm">
                  <h2 className="text-3xl font-bold mb-6 text-white">Connect with us</h2>
                  <div className="space-y-6">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-purple-600/20 rounded-lg border border-purple-500/30">
                        <Mail className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Email</h3>
                        <p className="text-gray-400">hello@moonfile.dev</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-purple-600/20 rounded-lg border border-purple-500/30">
                        <Github className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">GitHub</h3>
                        <p className="text-gray-400">github.com/moonfile</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-cyan-600/20 rounded-lg border border-cyan-500/30">
                        <Twitter className="w-6 h-6 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Nostr</h3>
                        <p className="text-gray-400">@moonfile</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-900/20 to-cyan-900/20 rounded-2xl p-8 border border-purple-500/30 backdrop-blur-sm">
                  <h3 className="text-xl font-bold mb-4 text-white">Join our community</h3>
                  <p className="text-gray-300 mb-6">
                    Be part of the decentralized gaming revolution. Join our Nostr community for updates,
                    discussions, and early access to new features.
                  </p>
                  <Button
                    variant="outline"
                    className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white text-lg px-8 py-6 rounded-full transition-all duration-300"
                  >
                    Follow on Nostr
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

export default Contact;