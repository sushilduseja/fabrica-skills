import assert from 'assert';
import { existsSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { STATUS_PHASE_MATRIX } from '../scripts/validate-run.mjs';
import {
  assertFail,
  assertNoStackTrace,
  assertPass,
  combined,
  readJson,
  run,
  test,
  validateStdin,
  runAll,
} from './_harness.mjs';

test('validate-run accepts the valid fixture', () => {
  const result = run(['scripts/validate-run.mjs', 'test/fixtures/valid-run.json']);
  assertPass(result);
  assert(combined(result).includes('[validate-run] OK'));
});

test('validate-run accepts deprecated skill ids with a deprecation warning', () => {
  const candidate = readJson('test/fixtures/valid-run.json');
  candidate.current_step = 'fab-intake';
  candidate.next_action = '/fab-weave';
  const result = validateStdin(candidate);
  assertPass(result, combined(result));
  assert(
    combined(result).includes('[validate-run] WARN: skill id "fab-intake" is deprecated; use "fab-spec"'),
    combined(result),
  );
  assert(
    combined(result).includes('[validate-run] WARN: skill id "fab-weave" is deprecated; use "fab-integrate"'),
    combined(result),
  );
  assert(combined(result).includes('[validate-run] OK'), combined(result));
  assertNoStackTrace(result);
});

test('validate-run rejects __proto__ current_step cleanly without alias warning', () => {
  const candidate = readJson('test/fixtures/valid-run.json');
  candidate.current_step = '__proto__';
  const result = validateStdin(candidate);
  assertFail(result);
  const out = combined(result);
  assert(!out.includes('WARN: skill id "__proto__"'), out);
  assert(out.includes('FAILED') || out.includes('ERROR'), out);
  assertNoStackTrace(result);
});

test('validate-run rejects malformed JSON with a clear error and no stack trace', () => {
  const result = run(['scripts/validate-run.mjs', '--stdin'], { input: '{bad json' });
  assertFail(result);
  assert(combined(result).includes('[validate-run] ERROR: Invalid JSON from stdin'));
  assertNoStackTrace(result);
});

test('validate-run rejects missing files with a clear error and no stack trace', () => {
  const result = run(['scripts/validate-run.mjs', 'test/fixtures/does-not-exist.json']);
  assertFail(result);
  assert(combined(result).includes('[validate-run] ERROR: File not found'));
  assertNoStackTrace(result);
});

test('validate-run rejects every missing required top-level field', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  for (const field of Object.keys(valid)) {
    const candidate = { ...valid };
    delete candidate[field];
    const result = validateStdin(candidate);
    assertFail(result, `field ${field} unexpectedly passed`);
    assert(combined(result).includes('must have required property'), `field ${field}: ${combined(result)}`);
  }
});

test('validate-run rejects invalid values for every run-object field family', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  const cases = [
    [
      'schema_version',
      (o) => {
        o.schema_version = '9.9.0';
      },
    ],
    [
      'id',
      (o) => {
        o.id = 'not-a-uuid';
      },
    ],
    [
      'name',
      (o) => {
        o.name = '../owned';
      },
    ],
    [
      'experiment_phase',
      (o) => {
        o.experiment_phase = 'phase_x';
      },
    ],
    [
      'created_at',
      (o) => {
        o.created_at = 'not-a-date';
      },
    ],
    [
      'updated_at',
      (o) => {
        o.updated_at = 'not-a-date';
      },
    ],
    [
      'status',
      (o) => {
        o.status = 'invalid_status';
      },
    ],
    [
      'current_step',
      (o) => {
        o.current_step = 'not-a-skill';
      },
    ],
    [
      'current_app_stage',
      (o) => {
        o.current_app_stage = '../stage';
      },
    ],
    [
      'next_action',
      (o) => {
        o.next_action = '/fab-build ../stage';
      },
    ],
    [
      'last_error',
      (o) => {
        o.last_error = { type: 'unknown_error', message: 'x' };
      },
    ],
    [
      'spec_path',
      (o) => {
        o.spec_path = '../spec.md';
      },
    ],
    [
      'blueprint_path',
      (o) => {
        o.blueprint_path = '../blueprint.md';
      },
    ],
    [
      'app_stages',
      (o) => {
        o.app_stages = [
          { name: '../x', purpose: '', status: 'done', quality_score: 11, artifacts: ['../secret'], notes: null },
        ];
      },
    ],
    [
      'costs',
      (o) => {
        o.costs.tokens_in = -1;
      },
    ],
    [
      'verifications',
      (o) => {
        o.verifications = [{ kind: 'unit', command: '', passed: true, summary: 'ok', timestamp: 'not-a-date' }];
      },
    ],
    [
      'human_decisions',
      (o) => {
        o.human_decisions = [
          {
            step: '',
            decision_needed: '',
            options: [],
            decision: null,
            rationale: null,
            triggered_at: 'not-a-date',
            resolved_at: null,
          },
        ];
      },
    ],
    [
      'gate_levels',
      (o) => {
        o.gate_levels['fab-verify'] = 'auto';
      },
    ],
    [
      'additionalProperties',
      (o) => {
        o.unvalidated_state = true;
      },
    ],
  ];

  for (const [label, mutate] of cases) {
    const candidate = JSON.parse(JSON.stringify(valid));
    mutate(candidate);
    const result = validateStdin(candidate);
    assertFail(result, `${label} unexpectedly passed`);
  }
});

