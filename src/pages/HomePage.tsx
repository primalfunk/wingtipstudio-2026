import { Link } from "react-router-dom";
import PageMeta from "../components/PageMeta";
import { siteContent } from "../content/siteContent";
import musicCatalog from "../content/musicCatalog.json";
import type { MusicCatalog } from "../music/types";

const destinations = [
  { to: "/arcade", title: "Arcade", description: "Play original games and interactive experiments.", accent: "teal", icon: "\u25c7" },
  { to: "/music", title: "Music", description: "Explore original compositions and game soundtracks.", accent: "gold", icon: "\u266a" },
  { to: "/videos", title: "Videos", description: "Watch music videos and moving-image experiments.", accent: "rose", icon: "\u25b6" },
  { to: "/contact", title: "Contact", description: "Enter the studio office and get in touch.", accent: "violet", icon: "\u2709" }
];

export default function HomePage() {
  const featuredTrack = (musicCatalog as MusicCatalog).tracks.find((track) => track.featured);
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
          <div className="home-hero__actions"><Link className="studio-button studio-button--primary" to="/arcade">Explore Arcade</Link><Link className="studio-button" to="/music">Explore Music</Link><Link className="studio-button" to="/videos">Explore Videos</Link></div>
        </div>
        <figure className="archive-hero">
          <div className="archive-hero__art"><img src={artwork.src} alt={artwork.alt} /></div>
          <figcaption><span>{artwork.archiveNumber}</span><strong>{artwork.title}</strong><small>{artwork.caption}</small></figcaption>
        </figure>
      </section>

      <section className="home-explore" aria-labelledby="explore-wingtip-title">
        <header className="home-section-heading"><p className="eyebrow">Three Wings</p><h2 id="explore-wingtip-title">Explore Wingtip</h2></header>
        <div className="destination-grid">
          {destinations.map((destination, index) => (
            <article className={`destination-card destination-card--${destination.accent}`} key={destination.to}>
              <div className="destination-card__top"><span className="destination-card__number" aria-hidden="true">0{index + 1}</span><span className="destination-card__icon" aria-hidden="true">{destination.icon}</span></div>
              <h3>{destination.title}</h3><p>{destination.description}</p><Link className="studio-button" to={destination.to}>Enter {destination.title}</Link>
            </article>
          ))}
        </div>
      </section>

      {featuredTrack && (
        <section className="home-feature" aria-labelledby="home-feature-title">
          <div className="home-feature__art">{featuredTrack.thumbnail ? <img src={featuredTrack.thumbnail} alt="" loading="lazy" /> : <span aria-hidden="true">{"\u266a"}</span>}</div>
          <div><p className="eyebrow">Current Exhibit</p><h2 id="home-feature-title">{featuredTrack.title}</h2><p>{featuredTrack.description ?? `A featured composition by ${featuredTrack.composer}.`}</p><small>From the Wingtip Archives</small></div>
          <Link className="studio-button" to="/music">Explore the composition</Link>
        </section>
      )}
    </main>
  );
}
