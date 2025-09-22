import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LoginArea } from "@/components/auth/LoginArea";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-black/90 backdrop-blur supports-[backdrop-filter]:bg-black/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-purple-500/50">
            <span className="text-white font-bold text-sm">MF</span>
          </div>
          <span className="font-bold text-xl bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
            MoonFile
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <Link
            to="/"
            className="text-sm font-medium text-gray-300 hover:text-purple-400 transition-colors hover:scale-105"
          >
            Home
          </Link>
          <Link
            to="/games"
            className="text-sm font-medium text-gray-300 hover:text-purple-400 transition-colors hover:scale-105"
          >
            Games
          </Link>
          <Link
            to="/about"
            className="text-sm font-medium text-gray-300 hover:text-purple-400 transition-colors hover:scale-105"
          >
            About
          </Link>
          <Link
            to="/contact"
            className="text-sm font-medium text-gray-300 hover:text-purple-400 transition-colors hover:scale-105"
          >
            Contact
          </Link>
          <Link
            to="/test"
            className="text-sm font-medium text-gray-300 hover:text-purple-400 transition-colors hover:scale-105"
          >
            Test
          </Link>
        </nav>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          <LoginArea />
        </div>
      </div>
    </header>
  );
}