test('validate-run enforces status × experiment_phase compatibility', () => {
  const candidate = readJson('test/fixtures/valid-run.json');
  candidate.status = 'complete';
  candidate.experiment_phase = 'phase_0_spec';
  const result = validateStdin(candidate);
  assertFail(result);
  assert(combined(result).includes('status "complete" is not valid'));
  assertNoStackTrace(result);
});

test('validate-run accepts fully populated valid run objects', () => {
  const candidate = readJson('test/fixtures/valid-run.json');
  candidate.experiment_phase = 'phase_2_pipeline';
  candidate.status = 'complete';
  candidate.current_step = 'fab-verify';
  candidate.current_app_stage = 'parse-input';
  candidate.next_action = '/fab-retro';
  candidate.last_error = { type: 'external_failure', message: 'Resolved local launch issue' };
  candidate.blueprint_path = 'docs/blueprint.md';
  candidate.app_stages = [
    {
      name: 'parse-input',
      purpose: 'Parse raw input into normalized fields',
      status: 'done',
      quality_score: 8.75,
      artifacts: ['src/parser.js', '.env.example'],
      notes: 'Ready for launch',
    },
  ];
  candidate.costs = {
    precision: 'measured',
    tokens_in: 10,
    tokens_out: 20,
    api_calls: 2,
    estimated_usd: 0.03,
    budget_usd: 1,
    by_step: {
      'fab-build': { precision: 'estimated', tokens_in: 5, tokens_out: 9, usd: 0.01 },
    },
  };
  candidate.verifications = [
    {
      kind: 'local_launch',
      command: 'npm run test',
      passed: true,
      summary: 'All local launch checks passed',
      timestamp: '2026-06-19T12:30:00Z',
    },
  ];
  candidate.human_decisions = [
    {
      step: 'fab-decide',
      decision_needed: 'Continue with local-only launch?',
      options: ['continue', 'abandon'],
      decision: 'continue',
      rationale: 'Prototype scope is local-only',
      triggered_at: '2026-06-19T12:00:00Z',
      resolved_at: '2026-06-19T12:01:00Z',
    },
  ];

  assertPass(validateStdin(candidate));
});

test('validate-run exhaustively enforces status × phase matrix', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  const matrix = {
    designing: ['phase_0_spec'],
    framing: ['phase_0_spec'],
    forging: ['phase_1_slice', 'phase_2_pipeline'],
    checking: ['phase_1_slice', 'phase_2_pipeline'],
    weaving: ['phase_2_pipeline'],
    verifying: ['phase_2_pipeline'],
    complete: ['phase_2_pipeline'],
    blocked: ['phase_0_spec', 'phase_1_slice', 'phase_2_pipeline'],
    abandoned: ['phase_0_spec', 'phase_1_slice', 'phase_2_pipeline'],
  };
  const phases = ['phase_0_spec', 'phase_1_slice', 'phase_2_pipeline'];

  for (const [status, allowed] of Object.entries(matrix)) {
    for (const phase of phases) {
      const candidate = JSON.parse(JSON.stringify(valid));
      candidate.status = status;
      candidate.experiment_phase = phase;
      if (['forging', 'checking', 'weaving', 'verifying', 'complete'].includes(status)) {
        candidate.app_stages = [
          {
            name: 'api',
            purpose: 'Build API',
            status: 'done',
            quality_score: 8,
            artifacts: ['src/api.js'],
            notes: null,
          },
        ];
        candidate.current_app_stage = 'api';
        candidate.next_action = status === 'complete' ? '/fab-retro' : '/fab-build api';
      }
      if (status === 'complete') {
        candidate.current_step = 'fab-verify';
        candidate.verifications = [
          {
            kind: 'local_launch',
            command: 'npm start',
            passed: true,
            summary: 'app launched',
            timestamp: '2026-06-19T12:30:00Z',
          },
        ];
      }
      const result = validateStdin(candidate);
      if (allowed.includes(phase)) {
        assertPass(result, `${status}/${phase} should pass: ${combined(result)}`);
      } else {
        assertFail(result, `${status}/${phase} should fail`);
        assert(combined(result).includes(`status "${status}" is not valid`));
      }
    }
  }
});

