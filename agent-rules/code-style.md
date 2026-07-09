# Code Style Guidelines

**When to use this file**: Refer to this file when writing or reviewing code for style, naming conventions, function structure, code organization, and best practices.

## Core Principles

### 1. Naming Conventions

- **Use explicit, self-describing names** that clearly communicate intent
- **Avoid abbreviations** unless they are universally understood (e.g., `id`, `url`, `api`)
- **Use descriptive variable names**: `userAuthenticationToken` instead of `token`, `chatMessageContent` instead of `content`
- **Function names should be verbs**: `fetchUserProfile()`, `validateEmailAddress()`, `calculateTotalPrice()`
- **Boolean variables should be questions**: `isUserAuthenticated`, `hasPermission`, `canEditPost`
- **Type/Interface names should be nouns**: `UserProfile`, `ChatMessage`, `ApiResponse`
- **Constants should be SCREAMING_SNAKE_CASE**: `MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEOUT_MS`
- **Avoid generic names**: Prefer `chatMessageId` over `id`, `userEmailAddress` over `email`

#### Explicit Data Scope Naming (Critical)

**ALWAYS be explicit about what data a variable contains, especially regarding scope and completeness:**

- **Be explicit about content scope:**
  - ✅ `rootChatsOnly` not `loadedChats` (if it only contains root chats, not children)
  - ✅ `allChatsIncludingChildren` not `chats` (if it includes everything)
  - ✅ `filteredChatsBySearchQuery` not `results` (if it's a filtered subset)
  - ✅ `visibleNodesOnly` not `nodes` (if it excludes hidden/collapsed nodes)

- **Be explicit about data source:**
  - ✅ `restoredFromLocalStorage` not `saved`
  - ✅ `fetchedFromAPI` not `loaded`
  - ✅ `computedFromState` not `derived`
  - ✅ `preservedFromPreviousSession` not `initial`

- **Be explicit about state lifecycle:**
  - ✅ `preservedCollapsedNodes` not `initialCollapsed` (if preserving existing state)
  - ✅ `restoredLoadedChildren` not `initialLoadedChildren` (if restoring from storage)
  - ✅ `calculatedCollapsedNodes` not `initialCollapsed` (if calculated, not initial)
  - ✅ `currentChatsArray` not `chats` (if it's the current state, not initial)

- **Use descriptive suffixes to clarify scope:**
  - `*Only` - indicates a subset (e.g., `rootChatsOnly`, `visibleNodesOnly`)
  - `*Including*` - indicates a superset (e.g., `chatsIncludingChildren`, `nodesIncludingHidden`)
  - `*From*` - indicates source (e.g., `chatsFromAPI`, `stateFromLocalStorage`)
  - `*For*` - indicates purpose (e.g., `chatsForDisplay`, `nodesForRendering`)

- **Document data scope in comments when naming isn't enough:**
  ```typescript
  /**
   * Root chats only - does NOT include child chats that were loaded via loadChatChildren()
   * Children are added to the chats state separately when nodes are uncollapsed
   */
  const rootChatsOnly = result.chats || [];
  ```

**Why this matters:** Misleading names like `loadedChats` (which only contains root chats) led to bugs where we assumed it contained all chats including children, causing data loss when preserving state. Explicit names prevent these assumptions.

### 2. Code Organization and Modularity

- **Single Responsibility Principle**: Each function, component, or class should have ONE clear responsibility - if you can't describe what it does in one sentence, it's doing too much
- **Prefer smaller units**: Break down complex operations into smaller, focused functions with clear action names
- **Compose functions**: Build complex behavior by composing smaller, well-named functions together
- **Extract reusable logic** into separate functions, hooks, or utilities
- **Group related functionality** together in modules or directories
- **Keep functions small and focused** - functions should be under 20 lines when possible, rarely exceed 50 lines. If a function exceeds 20 lines, look for opportunities to extract logic
- **Extract code that needs comments**: If a block of code needs a comment to explain what it does, extract it into a function with a self-describing name instead
- **Function composition over monolithic functions**: Prefer `validateUserInput()` + `sanitizeUserInput()` + `saveUserInput()` over one large `processUserInput()` function
- **Separate concerns**: Business logic in `/lib`, UI components in `/components`, API routes in `/app/api`
- **Use custom hooks** for reusable stateful logic
- **Create utility functions** for common operations (validation, formatting, transformations)

### 3. DRY (Don't Repeat Yourself)

- **Extract repeated code** into functions, hooks, or utilities
- **Use composition** over duplication
- **Create shared types/interfaces** for common data structures
- **Reuse components** instead of copying similar UI code
- **Centralize API client logic** - use a shared HTTP client wrapper
- **Abstract common patterns** (error handling, loading states, form validation)
- **Single Source of Truth**: Configuration values, defaults, and decisions should be owned in ONE place
- **Centralize configuration**: Model names, API endpoints, default values, constants, and magic strings/numbers should be defined once and imported where needed
- **One place to change**: If a value might change in the future (e.g., default model, timeout values, feature flags), it should only exist in one location
- **Avoid magic values**: Extract magic numbers, strings, and configuration values into named constants or configuration objects
- **Configuration files**: Use dedicated config files/modules for related settings (e.g., `models.ts`, `api-config.ts`, `feature-flags.ts`)
- **Shared utilities for common logic**: When similar logic appears in multiple places (e.g., viewport calculations, node positioning, coordinate transformations), extract it into shared utility functions in `/lib/utils/` to ensure consistency and prevent bugs from diverging implementations
- **Central configs for shared constants**: Create centralized configuration objects for values used across multiple modules (e.g., `NODE_DIMENSIONS`, `VIEWPORT_CONFIG`, `ANIMATION_DURATIONS`) - see `lib/utils/graph-viewport.ts` as an example

### 4. Abstractions (USE SPARINGLY)

**WARNING: Abstraction is not always better. Over-abstraction is a major source of complexity.**

- **Wait for the 3rd repetition** - Don't abstract until you see the pattern 3+ times
- **Abstractions must improve clarity** - If it makes code harder to follow, don't do it
- **Direct code beats premature abstraction** - It's OK to have some duplication
- **Inline is often clearer** - Don't extract just because you can
- **Question every layer** - Each abstraction layer adds mental overhead
- **Use TypeScript interfaces/types** to abstract data structures (this is good abstraction)
- **Create wrapper functions** ONLY when it genuinely simplifies understanding
- **Don't build frameworks** - Solve specific problems, not general ones
- **Abstractions should be obvious** - If you need to explain it, it's too complex
- **Remember: YAGNI (You Aren't Gonna Need It)** - Don't build for imaginary future requirements

### 5. Fix Before Adding

- **Don't default to writing more code** - first check if existing code needs to be fixed or refactored
- **Review existing implementations** before adding new features or functions
- **Refactor first, then extend**: If existing code is broken, unclear, or doesn't follow best practices, fix it before adding new functionality
- **Question the need for new code**: Can existing functions be reused? Can existing components be extended? Is there duplication that should be eliminated first?
- **Improve existing code quality** before building on top of it - don't accumulate technical debt
- **When adding features**: First ensure the foundation is solid, then build on it
- **Look for patterns**: If you're about to write similar code, check if existing code can be refactored to handle both cases

### 6. Root Cause Analysis & Clean Solutions

- **Always identify and fix the root cause** - not just the symptoms. When troubleshooting, dig deeper to understand WHY something is failing, not just WHAT is failing
- **Fix the design, not the symptoms**: Address the underlying architectural or design issue rather than patching surface-level problems
- **Remove broken approaches before trying new ones**: When an approach fails, do not layer fixes on top of flawed designs. Remove the broken code and implement a cleaner solution from scratch
- **Favor clarity and correctness over quick fixes**: Don't accumulate technical debt by piling workarounds on top of workarounds. A clean, well-designed solution is always preferable to multiple layers of fixes
- **Start fresh when needed**: If a solution approach isn't working, step back, remove the problematic code, and re-implement with a simpler, more maintainable design
- **Question the foundation**: If fixes keep accumulating, the underlying approach may be wrong - consider a different design pattern or architecture
- **Avoid entropy**: Each fix should reduce complexity, not increase it. If your fix adds more complexity, reconsider the approach

### 7. Algorithmic Optimization

- **Ensure new code is algorithmically optimized** - consider time and space complexity before implementing
- **Choose appropriate data structures**: Use `Set`/`Map` for O(1) lookups, `Array` for ordered data, consider trade-offs
- **Avoid nested loops when possible**: Look for opportunities to use hash maps, sorting, or other optimizations
- **Use efficient algorithms**: Prefer O(n log n) or better when possible, avoid O(n²) or worse unless necessary
- **Consider caching**: Cache expensive computations, API responses, or frequently accessed data
- **Batch operations**: Group multiple operations together when possible (e.g., batch database queries)
- **Lazy evaluation**: Defer expensive operations until they're actually needed
- **Early exits**: Return early from loops and functions when conditions are met
- **Use built-in methods**: Leverage optimized native methods (e.g., `Array.find()`, `Set.has()`) instead of manual loops
- **Profile before optimizing**: Measure performance bottlenecks before optimizing, optimize the hot paths
- **Document complexity**: When using non-obvious optimizations, document the reasoning and complexity

### 8. Single Source of Truth & Configuration Management

- **One place to own decisions**: Configuration values, defaults, model names, API endpoints, and business decisions should be defined in ONE place
- **One place to change**: If a value might change in the future, it should only exist in one location - changing it should require updating only that single location
- **Centralize configuration**: Create dedicated configuration files/modules for related settings (e.g., `lib/config/models.ts`, `lib/config/api-endpoints.ts`, `lib/config/feature-flags.ts`)
- **Export configuration constants**: Use named exports for configuration values that might change
- **Avoid magic values**: Never hardcode configuration values, model names, URLs, or constants directly in business logic
- **Configuration objects**: Group related configuration into objects (e.g., `DEFAULT_MODELS`, `API_TIMEOUTS`, `FEATURE_FLAGS`)
- **Type-safe configuration**: Use TypeScript types/interfaces for configuration to ensure type safety
- **Environment-specific config**: Use environment variables or config files for environment-specific values
- **Generic naming for changeable values**: When a value might change in the future, use generic variable names and comments that describe the purpose, not the specific value. This ensures only the constant definition needs to change, not variable names or comments throughout the codebase
  - ✅ Good: `const preferredDefaultWebSearchModel = webSearchModels.find(m => m.id === PREFERRED_DEFAULT_WEB_SEARCH_MODEL_ID)` with comment "Prefer the configured default web search model"
  - ❌ Bad: `const gemini3Flash = webSearchModels.find(m => m.id === ModelId.GOOGLE_GEMINI_3_FLASH_PREVIEW)` with comment "Prefer google/gemini-3-flash-preview"
  - The generic approach means changing `PREFERRED_DEFAULT_WEB_SEARCH_MODEL_ID` is the only change needed - no variable renames or comment updates required

## Function Structure (Clean Code Principles)

- **Functions should be small, very small**: The first rule of functions is that they should be small. The second rule is that they should be smaller than that. Aim for functions under 20 lines, rarely exceed 50 lines
- **Single Responsibility**: Each function should do ONE thing - if it does multiple things, split it into multiple functions. If you can't describe what a function does in one sentence, it's doing too much
- **Extract until you can't extract more**: Keep extracting methods until you can't extract any more. Each extracted function should have a clear, single purpose
- **If it needs a comment, extract it**: If a block of code warrants a comment explaining what it does, extract that logic into a function with a self-describing name. The function name should be so clear that comments become unnecessary
- **Extract complex conditionals into well-named functions**: Instead of inline conditionals with comments explaining the logic, extract the condition into a descriptive function. For example, instead of `if (isNewChat || await checkIfFirstUserMessage(...)) { // Check if this is the first user message... }`, use `if (await shouldGenerateTitleForChat(...)) { }`. The function name should clearly communicate the intent, making the comment unnecessary
- **Blocks should be one line**: Blocks within `if`, `else`, `while`, `for` statements should ideally be one line long - probably a function call. This makes the code read like a narrative
- **Compose with clear action names**: Break complex operations into smaller functions with descriptive action names, then compose them. Function names should be verbs that clearly describe the action
- **Long names are better than short enigmatic ones**: Don't be afraid to make a name long - a long descriptive name is better than a short enigmatic one. `calculateTotalPriceWithTaxAndDiscount()` is better than `calc()`
- **Function arguments**: The ideal number of arguments is zero (niladic). Next comes one (monadic), followed closely by two (dyadic). Three arguments (triadic) should be avoided where possible. More than three (polyadic) requires very special justification - use objects instead
- **Command Query Separation**: Functions should either do something (command) or answer something (query), but not both. `setUserActive(userId)` should not return a boolean - use `isUserActive(userId)` separately
- **Prefer composition**: `processUserRegistration()` should call `validateUserData()`, `checkEmailAvailability()`, `createUserAccount()`, `sendWelcomeEmail()` - each with a clear, single purpose
- **Algorithmic efficiency**: Consider time/space complexity - use appropriate data structures and algorithms
- **Early returns** for error cases and guard clauses - these reduce nesting and improve readability
- **Extract complex conditions** into well-named boolean variables or separate validation functions with descriptive names
- **Use descriptive variable names** in function bodies
- **Avoid side effects**: Functions should not have hidden side effects. If a function does something beyond its name, it's doing too much
- **When in doubt, split it**: If a function is hard to name or describe, it's likely doing too much - split it into smaller functions
- **The smaller the function, the easier to name**: The smaller and more focused a function is, the easier it is to choose a descriptive name

## Reducing Code Complexity

- **Avoid deep nesting**: Prefer 2-3 levels of nesting maximum. If nesting goes deeper, extract logic into separate functions
- **Invert conditions to avoid nesting**: Instead of `if (success) { /* nested logic */ }`, use `if (!success) { return; }` then continue with main logic. Check failure conditions first, return early, then proceed with the happy path
- **Use early exits/guard clauses**: Check error conditions and invalid inputs first, then return early. This flattens the code structure and eliminates nesting
- **Guard clauses pattern**: Put all guard clauses at the top of the function, then the main logic flows linearly without nesting
- **Extract nested logic**: If you have nested if/else or try/catch blocks, extract the nested code into well-named functions
- **Use continue/break in loops**: Skip iterations early with `continue` and exit loops early with `break` to avoid nested conditions
- **Prefer flat structures**: Use if-else-if chains or switch statements instead of deeply nested if-else blocks
- **Extract complex conditions**: Move complex boolean expressions into well-named functions or variables (e.g., `isValidUserRegistrationData()` instead of inline condition)
- **Use optional chaining and nullish coalescing**: `user?.profile?.name ?? "Unknown"` instead of nested if checks
- **Avoid else after return**: If you return early, you don't need an else clause - the code after the if is implicitly the else case
- **Extract switch/lookup tables**: For multiple conditions, prefer switch statements or lookup objects over nested if-else chains
- **One level of indentation per function**: Ideally, functions should have minimal indentation - extract nested blocks into separate functions
- **Fail fast**: Validate inputs and check preconditions at the start, return early if conditions aren't met

## File Organization

- **One main export per file** when possible (with supporting types/interfaces)
- **Group related exports** together
- **Use index files** to re-export from modules
- **Keep files focused** - if a file exceeds 300 lines, consider splitting

## Error Handling

- **Use descriptive error messages** that explain what went wrong and why
- **Create custom error classes** for different error types
- **Handle errors at appropriate levels** - don't swallow errors silently
- **Return error objects** with consistent structure: `{ success: false, error: string }`

## Performance Patterns (React-Specific)

- **`useMemo`**: Expensive computations (nodes, search)
- **`useCallback`**: Functions as props
- **`useRef`**: Mutable values, stale closure prevention
- **Debounce**: Position saves, frequent API calls (500ms)
- **Optimization**: **Don't prematurely optimize** - Simple first, optimize if needed

---

**See also**: 
- `agent-rules/typescript-guidelines.md` for TypeScript-specific guidelines
- `agent-rules/react-nextjs-guidelines.md` for React/Next.js guidelines
- `agent-rules/react-best-practices.md` for React performance optimization
- `rules/code-structure.md` for additional code organization patterns
