import assert from 'assert';
import { buildsContainerCommand, invokesDockerCommand } from '../scripts/_verification-kind.mjs';
import { test, runAll } from './_harness.mjs';

test('invokesDockerCommand classifies Docker invocations', () => {
  const cases = [
    ['docker build -t app .', true],
    ['docker compose build', true],
    ['docker images', true],
    ['sudo docker ps', true],
    ['node scripts/check-docker-files.mjs', false],
    ['node scripts/lint-dockerfiles.mjs', false],
    ['mydocker build', false],
    ['dockerfile lint', false],
  ];
  for (const [command, expected] of cases) {
    assert.strictEqual(
      invokesDockerCommand(command),
      expected,
      `invokesDockerCommand(${JSON.stringify(command)}) should be ${expected}`,
    );
  }
});

test('buildsContainerCommand classifies container builds', () => {
  const cases = [
    ['docker build -t app .', true],
    ['docker compose build', true],
    ['docker images', false],
    ['docker ps', false],
    ['npm run build', false],
    ['node scripts/check-docker-files.mjs', false],
    ['dockerfile build', false],
  ];
  for (const [command, expected] of cases) {
    assert.strictEqual(
      buildsContainerCommand(command),
      expected,
      `buildsContainerCommand(${JSON.stringify(command)}) should be ${expected}`,
    );
  }
});

runAll();
