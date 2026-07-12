const port = process.env.PORT ?? '5174';
const runs = process.env.RUNS ?? '8';
const seconds = process.env.SECONDS ?? '90';
const missionId = process.env.MISSION ?? '1-1';
const base = `http://127.0.0.1:${port}/?harness=1&runs=${runs}&seconds=${seconds}&missionId=${missionId}`;

console.log('Start the harness server with: npm run dev:harness');
console.log('Open each URL and compare the final AI HARNESS COMPLETE panel:');
for (const difficulty of ['easy', 'medium', 'hard']) {
  console.log(`${difficulty.toUpperCase()}: ${base}&difficulty=${difficulty}`);
}