test('validate-run rejects empty stdin, mixed args, and malformed file input clearly', () => {
  let result = run(['scripts/validate-run.mjs', '--stdin'], { input: '' });
  assertFail(result);
  assert(combined(result).includes('No JSON received on stdin'));
  assertNoStackTrace(result);

  result = run(['scripts/validate-run.mjs', '--stdin', 'test/fixtures/valid-run.json'], { input: '{}' });
  assertFail(result);
  assert(combined(result).includes('Usage:'));
  assertNoStackTrace(result);

  const temp = mkdtempSync(join(tmpdir(), 'fabrica-bad-json-'));
  try {
    const bad = join(temp, 'bad.json');
    writeFileSync(bad, '{bad json', 'utf-8');
    result = run(['scripts/validate-run.mjs', bad]);
    assertFail(result);
    assert(combined(result).includes('Invalid JSON in'));
    assertNoStackTrace(result);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('_assert-invalid captures expected validation failures without leaking validator stderr', () => {
  const result = run(['scripts/_assert-invalid.mjs']);
  assertPass(result);
  assert(combined(result).includes('invalid-run.json fails as expected'));
  assert(!combined(result).includes('[validate-run] FAILED'), combined(result));
});

test('validate-run rejects nested additional properties in all structured objects', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  const stage = {
    name: 'api',
    purpose: 'Build API',
    status: 'done',
    quality_score: 8,
    artifacts: ['src/api.js'],
    notes: null,
  };
  const cases = [
    [
      'last_error extra',
      (o) => {
        o.last_error = { type: 'invalid_state', message: 'x', stack: 'nope' };
      },
    ],
    [
      'stage extra',
      (o) => {
        o.app_stages = [{ ...stage, owner: 'agent' }];
      },
    ],
    [
      'costs extra',
      (o) => {
        o.costs.currency = 'USD';
      },
    ],
    [
      'cost by_step extra',
      (o) => {
        o.costs.by_step = {
          'fab-build': { precision: 'estimated', tokens_in: 1, tokens_out: 1, usd: 0.01, model: 'x' },
        };
      },
    ],
    [
      'verification extra',
      (o) => {
        o.verifications = [
          {
            kind: 'unit',
            command: 'npm test',
            passed: true,
            summary: 'ok',
            timestamp: '2026-06-19T12:30:00Z',
            raw: 'nope',
          },
        ];
      },
    ],
    [
      'human decision extra',
      (o) => {
        o.human_decisions = [
          {
            step: 'fab-decide',
            decision_needed: 'Pick',
            options: ['a'],
            decision: null,
            rationale: null,
            triggered_at: '2026-06-19T12:30:00Z',
            resolved_at: null,
            raw: 'nope',
          },
        ];
      },
    ],
  ];

  for (const [label, mutate] of cases) {
    const candidate = JSON.parse(JSON.stringify(valid));
    mutate(candidate);
    const result = validateStdin(candidate);
    assertFail(result, `${label} unexpectedly passed`);
  }
});

test('validate-run accepts valid trace integration and terminal complete states', () => {
  const valid = readJson('test/fixtures/valid-run.json');

  const trace = JSON.parse(JSON.stringify(valid));
  trace.status = 'blocked';
  trace.app_stages = [
    { name: 'api', purpose: 'Build API', status: 'failed', quality_score: 4, artifacts: ['src/api.js'], notes: null },
  ];
  trace.next_action = '/fab-fix integration';
  assertPass(validateStdin(trace));

  const complete = JSON.parse(JSON.stringify(valid));
  complete.status = 'complete';
  complete.experiment_phase = 'phase_2_pipeline';
  complete.current_step = 'fab-verify';
  complete.current_app_stage = 'api';
  complete.next_action = '/fab-retro';
  complete.app_stages = [
    { name: 'api', purpose: 'Build API', status: 'done', quality_score: 9.5, artifacts: ['src/api.js'], notes: 'done' },
  ];
  complete.verifications = [
    {
      kind: 'local_launch',
      command: 'npm start',
      passed: true,
      summary: 'app launched',
      timestamp: '2026-06-19T12:30:00Z',
    },
  ];
  assertPass(validateStdin(complete));
});

test('validate-run rejects semantic run-state inconsistencies beyond JSON Schema', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  const baseStage = {
    name: 'api',
    purpose: 'Build the API',
    status: 'done',
    quality_score: 8,
    artifacts: ['src/api.js'],
    notes: null,
  };
  const cases = [
    [
      'duplicate app stage names',
      (o) => {
        o.app_stages = [baseStage, { ...baseStage }];
      },
      'duplicate app_stages name',
    ],
    [
      'current_app_stage missing from stages',
      (o) => {
        o.status = 'forging';
        o.experiment_phase = 'phase_1_slice';
        o.current_app_stage = 'missing';
        o.app_stages = [baseStage];
        o.next_action = '/fab-build api';
      },
      'current_app_stage "missing"',
    ],
    [
      'unknown next_action skill',
      (o) => {
        o.next_action = '/fab-not-real';
      },
      'next_action skill "fab-not-real"',
    ],
    [
      'build next_action missing stage argument',
      (o) => {
        o.status = 'forging';
        o.experiment_phase = 'phase_1_slice';
        o.app_stages = [baseStage];
        o.next_action = '/fab-build';
      },
      'references unknown app stage',
    ],
    [
      'build next_action unknown stage',
      (o) => {
        o.status = 'forging';
        o.experiment_phase = 'phase_1_slice';
        o.app_stages = [baseStage];
        o.next_action = '/fab-build web';
      },
      'references unknown app stage "web"',
    ],
    [
      'trace next_action unknown target',
      (o) => {
        o.status = 'blocked';
        o.app_stages = [baseStage];
        o.next_action = '/fab-fix web';
      },
      'unknown trace target "web"',
    ],
    [
      'complete with unfinished stages',
      (o) => {
        o.status = 'complete';
        o.experiment_phase = 'phase_2_pipeline';
        o.app_stages = [{ ...baseStage, status: 'blocked' }];
        o.next_action = '/fab-retro';
      },
      'requires all app stages to be done',
    ],
    [
      'complete with early current_step',
      (o) => {
        o.status = 'complete';
        o.experiment_phase = 'phase_2_pipeline';
        o.app_stages = [baseStage];
        o.current_step = 'fab-spec';
        o.next_action = '/fab-retro';
      },
      'not compatible with current_step',
    ],
    [
      'forging with no app stages',
      (o) => {
        o.status = 'forging';
        o.experiment_phase = 'phase_1_slice';
        o.app_stages = [];
        o.next_action = '/fab-scaffold';
      },
      'requires at least one app_stages entry',
    ],
  ];

  for (const [label, mutate, expected] of cases) {
    const candidate = JSON.parse(JSON.stringify(valid));
    mutate(candidate);
    const result = validateStdin(candidate);
    assertFail(result, `${label} unexpectedly passed`);
    assert(combined(result).includes(expected), `${label}: ${combined(result)}`);
    assertNoStackTrace(result);
  }
});

test('validate-run rejects Windows-hostile and trailing-punctuation slugs', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  const cases = [
    [
      'reserved run name',
      (o) => {
        o.name = 'con';
      },
    ],
    [
      'reserved run name with suffix separator',
      (o) => {
        o.name = 'aux-api';
      },
    ],
    [
      'trailing dot run name',
      (o) => {
        o.name = 'api.';
      },
    ],
    [
      'trailing dash stage',
      (o) => {
        o.app_stages = [
          { name: 'api-', purpose: 'x', status: 'pending', quality_score: null, artifacts: [], notes: null },
        ];
      },
    ],
    [
      'reserved current stage',
      (o) => {
        o.current_app_stage = 'nul';
      },
    ],
    [
      'reserved next action argument',
      (o) => {
        o.next_action = '/fab-build con';
      },
    ],
  ];

  for (const [label, mutate] of cases) {
    const candidate = JSON.parse(JSON.stringify(valid));
    mutate(candidate);
    const result = validateStdin(candidate);
    assertFail(result, `${label} unexpectedly passed`);
  }
});

