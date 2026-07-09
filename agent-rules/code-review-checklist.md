# Code Review Checklist

**When to use this file**: Refer to this file when reviewing code or before submitting code for review to ensure all quality standards are met.

## Critical Checks

- [ ] **SIMPLICITY CHECK** - Is this the simplest solution? Am I overcomplicating? Can I remove abstraction layers?
- [ ] **Core Development Principles followed** - No duplication, no fragile code, no functionality broken
- [ ] **Memory bank was consulted** - Core principles and relevant documentation were read before making changes
- [ ] **Memory bank was updated** - Documentation was created or updated if feature/system changed
- [ ] **Existing patterns were followed** - Documented utilities and patterns were used (e.g., `getNodeDimensions()`, `useIsMobile()`)
- [ ] **No duplicate logic** - Shared functionality was extracted, not duplicated
- [ ] **No fragile code** - Code uses types, abstractions, and clear contracts
- [ ] **No functionality broken** - Existing features were tested and still work

## Code Quality

- [ ] All names are explicit and self-describing
- [ ] No code duplication - logic is extracted and reused
- [ ] Functions/components are focused on a single responsibility
- [ ] Types are explicit and well-defined
- [ ] Error handling is consistent and descriptive
- [ ] Complex logic is abstracted into reusable functions/hooks
- [ ] Code is easy to read and understand without comments
- [ ] Related code is grouped together
- [ ] Abstractions improve clarity without over-engineering

## Mobile Responsiveness

- [ ] **All UI changes are mobile responsive** - tested on mobile viewports (320px - 768px)
- [ ] Touch targets are appropriately sized (minimum 44x44px)
- [ ] Layouts adapt properly across breakpoints (mobile, tablet, desktop)
- [ ] No horizontal scrolling on mobile devices
- [ ] Typography and spacing scale appropriately for different screen sizes

## Function Quality

- [ ] Functions are small (under 20 lines when possible, rarely exceed 50 lines)
- [ ] Functions have single responsibility - can be described in one clear sentence
- [ ] Code that would need comments has been extracted into functions with self-describing names
- [ ] Blocks within if/else/while/for are ideally one line (function calls)
- [ ] Complex operations are broken into smaller functions with clear action names
- [ ] Functions are composed together rather than being monolithic
- [ ] Each function/class does exactly one thing well
- [ ] Function names are descriptive verbs - long names are preferred over short enigmatic ones
- [ ] Functions have minimal arguments (0-2 preferred, 3+ should use objects)
- [ ] Functions either do something OR answer something, not both (Command Query Separation)
- [ ] No hidden side effects - functions do only what their name suggests

## Code Review Best Practices

- [ ] **Existing code was reviewed and fixed/refactored before adding new code**
- [ ] No unnecessary duplication - existing functions/components were reused or refactored when possible
- [ ] Code quality was improved before extending functionality
- [ ] **Root cause was identified and fixed** - not just symptoms or surface-level issues
- [ ] **Broken approaches were removed before trying new ones** - didn't layer fixes on top of flawed designs
- [ ] **Solution is clean and maintainable** - avoided quick fixes that increase complexity/entropy
- [ ] **Design was fixed, not masked** - addressed underlying architectural issues rather than patching symptoms

## Performance & Optimization

- [ ] **New code is algorithmically optimized** - appropriate time/space complexity
- [ ] Appropriate data structures are used (Set/Map for lookups, etc.)
- [ ] Nested loops are avoided when possible - optimized to use hash maps or better algorithms
- [ ] Expensive operations are cached when appropriate
- [ ] Early exits are used to avoid unnecessary computation

## Configuration & Constants

- [ ] **Configuration values are centralized** - model names, defaults, constants in one place
- [ ] **Single Source of Truth** - values that might change are defined once and imported
- [ ] No magic numbers or strings - all values are named constants
- [ ] Configuration is type-safe and well-organized
- [ ] Changing a default value requires updating only one location
- [ ] **Shared utilities are used** - similar logic across multiple files uses shared utilities (e.g., `lib/utils/graph-viewport.ts`)
- [ ] **Central configs for shared constants** - values used in multiple places are defined in centralized config objects
- [ ] **Before duplicating logic**: Checked if shared utilities exist, created them if needed

## Code Complexity

- [ ] **Code complexity is minimized** - avoid deep nesting (max 2-3 levels)
- [ ] **Conditions are inverted** - check failure conditions first, return early, then proceed with happy path
- [ ] Early exits/guard clauses are used to reduce nesting
- [ ] Complex nested logic is extracted into separate functions
- [ ] Optional chaining and nullish coalescing are used instead of nested null checks
- [ ] No unnecessary else clauses after return statements
- [ ] Loops use continue/break to avoid nested conditions
- [ ] Complex conditions are extracted into well-named functions or variables
- [ ] Instead of `if (success) { nested logic }`, use `if (!success) { return; }` then continue linearly

---

**See also**: 
- `agent-rules/code-style.md` for detailed code style guidelines
- `agent-rules/typescript-guidelines.md` for TypeScript-specific checks
- `agent-rules/react-nextjs-guidelines.md` for React/Next.js-specific checks
