import { Navigate, Route, Routes } from "react-router-dom";
import SiteShell from "./components/SiteShell";
import HomePage from "./pages/HomePage";
import ProfessionalPage from "./pages/ProfessionalPage";
import ProjectsPage from "./pages/ProjectsPage";
import MusicPage from "./pages/MusicPage";
import VideosPage from "./pages/VideosPage";
import AboutPage from "./pages/AboutPage";
import ConnectPage from "./pages/ConnectPage";
import ArcadeHome from "./arcade/ArcadeHome";
import GameFrame from "./arcade/GameFrame";

const gameRoutes = [
  ["/spy-hunter-apex", "Spy Hunter: Apex", "/games/spy-hunter-apex/index.html"],
  ["/plasmodyne", "Plasmodyne", "/games/plasmodyne/index.html"],
  ["/concordant", "Concordant", "/games/concordant/index.html"],
  ["/boondock-trail", "Boondock Trail", "/games/boondock-trail/index.html"],
  ["/stone-horses", "Stone Horses", "/games/stone-horses/index.html"],
  ["/coach", "Streets Arcana", "/games/coach/index.html"],
  ["/lords-of-chaos", "The Lords of Chaos", "/games/lords-of-chaos/index.html"],
  ["/ancient-suffering-reborn", "Ancient Suffering", "/games/ancient-suffering-reborn/index.html"],
  ["/math-blaster-neo", "Math Blaster Neo", "/games/math-blaster-neo/index.html"],
  ["/dead-channels", "Dead Channels", "/games/dead-channels/index.html"]
] as const;

export default function App() {
  return (
    <Routes>
      <Route element={<SiteShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/professional" element={<ProfessionalPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/arcade" element={<ArcadeHome />} />
        <Route path="/music" element={<MusicPage />} />
        <Route path="/videos" element={<VideosPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/connect" element={<ConnectPage />} />
        <Route path="/contact" element={<Navigate to="/connect" replace />} />
      </Route>
      {gameRoutes.map(([path, title, src]) => <Route key={path} path={path} element={<GameFrame title={title} src={src} />} />)}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