test('validate-run accepts container verification kinds used by Docker-capable prototypes', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  for (const kind of ['container_build', 'static_analysis']) {
    const candidate = JSON.parse(JSON.stringify(valid));
    candidate.verifications = [
      {
        kind,
        command: kind === 'container_build' ? 'docker compose build' : 'node scripts/check-docker-files.mjs',
        passed: true,
        summary: `${kind} verification passed`,
        timestamp: '2026-06-19T12:30:00Z',
      },
    ];
    assertPass(validateStdin(candidate), `${kind} should validate`);
  }
});

test('validate-run enforces numeric and timestamp boundaries', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  const baseStage = {
    name: 'api',
    purpose: 'Build API',
    status: 'pending',
    quality_score: null,
    artifacts: [],
    notes: null,
  };

  const accepted = [
    ['score 0 pending', { ...baseStage, quality_score: 0 }],
    ['score 6 done', { ...baseStage, status: 'done', quality_score: 6 }],
    ['score 10 done', { ...baseStage, status: 'done', quality_score: 10 }],
    [
      'epoch created_at',
      (o) => {
        o.created_at = '1970-01-01T00:00:00Z';
      },
    ],
    [
      'far-future created_at',
      (o) => {
        o.created_at = '9999-12-31T23:59:59Z';
      },
    ],
  ];
  for (const [label, mutate] of accepted) {
    const candidate = JSON.parse(JSON.stringify(valid));
    if (typeof mutate === 'function') {
      mutate(candidate);
    } else {
      candidate.app_stages = [mutate];
    }
    assertPass(validateStdin(candidate), label);
  }

  const rejected = [
    [
      'score -1',
      (o) => {
        o.app_stages = [{ ...baseStage, quality_score: -1 }];
      },
    ],
    [
      'score 10.5',
      (o) => {
        o.app_stages = [{ ...baseStage, quality_score: 10.5 }];
      },
    ],
    [
      'date-only created_at',
      (o) => {
        o.created_at = '2026-06-19';
      },
    ],
    [
      'invalid month created_at',
      (o) => {
        o.created_at = '2026-13-01T00:00:00Z';
      },
    ],
  ];
  for (const [label, mutate] of rejected) {
    const candidate = JSON.parse(JSON.stringify(valid));
    mutate(candidate);
    assertFail(validateStdin(candidate), `${label} unexpectedly passed`);
  }
});

