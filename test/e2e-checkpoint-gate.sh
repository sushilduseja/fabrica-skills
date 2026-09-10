#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VALIDATOR="$ROOT/scripts/validate-run.mjs"
FIXTURE="$ROOT/test/fixtures/valid-run.json"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

mutate() {
  node -e "const fs=require('fs'); const run=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); (()=>{ $1 })(); process.stdout.write(JSON.stringify(run,null,2));" "$FIXTURE"
}
check_mut() {
  local name="$1" expected="$2" pattern="$3" snippet="$4" out rc
  mutate "$snippet" > "$TMP/cand.json"
  out=$(node "$VALIDATOR" --stdin < "$TMP/cand.json" 2>&1); rc=$?
  if [ "$rc" -ne "$expected" ]; then echo "FAIL $name — expected rc=$expected, got rc=$rc"; printf '%s\n' "$out" | sed 's/^/     /'; FAIL=$((FAIL+1)); return; fi
  if [ -n "$pattern" ] && ! printf '%s' "$out" | grep -q "$pattern"; then echo "FAIL $name — output missing pattern: $pattern"; printf '%s\n' "$out" | sed 's/^/     /'; FAIL=$((FAIL+1)); return; fi
  echo "ok   $name"; PASS=$((PASS+1))
}

echo '# checkpoint gate e2e'
check_mut 'baseline fixture validates' 0 '' ''
check_mut 'record-less spec write is rejected' 1 'contains no approval' 'run.human_decisions=[];'
mutate 'run.human_decisions=[];' > "$TMP/rejected.json"
cp "$FIXTURE" "$TMP/live.json"
cp "$TMP/live.json" "$TMP/live.before.json"
out=$(node "$ROOT/scripts/validate-run.mjs" --stdin --commit "$TMP/live.json" < "$TMP/rejected.json" 2>&1); rc=$?
if [ "$rc" -ne 0 ] && cmp -s "$TMP/live.before.json" "$TMP/live.json"; then echo 'ok   failed --commit leaves live run byte-identical'; PASS=$((PASS+1)); else echo 'FAIL failed --commit leaves live run byte-identical'; FAIL=$((FAIL+1)); fi
check_mut 'record-carrying spec write is accepted' 0 '' ''
check_mut 'record-less blueprint write is rejected' 1 'approve blueprint' 'run.current_step="fab-plan"; run.blueprint_path="docs/blueprint.md"; run.human_decisions=[];'
check_mut 'blueprint write with its own record is accepted' 0 '' 'run.current_step="fab-plan"; run.blueprint_path="docs/blueprint.md"; run.human_decisions=[{step:"fab-plan",decision_needed:"Approve the blueprint",options:["approve","revise","reject"],decision:"approve",rationale:"approved",triggered_at:"2026-06-19T12:10:00Z",resolved_at:"2026-06-19T12:15:00Z"}];'
check_mut 'auto gate is exempt' 0 '' 'run.gate_levels["fab-spec"]="auto"; run.human_decisions=[];'
check_mut 'pending approval does not unlock' 1 'contains no approval' 'run.human_decisions=[{step:"fab-spec",decision_needed:"Approve",options:["approve","revise","reject"],decision:null,rationale:"pending",triggered_at:"2026-06-19T12:10:00Z",resolved_at:null}];'
mutate 'run.human_decisions=[];' > "$TMP/filemode.json"
out=$(node "$ROOT/scripts/validate-run.mjs" "$TMP/filemode.json" 2>&1); rc=$?
if [ "$rc" -ne 0 ]; then echo 'ok   file mode rejects record-less spec'; PASS=$((PASS+1)); else echo 'FAIL file mode rejects record-less spec'; FAIL=$((FAIL+1)); fi
check_mut 'later phase is unaffected' 0 '' 'run.current_step="fab-scaffold"; run.human_decisions=[];'
check_mut 'existing-project record-less spec is rejected' 1 'docs/fabrica/spec.md' 'run.spec_path="docs/fabrica/spec.md"; run.human_decisions=[];'
check_mut 'existing-project approved spec is accepted' 0 '' 'run.spec_path="docs/fabrica/spec.md";'
check_mut 'later revise record does not void prior approval' 0 '' 'run.human_decisions=[...run.human_decisions,{step:"fab-spec",decision_needed:"Approve revised spec",options:["approve","revise","reject"],decision:"revise",rationale:"revise",triggered_at:"2026-06-19T12:20:00Z",resolved_at:"2026-06-19T12:21:00Z"}];'
cp "$FIXTURE" "$TMP/approve-run.json"
before=$(cat "$TMP/approve-run.json")
out=$(node "$ROOT/scripts/approve.mjs" spec --file "$TMP/approve-run.json" < /dev/null 2>&1); rc=$?
now=$(cat "$TMP/approve-run.json")
if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -q terminal && [ "$before" = "$now" ]; then echo 'ok   piped approve refuses and leaves run byte-identical'; PASS=$((PASS+1)); else echo 'FAIL piped approve refusal'; printf '%s\n' "$out"; FAIL=$((FAIL+1)); fi

echo "# $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
