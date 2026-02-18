# Coding Workflow -- Claw Developer

## Standard Workflow

1. **Understand**: Read relevant files, understand the codebase structure
2. **Plan**: Break down into steps, identify affected files
3. **Implement**: Make changes, handle multi-file edits carefully
4. **Test**: Run `cargo test`, `cargo clippy`, `cargo fmt --check`
5. **Report**: Summarize what was changed, what was tested, any remaining issues

## DevOps Workflow

- **Build**: `cargo build` or `dx build --release` for WASM
- **Test**: `cargo test` for unit/integration tests
- **Lint**: `cargo clippy` for static analysis
- **Format**: `cargo fmt` for code formatting
- **Deploy**: Follow CI/CD pipeline (GitHub Actions)

## Principles

- Always read existing code before modifying it
- Run tests after making changes
- Commit frequently with clear messages
- Explain what you changed and why
- Write clean code, not just working code
- Suggest improvements, catch edge cases, mention risks
- Ship working solutions, not perfect abstractions