test('validate-run rejects out-of-set enum values across structured fields', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  const cases = [
    [
      'verification kind out of set',
      (o) => {
        o.verifications = [
          { kind: 'deploy', command: 'npm test', passed: true, summary: 'ok', timestamp: '2026-06-19T12:30:00Z' },
        ];
      },
    ],
    [
      'app stage status out of set',
      (o) => {
        o.app_stages = [
          { name: 'api', purpose: 'x', status: 'in-progress', quality_score: null, artifacts: [], notes: null },
        ];
      },
    ],
    [
      'gate_levels unknown skill key',
      (o) => {
        o.gate_levels['fab-ghost'] = 'auto';
      },
    ],
    [
      'cost by_step precision out of set',
      (o) => {
        o.costs.by_step = { 'fab-build': { precision: 'approximate', tokens_in: 1, tokens_out: 1, usd: 0.01 } };
      },
    ],
  ];
  for (const [label, mutate] of cases) {
    const candidate = JSON.parse(JSON.stringify(valid));
    mutate(candidate);
    assertFail(validateStdin(candidate), `${label} unexpectedly passed`);
  }
});

test('validate-run rejects wrong-typed field values', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  const cases = [
    [
      'name as number',
      (o) => {
        o.name = 123;
      },
    ],
    [
      'status as array',
      (o) => {
        o.status = ['designing'];
      },
    ],
    [
      'schema_version as number',
      (o) => {
        o.schema_version = 1;
      },
    ],
    [
      'created_at as number',
      (o) => {
        o.created_at = 0;
      },
    ],
    [
      'app_stages as object',
      (o) => {
        o.app_stages = {};
      },
    ],
    [
      'costs as string',
      (o) => {
        o.costs = 'unknown';
      },
    ],
    [
      'verifications as string',
      (o) => {
        o.verifications = 'none';
      },
    ],
    [
      'human_decisions as null',
      (o) => {
        o.human_decisions = null;
      },
    ],
    [
      'gate_levels as array',
      (o) => {
        o.gate_levels = [];
      },
    ],
    [
      'last_error message as number',
      (o) => {
        o.last_error = { type: 'invalid_state', message: 123 };
      },
    ],
    [
      'artifacts as string',
      (o) => {
        o.app_stages = [
          { name: 'api', purpose: 'x', status: 'pending', quality_score: null, artifacts: 'src/api.js', notes: null },
        ];
      },
    ],
    [
      'quality_score as string',
      (o) => {
        o.app_stages = [
          { name: 'api', purpose: 'x', status: 'pending', quality_score: 'high', artifacts: [], notes: null },
        ];
      },
    ],
  ];
  for (const [label, mutate] of cases) {
    const candidate = JSON.parse(JSON.stringify(valid));
    mutate(candidate);
    assertFail(validateStdin(candidate), `${label} unexpectedly passed`);
  }
});

