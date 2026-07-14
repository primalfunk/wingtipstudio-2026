import PageMeta from "../components/PageMeta";
import { siteLinks } from "../content/siteLinks";

const projects = [
  {
    title: "LODEX",
    description: "A local-first AI software engineering assistant for safely understanding, planning, and modifying software projects using local language models.",
    focus: "Planning workflows, intelligent patch generation, code understanding, workspace analysis, and local development.",
  },
  {
    title: "Cinelingus",
    description: "An experimental cinematic transformation platform capable of remixing dialogue, performances, timing, and semantics into entirely new films.",
    focus: "Contract-driven filter architecture, speaker identity, semantic scene analysis, and composable transformation chains.",
    href: siteLinks.cinelingus,
  },
  {
    title: "Billionaire Simulator",
    description: "A large-scale simulation of business, investment, wealth creation, and emergent economic storytelling.",
    focus: "Deep historical simulation, procedural companies, newspapers, industries, and believable economic systems.",
  },
  {
    title: "Enchanted Castle Rebooted",
    description: "A modern reconstruction of a classic parser adventure emphasizing procedural storytelling and literary prose.",
    focus: "Parser interaction, procedural castles, narrative systems, and dynamic puzzle generation.",
  },
  {
    title: "Angle Wars",
    description: "A spiritual successor to Scorched Earth built around outrageous artillery, expressive physics, ridiculous weapons, and emergent strategy.",
    focus: "Physics experimentation and tactical gameplay.",
  },
] as const;

export default function ProjectsPage() {
  return (
    <main className="site-page editorial-page projects-page">
      <PageMeta title="Projects | Wingtip Studio" description="The living engineering notebook for current Wingtip Studio software, simulation, and game projects." />
      <header className="editorial-hero">
        <p className="editorial-kicker">Engineering Notebook</p>
        <h1>Projects</h1>
        <p className="editorial-deck">Current systems, experiments, and works in progress.</p>
      </header>
      <div className="project-notebook">
        {projects.map((project, index) => (
          <article key={project.title}>
            <p className="editorial-index">{String(index + 1).padStart(2, "0")}</p>
            <div>
              <h2>{project.title}</h2>
              <p className="section-lede">{project.description}</p>
              <h3>Current focus</h3>
              <p>{project.focus}</p>
              {"href" in project && <a className="text-link" href={project.href} target="_blank" rel="noreferrer">View on GitHub <span aria-hidden="true">↗</span></a>}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
