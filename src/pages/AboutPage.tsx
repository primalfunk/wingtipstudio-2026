import PageMeta from "../components/PageMeta";
import { siteContent } from "../content/siteContent";
import { siteLinks } from "../content/siteLinks";

export default function AboutPage() {
  const artwork = siteContent.home.heroArtwork;
  return (
    <main className="site-page editorial-page about-page">
      <PageMeta title="About Wingtip | Wingtip Studio" description="Why Wingtip Studio exists and the philosophy behind its games, music, tools, and experimental systems." />
      <header className="editorial-hero">
        <p className="editorial-kicker">About Wingtip</p>
        <h1>The Workshop</h1>
        <p className="editorial-deck">Meet the artist-engineer behind the games, music, tools, and strange machines.</p>
      </header>

      <section className="editorial-section" aria-labelledby="wingtip-title">
        <p className="editorial-index">01</p>
        <div>
          <h2 id="wingtip-title">Wingtip Studio</h2>
          <p className="section-lede">Wingtip Studio is where I build the projects I wish already existed.</p>
          <p>Some begin as software.</p>
          <p>Some begin as pieces of music.</p>
          <p>Others begin as questions that refuse to leave me alone.</p>
          <p>What they all share is curiosity.</p>
          <p>This studio exists because I enjoy exploring the places where engineering, mathematics, music, storytelling, simulation, and artificial intelligence begin to overlap.</p>
        </div>
      </section>

      <section className="editorial-section" aria-labelledby="philosophy-title">
        <p className="editorial-index">02</p>
        <div>
          <h2 id="philosophy-title">The Philosophy</h2>
          <p className="section-lede">I'm fascinated by software that creates rather than merely automates.</p>
          <p>Whether simulating worlds, composing music, remixing films, building local AI systems, or designing procedural games, my goal is always the same:</p>
          <p className="statement-line">Give computers just enough structure to surprise their creator.</p>
          <p>The most interesting ideas rarely belong entirely to one discipline.</p>
          <p>Music borrows from mathematics.</p>
          <p>Games borrow from psychology.</p>
          <p>Artificial intelligence becomes another creative instrument.</p>
          <p>Those intersections are where Wingtip Studio spends most of its time.</p>
        </div>
      </section>

      <section className="imagination-engine" aria-labelledby="engine-title">
        <figure><img src={artwork.src} alt={artwork.alt} /></figure>
        <div>
          <p className="editorial-index">03</p>
          <h2 id="engine-title">The Imagination Engine</h2>
          <blockquote>“I'm interested in building systems that surprise even their creator.”</blockquote>
        </div>
      </section>

      <section className="editorial-section" aria-labelledby="open-source-title">
        <p className="editorial-index">04</p>
        <div>
          <h2 id="open-source-title">Open Source</h2>
          <p className="section-lede">Many Wingtip projects are developed publicly.</p>
          <p>GitHub is where unfinished ideas become working software.</p>
          <a className="text-link" href={siteLinks.github} target="_blank" rel="noreferrer">Explore the source — github.com/primalfunk <span aria-hidden="true">↗</span></a>
        </div>
      </section>
    </main>
  );
}