test('validate-run enforces length and character boundaries', () => {
  const valid = readJson('test/fixtures/valid-run.json');

  const maxName = 'a'.repeat(63);
  const maxNameRun = JSON.parse(JSON.stringify(valid));
  maxNameRun.name = maxName;
  assertPass(validateStdin(maxNameRun), '63-char name should be accepted');

  const maxNotes = 'n'.repeat(1000);
  const maxNotesRun = JSON.parse(JSON.stringify(valid));
  maxNotesRun.app_stages = [
    { name: 'api', purpose: 'x', status: 'pending', quality_score: null, artifacts: [], notes: maxNotes },
  ];
  assertPass(validateStdin(maxNotesRun), '1000-char notes should be accepted');

  const cases = [
    [
      'overlong name',
      (o) => {
        o.name = 'a'.repeat(64);
      },
    ],
    [
      'name with space',
      (o) => {
        o.name = 'my run';
      },
    ],
    [
      'name with emoji',
      (o) => {
        o.name = 'invoice-📊';
      },
    ],
    [
      'name with uppercase',
      (o) => {
        o.name = 'Invoice';
      },
    ],
    [
      'name with non-ascii',
      (o) => {
        o.name = 'café';
      },
    ],
    [
      'overlong notes',
      (o) => {
        o.app_stages = [
          { name: 'api', purpose: 'x', status: 'pending', quality_score: null, artifacts: [], notes: 'n'.repeat(1001) },
        ];
      },
    ],
    [
      'overlong purpose',
      (o) => {
        o.app_stages = [
          { name: 'api', purpose: 'p'.repeat(501), status: 'pending', quality_score: null, artifacts: [], notes: null },
        ];
      },
    ],
    [
      'overlong artifact path',
      (o) => {
        o.app_stages = [
          {
            name: 'api',
            purpose: 'x',
            status: 'pending',
            quality_score: null,
            artifacts: ['a'.repeat(201)],
            notes: null,
          },
        ];
      },
    ],
    [
      'overlong last_error message',
      (o) => {
        o.last_error = { type: 'invalid_state', message: 'm'.repeat(501) };
      },
    ],
  ];
  for (const [label, mutate] of cases) {
    const candidate = JSON.parse(JSON.stringify(valid));
    mutate(candidate);
    assertFail(validateStdin(candidate), `${label} unexpectedly passed`);
  }
});

test('validate-run reports every schema violation in a compound object', () => {
  const candidate = JSON.parse(JSON.stringify(readJson('test/fixtures/valid-run.json')));
  candidate.name = 'con';
  candidate.costs.precision = 'approximate';
  const result = validateStdin(candidate);
  assertFail(result);
  assert(combined(result).includes('2 schema violation'), combined(result));
});

