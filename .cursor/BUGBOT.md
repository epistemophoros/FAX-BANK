# BugBot Review Rules - Foundry VTT Module

## Project Overview
This is a Foundry VTT module built with TypeScript, Vite, and GitHub Actions CI/CD.

## Review Guidelines

### Code Quality
- Ensure all TypeScript types are properly defined
- Check for proper null/undefined handling with Foundry's global `game` object
- Verify `@ts-expect-error` comments are justified and documented
- Confirm async functions properly handle promises (no floating promises)

### Foundry VTT Specific
- Module ID must match between `module.json` and `constants.ts`
- Settings must be registered before being accessed
- Hooks should use `Hooks.once()` for initialization, `Hooks.on()` for recurring events
- Templates must exist at the paths defined in `TEMPLATES` constant

### Style & Formatting
- Code must pass ESLint and Prettier checks
- Use double quotes for strings (Prettier config)
- CSS should use the module's CSS variables for theming

### Testing
- Unit tests required for utility functions
- Test files must be co-located with source files (`*.test.ts`)

### PR Requirements
- PR title should follow conventional commits format
- CHANGELOG.md should be updated for features/fixes
- Version bump required for releases to main

## Auto-Approve Conditions
BugBot may auto-approve PRs that:
- Only modify documentation (README, CHANGELOG, comments)
- Only update dependencies with passing tests
- Are minor formatting/style fixes

## Always Flag
- Changes to `module.json` manifest
- New dependencies added
- Changes to CI/CD workflows
- Security-related code changes

