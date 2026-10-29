/**
 * Fixed world geometry in metres. Simulation space is independent of screen
 * pixels and orientation.
 *
 *   x: lateral, positive to the shooter's right
 *   y: height above the pitch
 *   z: distance from the ball spot toward the goal
 *
 * The goal line's back edge lies at z = scenario.distance. A goal requires the
 * WHOLE ball to pass that edge between the posts and under the crossbar.
 */
export const BALL_RADIUS = 0.11;
export const GOAL_HALF_WIDTH = 3.66; // inner edge of each post (7.32 m mouth)
export const GOAL_HEIGHT = 2.44; // underside of the crossbar
export const POST_RADIUS = 0.06; // 12 cm posts and bar
/** Post/bar axes sit on the goal line (whose width equals the post width). */
export const POST_AXIS_X = GOAL_HALF_WIDTH + POST_RADIUS;
export const BAR_AXIS_Y = GOAL_HEIGHT + POST_RADIUS;
export const FRAME_AXIS_Z_OFFSET = -POST_RADIUS;
/** Net depth at ground level and at roof level (back net slopes). */
export const NET_DEPTH_BOTTOM = 1.9;
export const NET_DEPTH_TOP = 0.9;
/** Keeper's working plane, in front of the goal line. */
export const KEEPER_LINE_OFFSET = 0.45;

export const GRAVITY = 9.81;
export const STEP_HZ = 240;
export const DT = 1 / STEP_HZ;
/** Replay samples are emitted every SAMPLE_EVERY steps (60 Hz). */
export const SAMPLE_EVERY = 4;
export const MAX_STEPS = STEP_HZ * 4; // 4 s hard cap

/** Depth of the back netting at height y (relative to the goal line). */
export function netDepthAt(y: number): number {
  const t = y <= 0 ? 0 : y >= GOAL_HEIGHT ? 1 : y / GOAL_HEIGHT;
  return NET_DEPTH_BOTTOM + (NET_DEPTH_TOP - NET_DEPTH_BOTTOM) * t;
}