test('validate-run rejects every Windows reserved name across name-bearing fields', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  const reserved = [
    'con',
    'prn',
    'aux',
    'nul',
    ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
    ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
  ];

  for (const name of reserved) {
    const candidate = JSON.parse(JSON.stringify(valid));
    candidate.name = name;
    assertFail(validateStdin(candidate), `reserved run name "${name}" unexpectedly passed`);
  }

  const reservedArg = JSON.parse(JSON.stringify(valid));
  reservedArg.app_stages = [
    { name: 'api', purpose: 'x', status: 'pending', quality_score: null, artifacts: [], notes: null },
  ];
  reservedArg.next_action = '/fab-build com3';
  assertFail(validateStdin(reservedArg), 'reserved next_action argument "com3" unexpectedly passed');

  const reservedStage = JSON.parse(JSON.stringify(valid));
  reservedStage.app_stages = [
    { name: 'lpt5', purpose: 'x', status: 'pending', quality_score: null, artifacts: [], notes: null },
  ];
  assertFail(validateStdin(reservedStage), 'reserved stage name "lpt5" unexpectedly passed');

  const reservedStageRef = JSON.parse(JSON.stringify(valid));
  reservedStageRef.current_app_stage = 'com7';
  assertFail(validateStdin(reservedStageRef), 'reserved current_app_stage "com7" unexpectedly passed');

  for (const safe of ['consent', 'com10', 'lpt10', 'printer']) {
    const candidate = JSON.parse(JSON.stringify(valid));
    candidate.name = safe;
    assertPass(validateStdin(candidate), `safe name "${safe}" unexpectedly rejected`);
  }
});

test('validate-run rejects absolute and escaped path injection', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  const cases = [
    [
      'absolute spec_path',
      (o) => {
        o.spec_path = '/docs/spec.md';
      },
    ],
    [
      'non-docs spec_path',
      (o) => {
        o.spec_path = 'etc/passwd.md';
      },
    ],
    [
      'traversal spec_path',
      (o) => {
        o.spec_path = 'docs/../spec.md';
      },
    ],
    [
      'absolute blueprint_path',
      (o) => {
        o.blueprint_path = '/etc/blueprint.md';
      },
    ],
    [
      'absolute artifact path',
      (o) => {
        o.app_stages = [
          {
            name: 'api',
            purpose: 'x',
            status: 'pending',
            quality_score: null,
            artifacts: ['/etc/passwd'],
            notes: null,
          },
        ];
      },
    ],
  ];
  for (const [label, mutate] of cases) {
    const candidate = JSON.parse(JSON.stringify(valid));
    mutate(candidate);
    assertFail(validateStdin(candidate), `${label} unexpectedly passed`);
  }
});

test('validate-run handles large app_stages and history arrays without error', () => {
  const valid = readJson('test/fixtures/valid-run.json');

  const big = JSON.parse(JSON.stringify(valid));
  big.app_stages = Array.from({ length: 150 }, (_, i) => ({
    name: `stage-${String(i).padStart(3, '0')}`,
    purpose: 'p',
    status: 'pending',
    quality_score: null,
    artifacts: [],
    notes: null,
  }));
  assertPass(validateStdin(big));

  const bigInvalid = JSON.parse(JSON.stringify(big));
  bigInvalid.app_stages[149] = { ...bigInvalid.app_stages[149], name: 'stage-000' };
  assertFail(validateStdin(bigInvalid), 'duplicate stage among 150 must still be caught');

  const history = JSON.parse(JSON.stringify(valid));
  history.human_decisions = Array.from({ length: 200 }, (_, i) => ({
    step: 'fab-decide',
    decision_needed: 'Pick',
    options: ['continue', 'abandon'],
    decision: null,
    rationale: null,
    triggered_at: `2026-06-19T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`,
    resolved_at: null,
  }));
  history.verifications = Array.from({ length: 100 }, (_, i) => ({
    kind: 'unit',
    command: 'npm test',
    passed: true,
    summary: 'ok',
    timestamp: `2026-06-19T12:${String(i % 60).padStart(2, '0')}:00Z`,
  }));
  assertPass(validateStdin(history));

  const historyInvalid = JSON.parse(JSON.stringify(history));
  historyInvalid.verifications[99] = {
    ...historyInvalid.verifications[99],
    kind: 'deploy',
  };
  assertFail(validateStdin(historyInvalid), 'out-of-set verification kind among 100 must still be caught');
});

test('validate-run rejects verification kind / command inconsistencies', () => {
  const valid = readJson('test/fixtures/valid-run.json');
  const cases = [
    [
      'container_build with non-Docker command',
      {
        kind: 'container_build',
        command: 'node scripts/check-docker-files.mjs',
        passed: true,
        summary: 'static check',
        timestamp: '2026-06-19T12:30:00Z',
      },
      'does not appear to invoke Docker',
    ],
    [
      'static_analysis with Docker build command',
      {
        kind: 'static_analysis',
        command: 'docker compose build',
        passed: true,
        summary: 'container build',
        timestamp: '2026-06-19T12:30:00Z',
      },
      'appears to build a container',
    ],
  ];
  for (const [label, verification, expected] of cases) {
    const candidate = JSON.parse(JSON.stringify(valid));
    candidate.verifications = [verification];
    const result = validateStdin(candidate);
    assertFail(result, `${label} unexpectedly passed`);
    assert(combined(result).includes(expected), `${label}: ${combined(result)}`);
    assertNoStackTrace(result);
  }
});

