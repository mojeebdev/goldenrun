// Prints save/goal rates per keeper level on a grid of shots — a quick balance check.
import { simulateShot, makeCommand, scenarioIdFor, KEEPER_LEVELS } from '../src/shared/rules/index';
for (const level of KEEPER_LEVELS) {
  const sid = scenarioIdFor('center-18', level);
  const counts: Record<string, number> = {};
  const lines: string[] = [];
  for (const aimX of [-450, -350, -250, -150, 0, 150, 250, 350, 450])
    for (const aimY of [0, 200, 400, 600])
      for (const power of [300, 600, 900])
        for (const spin of [0, 600]) {
          const r = simulateShot(makeCommand(sid, { aimX, aimY, power, spin }));
          counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
          if (aimY === 400 && spin === 0) lines.push(`${aimX}/${power}:${r.outcome[0]}${r.keeperContact ? r.keeperContact.kind[0] : ''}`);
        }
  console.log(level, JSON.stringify(counts));
  console.log('  ', lines.join(' '));
}
