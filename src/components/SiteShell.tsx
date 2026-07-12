import { NavLink, Outlet } from "react-router-dom";

const navigation = [
  { to: "/", label: "Home", end: true },
  { to: "/arcade", label: "Arcade", end: false },
  { to: "/music", label: "Music", end: false },
  { to: "/videos", label: "Videos", end: false },
  { to: "/contact", label: "Contact", end: false }
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
      <Outlet />
      <footer className="site-footer">
        <span>Wingtip Studio</span>
        <a href="mailto:jared.d.menard@gmail.com">jared.d.menard@gmail.com</a>
      </footer>
    </div>
  );
}
