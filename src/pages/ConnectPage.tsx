import PageMeta from "../components/PageMeta";
import { siteLinks } from "../content/siteLinks";

export default function ConnectPage() {
  return (
    <main className="site-page editorial-page connect-page">
      <PageMeta title="Connect | Wingtip Studio" description="Begin a conversation with Jared Menard and Wingtip Studio." />
      <section className="connect-panel" aria-labelledby="connect-title">
        <p className="editorial-kicker">Connect</p>
        <h1 id="connect-title">Let's Build Something Interesting</h1>
        <p className="section-lede">Whether you're interested in software engineering, artificial intelligence, data systems, creative technology, simulation, game development, music, or simply have an unusual idea you'd like to explore, I'd be happy to hear from you.</p>
        <p>The best conversations usually begin with curiosity.</p>
        <p>Email is the easiest place to start: jared.d.menard@gmail.com</p>
        <div className="editorial-actions">
          <a href={`mailto:${siteLinks.email}`}>Email</a>
          <a href={siteLinks.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
          <a href={siteLinks.github} target="_blank" rel="noreferrer">GitHub</a>
          <a href={siteLinks.resume} download="Jared-Menard-Resume.pdf">Download Resume</a>
        </div>
      </section>
    </main>
  );
}
