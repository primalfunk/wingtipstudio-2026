import { Link } from "react-router-dom";
import PageMeta from "../components/PageMeta";
import { siteLinks } from "../content/siteLinks";

const strengths = [
  {
    title: "Engineering",
    items: ["Python", "SQL", "Power BI", "JavaScript", "Automation", "Machine Learning", "Artificial Intelligence", "System Design"],
  },
  {
    title: "Leadership",
    items: ["Executive Partnership", "Business Intelligence", "Forecasting", "Training", "Coaching", "Salesforce Administration", "Process Improvement", "Decision Support"],
  },
  {
    title: "Industries",
    items: ["Military Intelligence", "Hospitality", "Gaming", "Retail", "Consumer Electronics", "SaaS", "Customer Operations", "Independent Software"],
  },
] as const;

const currentProjects = [
  ["Cinelingus", "AI-assisted cinematic transformation, media analysis, and composable processing systems."],
  ["LODEX", "Local-first software engineering workflows for understanding, reviewing, and safely modifying code."],
  ["Wingtip Studio", "Independent research spanning simulation, procedural systems, games, music, and computational creativity."],
] as const;

const career = [
  ["Marketing Database Manager", "Little Creek Casino & Resort"],
  ["Sales Analyst", "Ecovacs Robotics Americas"],
  ["Business Intelligence Analyst / Sales Manager", "MarketStar"],
  ["Service Team Manager / Data Analyst", "Wayfair"],
  ["Account Manager", "Interbank FX"],
  ["General Manager", "Domino's Pizza"],
  ["Office Manager", "B-5 Construction"],
  ["Cryptologic Linguist", "United States Air Force"],
] as const;

const technologies = ["Python", "SQL", "Power BI", "DAX", "JavaScript", "PostgreSQL", "T-SQL", "Salesforce", "Azure", "Machine Learning", "Git", "Tableau", "HTML/CSS", "VBA", "Google Apps Script"] as const;

function ExternalActions({ includeEmail = false }: { includeEmail?: boolean }) {
  return (
    <div className="editorial-actions">
      {includeEmail && <a href={`mailto:${siteLinks.email}`}>Email</a>}
      {!includeEmail && <a href={siteLinks.resume} download="Jared-Menard-Resume.pdf">Download Resume</a>}
      <a href={siteLinks.github} target="_blank" rel="noreferrer">GitHub</a>
      <a href={siteLinks.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
      {includeEmail && <a href={siteLinks.resume} download="Jared-Menard-Resume.pdf">Download Resume</a>}
    </div>
  );
}

export default function ProfessionalPage() {
  return (
    <main className="site-page editorial-page professional-page">
      <PageMeta title="Jared Menard | Systems Engineer and Software Developer" description="Professional profile, engineering work, experience, and technologies for Jared Menard." />

      <header className="editorial-hero professional-hero">
        <p className="editorial-kicker">Professional</p>
        <h1>Jared Menard</h1>
        <p className="professional-title">Systems Engineer <span>|</span> Software Developer <span>|</span> Data &amp; AI Solutions</p>
        <p className="editorial-deck">Turning complexity into clarity.</p>
        <ExternalActions />
      </header>

      <section className="editorial-section" aria-labelledby="profile-title">
        <p className="editorial-index">01</p>
        <div>
          <h2 id="profile-title">Professional Profile</h2>
          <p className="section-lede">Throughout my career I have specialized in understanding unfamiliar systems, building accurate models of how they work, and creating software, analytics, and automation that help organizations make better decisions.</p>
          <p>My experience spans military intelligence, customer operations, hospitality, SaaS, consumer electronics, gaming, business intelligence, and independent software engineering.</p>
          <p>I enjoy solving difficult technical problems, learning unfamiliar domains quickly, and building systems that simplify complexity for the people who rely on them.</p>
        </div>
      </section>

      <section className="editorial-section" aria-labelledby="work-title">
        <p className="editorial-index">02</p>
        <div>
          <h2 id="work-title">How I Work</h2>
          <p className="section-lede">The industry has never mattered nearly as much to me as the underlying system.</p>
          <p>Whether I have been working in military intelligence, customer operations, robotics, casino analytics, or software engineering, my approach has remained remarkably consistent.</p>
          <div className="method-lines" aria-label="Working method">
            <p>Understand the system.</p>
            <p>Identify where unnecessary complexity prevents good decisions.</p>
            <p>Build practical tools that make those systems easier to understand and improve.</p>
          </div>
          <p>The software changes. The industries change. The process does not.</p>
        </div>
      </section>

      <section className="editorial-section editorial-section--wide" aria-labelledby="strengths-title">
        <p className="editorial-index">03</p>
        <div>
          <h2 id="strengths-title">What I Bring</h2>
          <div className="strength-columns">
            {strengths.map((group) => <section key={group.title}><h3>{group.title}</h3><ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul></section>)}
          </div>
        </div>
      </section>

      <section className="editorial-section" aria-labelledby="current-projects-title">
        <p className="editorial-index">04</p>
        <div>
          <h2 id="current-projects-title">Current Engineering Projects</h2>
          <p className="section-lede">A concise view of the systems I am actively developing. The Projects notebook contains the current technical focus for each.</p>
          <div className="project-index">
            {currentProjects.map(([title, description]) => <article key={title}><h3>{title}</h3><p>{description}</p></article>)}
          </div>
          <Link className="text-link" to="/projects">Explore the project notebook <span aria-hidden="true">→</span></Link>
        </div>
      </section>

      <section className="editorial-section" aria-labelledby="career-title">
        <p className="editorial-index">05</p>
        <div>
          <h2 id="career-title">Career</h2>
          <div className="career-list">
            {career.map(([role, company]) => <div key={`${role}-${company}`}><strong>{role}</strong><span>{company}</span></div>)}
          </div>
          <a className="text-link" href={siteLinks.resume} download="Jared-Menard-Resume.pdf">Download Resume <span aria-hidden="true">↓</span></a>
        </div>
      </section>

      <section className="editorial-section" aria-labelledby="technologies-title">
        <p className="editorial-index">06</p>
        <div>
          <h2 id="technologies-title">Technologies</h2>
          <p className="technology-list">{technologies.map((technology, index) => <span key={technology}>{technology}{index < technologies.length - 1 && <i aria-hidden="true">·</i>}</span>)}</p>
        </div>
      </section>

      <section className="editorial-section" aria-labelledby="exploration-title">
        <p className="editorial-index">07</p>
        <div>
          <h2 id="exploration-title">Continuing Exploration</h2>
          <p className="section-lede">Outside commercial software I continue building systems simply because I want to understand them.</p>
          <p>Current interests include artificial intelligence, procedural simulation, music composition, programming languages, and experimental software.</p>
          <p>I believe the best engineers remain students throughout their careers.</p>
        </div>
      </section>

      <section className="editorial-closing" aria-labelledby="professional-closing-title">
        <h2 id="professional-closing-title">Let's Build Something Better</h2>
        <p>If you're looking for someone who enjoys understanding difficult systems, building practical software, and helping organizations make better decisions through engineering and analytics, I'd enjoy hearing from you.</p>
        <ExternalActions includeEmail />
      </section>
    </main>
  );
}
