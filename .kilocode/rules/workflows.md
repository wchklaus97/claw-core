# Development Workflows

## Workflow Skills

The project uses structured workflows for different development phases. Apply the appropriate workflow for each task.

## Brainstorming

Before any creative work (new features, components, behavior):
1. Explore multiple approaches with trade-offs
2. Consider edge cases and risks
3. Propose 2-3 options with pros/cons
4. Recommend one approach with rationale

## Writing Plans

Before touching code on multi-step tasks:
1. Define clear requirements and acceptance criteria
2. Break down into specific, actionable steps
3. Identify affected files and dependencies
4. Estimate complexity and risks
5. Define testing strategy

## Executing Plans

When running an implementation plan:
1. Work in batches of related changes
2. Review after each batch before proceeding
3. Run tests between batches
4. Adjust plan based on discoveries
5. Track progress and remaining work

## Test-Driven Development (TDD)

When implementing features or fixing bugs:
1. **RED**: Write a failing test that describes the desired behavior
2. **GREEN**: Write minimal code to make the test pass
3. **REFACTOR**: Clean up while keeping tests green
4. Repeat for each behavior

Rules:
- Never write implementation code without a failing test first
- Each test should test ONE behavior
- Run `cargo test` after each step

## Systematic Debugging

For bugs, test failures, or unexpected behavior:
1. **Reproduce**: Get a reliable reproduction case
2. **Isolate**: Narrow down to the smallest failing case
3. **Diagnose**: Identify root cause (not just symptoms)
4. **Fix**: Apply targeted fix
5. **Verify**: Confirm fix resolves the issue and doesn't introduce regressions

## Verification Before Completion

Before claiming work is complete:
1. All tests pass (`cargo test`)
2. No lint errors (`cargo clippy`)
3. Code is formatted (`cargo fmt --check`)
4. Changes are committed with clear message
5. No TODO/FIXME items left unaddressed

## Code Review Checklist

Before merging:
- Code follows project naming conventions (PascalCase, snake_case, kebab-case)
- i18n keys added to all 3 locale files
- No hardcoded strings in components
- Routes use locale-aware patterns
- Legal pages reuse shared layout components
- Tests cover new behavior
- Documentation updated if needed

## Git Workflow

- Use feature branches for new work
- Commit frequently with descriptive messages
- Run CI checks locally before pushing: `cargo fmt && cargo clippy && cargo test`
- Use git worktrees for parallel feature work when needed