test('validate-run STATUS_PHASE_MATRIX covers exactly the schema status enum', () => {
  const schema = readJson('schemas/run-object.schema.json');
  const statusEnum = schema.properties.status.enum;
  const matrixKeys = Object.keys(STATUS_PHASE_MATRIX).sort();
  const expected = [...statusEnum].sort();
  assert.deepStrictEqual(
    matrixKeys,
    expected,
    `STATUS_PHASE_MATRIX keys must match the schema status enum (expected ${JSON.stringify(expected)}, got ${JSON.stringify(matrixKeys)})`,
  );
  for (const status of statusEnum) {
    const phases = STATUS_PHASE_MATRIX[status];
    assert(Array.isArray(phases) && phases.length > 0, `status "${status}" must map to a non-empty phase list`);
  }
});

/* ================================================================
 *  preferred_stack (sequential stack prompting in fab-spec)
 * ================================================================ */

test('validate-run accepts explicit preferred_stack values', () => {
  const candidate = readJson('test/fixtures/valid-run.json');
  candidate.preferred_stack = { frontend: 'React + Vite', backend: 'Django', database: 'SQLite' };
  const result = validateStdin(candidate);
  assertPass(result, combined(result));
});

test('validate-run accepts all-null preferred_stack (no-preference case)', () => {
  const candidate = readJson('test/fixtures/valid-run.json');
  assert.deepStrictEqual(candidate.preferred_stack, { frontend: null, backend: null, database: null });
  const result = validateStdin(candidate);
  assertPass(result, combined(result));
});

test('validate-run rejects a run object missing preferred_stack', () => {
  const candidate = readJson('test/fixtures/valid-run.json');
  delete candidate.preferred_stack;
  const result = validateStdin(candidate);
  assertFail(result, 'missing preferred_stack unexpectedly passed');
  assert(combined(result).includes('must have required property'), combined(result));
});

test('validate-run rejects preferred_stack with an unexpected key', () => {
  const candidate = readJson('test/fixtures/valid-run.json');
  candidate.preferred_stack = { frontend: null, backend: null, database: null, queue: 'redis' };
  const result = validateStdin(candidate);
  assertFail(result, 'preferred_stack with extra key unexpectedly passed');
  assert(combined(result).includes('additional properties'), combined(result));
});

test('validate-run --commit writes validated stdin to the target atomically', () => {
  const dir = mkdtempSync(join(tmpdir(), 'validate-commit-'));
  try {
    const out = join(dir, 'fabrica.run.json');
    const candidate = readJson('test/fixtures/valid-run.json');
    const result = run(['scripts/validate-run.mjs', '--stdin', '--commit', out], {
      input: JSON.stringify(candidate),
    });
    assertPass(result, combined(result));
    assert(combined(result).includes(`committed to ${out}`), combined(result));
    assert.deepStrictEqual(JSON.parse(readFileSync(out, 'utf8')), candidate);
    assertNoStackTrace(result);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('validate-run --commit writes nothing when validation fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'validate-commit-'));
  try {
    const out = join(dir, 'fabrica.run.json');
    const candidate = readJson('test/fixtures/valid-run.json');
    delete candidate.preferred_stack;
    const result = run(['scripts/validate-run.mjs', '--stdin', '--commit', out], {
      input: JSON.stringify(candidate),
    });
    assertFail(result);
    assert(!existsSync(out), 'target must not be created when validation fails');
    assertNoStackTrace(result);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('validate-run --commit without --stdin is rejected', () => {
  const result = run(['scripts/validate-run.mjs', 'test/fixtures/valid-run.json', '--commit', 'out.json']);
  assertFail(result);
  assert(combined(result).includes('--commit requires --stdin'), combined(result));
  assertNoStackTrace(result);
});

test('validate-run rejects gate_levels.fab-verify set to auto (locked review gate)', () => {
  const candidate = readJson('test/fixtures/valid-run.json');
  candidate.gate_levels['fab-verify'] = 'auto';
  const result = validateStdin(candidate);
  assertFail(result, 'locked fab-verify gate set to auto unexpectedly passed');
  assertNoStackTrace(result);
});

runAll();
