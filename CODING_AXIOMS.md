# Coding Axioms

Rules for writing code in this project. Language-independent unless noted.
When an axiom conflicts with a language's idioms, **idiomatic code wins.**
When an axiom causes measurable slowness, a small imperative escape is fine.

---

## 1. Fail loudly, not gracefully

A clean failure surfaces the real problem. A confident-sounding fallback buries it.
No default values that mask missing data. No silent catches. No graceful degradation
to a plausible guess. If something is wrong, the code should scream — not whisper
a wrong answer.

```ts
// wrong
const botId = config.botId ?? "default-bot";

// right
if (!config.botId) throw new Error("botId not configured");
```

## 2. Three lines > one abstraction

Don't extract a helper for something that happens once. Don't create a utility
module for a one-off operation. Three similar lines of code is better than a
premature abstraction. If you find yourself writing the same thing a fourth time,
then extract.

## 3. Don't build for hypothetical futures

Solve the problem in front of you. No feature flags for features that don't exist.
No backwards-compatibility shims for callers that don't exist. No config options
for variations nobody asked for. The right amount of complexity is the minimum
needed for the current task.

## 4. Deterministic beats probabilistic

Every piece of logic in a tested tool is a hallucination that can never happen.
If behavior can be codified into a function with known inputs and outputs, do that.
Don't leave it to runtime inference, string matching, or pattern guessing.

## 5. Functional-leaning, not functional-religious

Prefer pure functions, immutable data, and composition. But don't worship the
paradigm. A `for` loop that's clear and fast beats a `reduce` chain that
allocates needlessly. Use the functional approach when it makes the code shorter
and clearer. Use the imperative approach when it makes the code faster or more
readable for the language.

```ts
// fine — functional is clearer here
const names = users.filter(u => u.active).map(u => u.name);

// also fine — imperative is faster and clearer for mutation
for (const row of rows) {
  db.prepare("INSERT INTO t VALUES (?)").run(row.id);
}
```

## 6. Idiomatic code wins

Don't force patterns from one language into another. Go doesn't need monads.
Python doesn't need Java-style interfaces. TypeScript doesn't need Hungarian
notation. Write code that a senior engineer in that language would recognize
as natural.

## 7. No over-engineering

Don't add features, refactor code, or make "improvements" beyond what was asked.
A bug fix doesn't need surrounding code cleaned up. A simple feature doesn't need
extra configurability. Don't add docstrings, comments, or type annotations to
code you didn't change. Only add comments where the logic isn't self-evident.

## 8. Validate at boundaries, trust internally

Only validate at system boundaries — user input, external APIs, file I/O.
Don't add runtime checks for impossible states inside your own code. If a
function receives a type, trust the type. Don't re-validate what the caller
already guaranteed.

## 9. Composition over inheritance

Small functions that compose beat class hierarchies. Pipes beat orchestrators.
A tool that does one thing and exits beats a framework that does everything
and never finishes.

## 10. Delete, don't deprecate

If something is unused, delete it. No `// removed` comments. No `_unused`
renames. No re-exports for backwards compatibility with zero callers.
Git has history. Use it.

## 11. Tests prove behavior, not coverage

Write tests that would catch real bugs. Don't write tests to hit a coverage
number. A single integration test that exercises the real path is worth more
than ten unit tests that mock everything.

## 12. Error messages are UI

Error messages are read by humans. Make them specific, actionable, and short.
Include what went wrong, what was expected, and what to do about it.

```
// wrong
Error: invalid input

// right
Error: botId not found in openclaw.json — run the setup wizard at http://localhost:4210
```

## 13. Naming is the only documentation that stays current

Good names eliminate the need for comments. If a function needs a comment to
explain what it does, rename the function. If a variable needs a comment to
explain what it holds, rename the variable.

## 14. Side effects at the edges

Keep the core logic pure. Push I/O, database calls, and network requests to
the edges of the call stack. The function that decides what to do should not
be the function that does it.

## 15. Explicit over implicit

No magic. No action at a distance. No global state that changes behavior
based on who imported what. If a function needs something, pass it in.
If a module has a dependency, import it. If a behavior changes based on
a condition, the condition should be visible at the call site.
