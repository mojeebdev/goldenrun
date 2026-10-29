import { makeCommand } from './command';
import { scenarioIdFor } from './scenarios';

/**
 * A fixed reference shot. Browser tests and the Worker /api/health endpoint
 * both simulate it; matching digests show the engines agree.
 */
export const CANONICAL_SHOT = makeCommand(scenarioIdFor('center-18', 'professional'), {
  aimX: 380,
  aimY: 640,
  power: 820,
  spin: 420,
});
