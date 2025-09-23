import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";

import Index from "./pages/Index";
import GamesPage from "./pages/GamesPage";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Publish from "./pages/Publish";
import TestPage from "./pages/TestPage";
import TestMario from "./pages/TestMario";
import RetroPlay from "./pages/RetroPlay";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";
import GamePage from "./pages/GamePage";
import MultiplayerRoomPage from "./pages/MultiplayerRoomPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/publish" element={<Publish />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="/test-mario" element={<TestMario />} />
        {/* Game player routes */}
        <Route path="/game/:id" element={<GamePage />} />
        <Route path="/retro/:gameId/play" element={<RetroPlay />} />
        {/* Multiplayer room routes */}
        <Route path="/multiplayer/:gameId/:roomId" element={<MultiplayerRoomPage />} />
        {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
        <Route path="/:nip19" element={<NIP19Page />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;