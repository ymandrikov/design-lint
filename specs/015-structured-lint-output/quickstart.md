# Quickstart: Structured Lint Output

Validation scenarios proving the feature end-to-end. Contracts: [cli.md](./contracts/cli.md),
[run-record.schema.json](./contracts/run-record.schema.json).

## Prerequisites

```sh
pnpm install
```

## 1. JSON mode emits one parseable full run record (US1)

```sh
node lint-color/index.ts fixtures/demo-app --format json | node -e '
  const d = JSON.parse(require("fs").readFileSync(0, "utf-8"));
  console.log(d.summary.violations, d.violations.length, Object.keys(d));
'
```

Expected: parse succeeds; `summary.violations === violations.length`; keys are
`summary, violations, ignores, warnings, missingSourceDirs`; every violation has
`file, line, rule, message` with kebab-case rule names; exit code of the lint
process is 1 (demo fixture seeds violations).

## 2. Determinism (US1, SC-002)

```sh
node lint-color/index.ts fixtures/demo-app --format json > /tmp/run-a.json
node lint-color/index.ts fixtures/demo-app --format json > /tmp/run-b.json
diff /tmp/run-a.json /tmp/run-b.json && echo BYTE-IDENTICAL
```

Expected: `BYTE-IDENTICAL`. Violations sorted by file → line → rule.

## 3. Exit-code matrix (US2)

```sh
# violations → 1
node lint-color/index.ts fixtures/demo-app --format json > /dev/null; echo $?   # 1

# run error: bad format value → 2
node lint-color/index.ts fixtures/demo-app --format yaml; echo $?               # 2, stderr names accepted values

# run error: missing configured dir → 2 (was 1)
# (use a temp target whose colors.json names a nonexistent sourceDirectory — see tests/e2e.test.ts helper)

# clean → 0
# (temp target with valid config and no violations)
```

## 4. Human summary table (US3)

```sh
pnpm lint:demo
```

Expected: first lines show `Color lint: N violations in M files` plus per-rule counts
(descending), then existing rule-grouped detail. Counts match the detail listing and
the JSON run's `summary`.

## 5. Default unchanged

```sh
node lint-color/index.ts fixtures/demo-app
```

Expected: human report (no flag needed), exit 1.

## 6. Automated gates

```sh
pnpm typecheck   # zero errors
pnpm test        # report.test.ts unit tests + extended e2e green
pnpm lint:demo   # reviewed human output
pnpm lint:demo:json | jq .summary   # reviewed JSON output
```
