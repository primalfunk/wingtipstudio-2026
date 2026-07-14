import { NavLink } from "react-router-dom";
import { siteLinks } from "../content/siteLinks";
import PageTransition from "./PageTransition";

const navigation = [
  { to: "/", label: "Home", end: true },
  { to: "/projects", label: "Projects", end: false },
  { to: "/arcade", label: "Games", end: false },
  { to: "/music", label: "Music", end: false },
  { to: "/videos", label: "Videos", end: false },
  { to: "/about", label: "Studio", end: false },
  { to: "/professional", label: "Professional", end: false },
  { to: "/connect", label: "Connect", end: false }
];

export default function SiteShell() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <NavLink className="site-logo" to="/" aria-label="Wingtip Studio home">
          <img src="/assets/wingtip-logo-transparent.png" alt="Wingtip Studio" />
        </NavLink>
        <nav className="site-nav" aria-label="Primary navigation">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => isActive ? "is-active" : undefined}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <PageTransition />
      <footer className="site-footer">
        <span>Wingtip Studio</span>
        <a href={`mailto:${siteLinks.email}`}>{siteLinks.email}</a>
      </footer>
    </div>
  );
}
