import { Link } from "react-router-dom";
import PageMeta from "../components/PageMeta";
import { siteContent } from "../content/siteContent";

const workDestinations = [
  { to: "/projects", title: "Projects", description: "Active engineering systems and works in progress." },
  { to: "/arcade", title: "Games", description: "Released games and interactive experiments." },
  { to: "/music", title: "Music", description: "Original compositions and game soundtracks." },
  { to: "/videos", title: "Videos", description: "Moving-image and audiovisual work." },
];

export default function HomePage() {
  const artwork = siteContent.home.heroArtwork;
  return (
    <main className="site-page home-page">
      <PageMeta title="Wingtip Studio" description="Wingtip Studio creates original games, music, and moving image." />
      <section className="home-hero home-hero--split" aria-labelledby="home-title">
        <div className="home-hero__copy">
          <div className="home-hero__logo"><img src="/assets/wingtip-logo-transparent.png" alt="Wingtip Studio" /></div>
          <p className="eyebrow">Games {"\u2022"} Music {"\u2022"} Moving Image</p>
          <h1 id="home-title">Wingtip Studio</h1>
          <p className="home-hero__mission">{siteContent.home.introduction}</p>
          <p className="home-hero__supporting">{siteContent.home.supporting}</p>
          <div className="home-hero__actions"><Link className="studio-button studio-button--arcade" to="/arcade">Explore Arcade</Link><Link className="studio-button studio-button--music" to="/music">Explore Music</Link><Link className="studio-button studio-button--videos" to="/videos">Explore Videos</Link></div>
          <div className="home-current-focus"><span>Currently building</span><Link to="/projects"><strong>LODEX</strong><i aria-hidden="true">·</i><strong>Cinelingus</strong><b>View Projects <span aria-hidden="true">→</span></b></Link></div>
        </div>
        <figure className="archive-hero">
          <div className="archive-hero__art"><img src={artwork.src} alt={artwork.alt} /></div>
          <figcaption><span>{artwork.archiveNumber}</span><strong>{artwork.title}</strong><small>{artwork.caption}</small></figcaption>
        </figure>
      </section>

      <section className="home-work-index" aria-labelledby="home-work-title">
        <header className="home-wayfinding-heading"><p className="eyebrow">01 / The Work</p><h2 id="home-work-title">Explore the Work</h2></header>
        <div className="home-work-list">
          {workDestinations.map((destination, index) => (
            <Link key={destination.to} to={destination.to}>
              <span className="home-work-list__number" aria-hidden="true">0{index + 1}</span>
              <strong>{destination.title}</strong>
              <span>{destination.description}</span>
              <b aria-hidden="true">→</b>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-identities" aria-labelledby="home-identities-title">
        <header className="home-wayfinding-heading"><p className="eyebrow">02 / Identity</p><h2 id="home-identities-title">The Engineer and the Studio</h2></header>
        <div className="home-identity-links">
          <Link to="/professional"><span>Jared Menard</span><strong>Professional</strong><p>Experience, capabilities, and the engineering approach behind the work.</p><b aria-hidden="true">→</b></Link>
          <Link to="/about"><span>Wingtip Studio</span><strong>Studio</strong><p>The philosophy, curiosity, and purpose behind the workshop.</p><b aria-hidden="true">→</b></Link>
        </div>
      </section>

      <section className="home-connect" aria-labelledby="home-connect-title">
        <p className="eyebrow">03 / Conversation</p>
        <h2 id="home-connect-title">Begin a Conversation</h2>
        <p>Interesting work often begins with an unusual question.</p>
        <Link to="/connect">Connect with Wingtip <span aria-hidden="true">→</span></Link>
      </section>
    </main>
  );
}
