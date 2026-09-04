/**
 * Verification-kind classification for fabrica Run objects.
 *
 * Decides what evidence a verification command represents: whether it invokes
 * Docker, and whether it builds a container. The semantic validator
 * (scripts/validate-run.mjs) and the fab-verify Gate validator
 * (scripts/_skill-gates.mjs) share this classification; each caller keeps its
 * own Gate-specific consequence.
 */

const DOCKER_COMMAND_RE = /(?:^|[^-\w])docker\b/;
const CONTAINER_BUILD_STEP_RE = /\b(build|compose)\b/;

/**
 * Whether a verification command invokes Docker.
 * @param {string} command Verification command text.
 * @returns {boolean}
 */
export function invokesDockerCommand(command) {
  return DOCKER_COMMAND_RE.test(command || '');
}

/**
 * Whether a verification command builds a container: a Docker invocation that
 * performs a build or compose step.
 * @param {string} command Verification command text.
 * @returns {boolean}
 */
export function buildsContainerCommand(command) {
  return invokesDockerCommand(command) && CONTAINER_BUILD_STEP_RE.test(command || '');
}
