export class AiPlayerReporter {
  static export(metrics) {
    const report = metrics.toJSON();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = `run_${report.seed}_${timestamp}`;
    this.download(`${base}.json`, JSON.stringify(report, null, 2), 'application/json');
    this.download(`${base}.txt`, this.toText(report), 'text/plain');
    return report;
  }

  static toText(report) {
    return [
      'AI PLAYTEST REPORT',
      `Seed: ${report.seed}`,
      `Strategy: ${report.strategy}`,
      `Result: ${report.result}`,
      `Reason: ${report.reason || 'n/a'}`,
      `Runtime: ${Math.round(report.runtimeMs / 1000)}s`,
      `Decks Visited: ${report.decksVisited}/${report.totalDecks}`,
      `Rooms Visited: ${report.roomsVisited}`,
      `Deaths: ${report.deaths}`,
      `Score: ${report.score}`,
      `Droids Neutralized: ${report.droidsNeutralized}/${report.totalDroids}`,
      `Captures: ${report.capturesSucceeded}/${report.capturesAttempted}`,
      `Highest Body: ${report.highestBody}`,
      `Lift Uses: ${report.liftUses}`,
      `Stuck Events: ${report.stuckEvents}`,
      `Path Failures: ${report.pathFailures}`,
      '',
      'EVENTS',
      ...report.events.map((event) => `${event.time}ms deck=${event.deckId ?? '-'} room=${event.roomId ?? '-'} body=${event.playerBody ?? '-'} ${event.eventType} ${JSON.stringify(event.details)}`)
    ].join('\n');
  }

  static download(filename, content, type) {
    if (typeof document === 'undefined') {
      console.log(filename, content);
      return;
    }
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}
