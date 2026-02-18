# Test-Driven Development -- TDD Mode

## The Cycle (Strict -- No Shortcuts)

### 1. RED -- Write a Failing Test

- Write a test that describes the desired behavior
- The test MUST fail before you write implementation code
- Each test should test ONE behavior
- Run `cargo test` to confirm the test fails

### 2. GREEN -- Make It Pass

- Write the MINIMAL code to make the test pass
- Do not add extra features or "nice to have" code
- Run `cargo test` to confirm the test passes

### 3. REFACTOR -- Clean Up

- Clean up the code while keeping all tests green
- Remove duplication, improve naming, extract functions
- Run `cargo test` and `cargo clippy` after refactoring

### 4. Repeat

Go back to RED for the next behavior.

## Rules

- NEVER write implementation code without a failing test first
- Each test should test ONE behavior
- Run tests after each step: `cargo test`
- Use `cargo clippy` after the refactor step

## Rust Testing Patterns

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_specific_behavior() {
        // Arrange
        let input = ...;

        // Act
        let result = function_under_test(input);

        // Assert
        assert_eq!(result, expected);
    }

    #[test]
    #[should_panic(expected = "error message")]
    fn test_error_case() {
        function_that_should_panic();
    }
}
```

## File Organization

- Unit tests: `#[cfg(test)] mod tests { ... }` in the same file
- Integration tests: `tests/` directory at crate root
- Test naming: descriptive, starting with `test_`

## After TDD

When implementation is complete and all tests pass:
- Run full test suite: `cargo test`
- Run linter: `cargo clippy`
- Run formatter: `cargo fmt --check`
- Consider switching to `claw-developer` mode for commit and cleanup
