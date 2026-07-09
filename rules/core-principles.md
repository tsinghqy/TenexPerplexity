# Core Development Principles

These are the foundational principles that guide all code in this project. They are NON-NEGOTIABLE and should be followed in all development work.

## 1. Naming Conventions

- **Use explicit, self-describing names** that clearly communicate intent
- **Avoid abbreviations** unless they are universally understood (e.g., `id`, `url`, `api`)
- **Use descriptive variable names**: `userAuthenticationToken` instead of `token`, `chatMessageContent` instead of `content`
- **Function names should be verbs**: `fetchUserProfile()`, `validateEmailAddress()`, `calculateTotalPrice()`
- **Boolean variables should be questions**: `isUserAuthenticated`, `hasPermission`, `canEditPost`
- **Type/Interface names should be nouns**: `UserProfile`, `ChatMessage`, `ApiResponse`
- **Constants should be SCREAMING_SNAKE_CASE**: `MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEOUT_MS`
- **Avoid generic names**: Prefer `chatMessageId` over `id`, `userEmailAddress` over `email`

### Explicit Data Scope Naming (Critical)

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

### Examples

```typescript
// ✅ Good: Explicit and descriptive
async function fetchUserProfileById(
  userId: string
): Promise<UserProfile | null> {
  // ...
}

const isUserAuthenticated = user !== null && user.token !== undefined;

interface ChatMessageBubbleProps {
  messageContent: string;
  senderName: string;
  timestamp: Date;
  onMessageEdit: (messageId: string) => void;
}

// ❌ Bad: Vague and unclear
async function get(id: string): Promise<any> {
  // ...
}

const flag = user && user.t;

interface Props {
  msg: string;
  name: string;
  time: Date;
  onClick: (id: string) => void;
}
```

## 2. Code Organization and Modularity

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

### Examples

```typescript
// ✅ Good: Extracted reusable hook
function useChatMessages(chatId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchChatMessages(chatId)
      .then(setMessages)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [chatId]);

  return { messages, isLoading, error };
}

// ❌ Bad: Logic duplicated in component
function ChatComponent({ chatId }: { chatId: string }) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // ... duplicated in multiple components
}
```

## 3. DRY (Don't Repeat Yourself)

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
- **Use Strategy pattern for variations**: When you have multiple ways to perform the same operation with different algorithms, use the Strategy pattern to centralize shared logic while allowing variations. See `lib/hooks/useChatCreation.ts` for an example of chat creation strategies that share common logic (temp ID generation, database insertion, state updates) while allowing different position calculations and edge cases (initial messages, animation positions, edge creation). This eliminates code duplication and makes it easy to track and add new variations.

### Examples

```typescript
// ✅ Good: Abstracted API client with consistent error handling
async function httpClient<T>(
  endpoint: string,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(endpoint, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ❌ Bad: Repeated error handling in every function
async function getChats() {
  try {
    const response = await fetch("/api/chat");
    // ... error handling duplicated everywhere
  } catch (error) {
    // ... same error handling code
  }
}
```

## 4. Abstractions

- **Create abstractions when code is repeated 3+ times** or when it improves clarity
- **Use TypeScript interfaces/types** to abstract data structures
- **Create wrapper functions** for complex operations that hide implementation details
- **Use higher-order functions** when patterns repeat (e.g., error handling wrappers)
- **Abstract API calls** through a centralized client with consistent error handling
- **Create reusable hooks** for common patterns (form handling, data fetching, etc.)
- **Don't over-abstract** - if abstraction doesn't improve clarity or reduce duplication, keep it simple

## 5. Fix Before Adding

- **Don't default to writing more code** - first check if existing code needs to be fixed or refactored
- **Review existing implementations** before adding new features or functions
- **Refactor first, then extend**: If existing code is broken, unclear, or doesn't follow best practices, fix it before adding new functionality
- **Question the need for new code**: Can existing functions be reused? Can existing components be extended? Is there duplication that should be eliminated first?
- **Improve existing code quality** before building on top of it - don't accumulate technical debt
- **When adding features**: First ensure the foundation is solid, then build on it
- **Look for patterns**: If you're about to write similar code, check if existing code can be refactored to handle both cases

### Examples

```typescript
// ✅ Good: Review and fix existing code first, then extend
// Step 1: Found existing function with issues
async function getUserData(userId: string) {
  // Missing error handling, unclear return type, no validation
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
}

// Step 2: Fix the existing function first
async function fetchUserById(userId: string): Promise<User | null> {
  if (!userId || typeof userId !== "string") {
    throw new Error("Invalid user ID provided");
  }

  try {
    const response = await httpClient.get<UserResponse>(`/api/users/${userId}`);
    return response.data ?? null;
  } catch (error) {
    console.error(`Failed to fetch user ${userId}:`, error);
    return null;
  }
}

// Step 3: Now extend with new functionality using the fixed function
async function fetchUserWithProfile(
  userId: string
): Promise<UserWithProfile | null> {
  const user = await fetchUserById(userId);
  if (!user) return null;

  const profile = await fetchUserProfile(userId);
  return { ...user, profile };
}

// ❌ Bad: Adding new code without fixing existing issues
async function getUserData(userId: string) {
  // Existing broken code left as-is
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
}

// New function duplicates logic and doesn't fix the original
async function getUserDataWithErrorHandling(userId: string) {
  // Duplicated fetch logic instead of fixing the original
  try {
    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) throw new Error("Failed");
    return response.json();
  } catch (error) {
    // Now we have two similar functions with different behaviors
    return null;
  }
}
```

## 6. Root Cause Analysis & Clean Solutions

- **Always identify and fix the root cause** - not just the symptoms. When troubleshooting, dig deeper to understand WHY something is failing, not just WHAT is failing
- **Fix the design, not the symptoms**: Address the underlying architectural or design issue rather than patching surface-level problems
- **Remove broken approaches before trying new ones**: When an approach fails, do not layer fixes on top of flawed designs. Remove the broken code and implement a cleaner solution from scratch
- **Favor clarity and correctness over quick fixes**: Don't accumulate technical debt by piling workarounds on top of workarounds. A clean, well-designed solution is always preferable to multiple layers of fixes
- **Start fresh when needed**: If a solution approach isn't working, step back, remove the problematic code, and re-implement with a simpler, more maintainable design
- **Question the foundation**: If fixes keep accumulating, the underlying approach may be wrong - consider a different design pattern or architecture
- **Avoid entropy**: Each fix should reduce complexity, not increase it. If your fix adds more complexity, reconsider the approach

**Grounding:**
- **Clean Code (Robert C. Martin)**: Avoid "quick fixes" that increase entropy and make code harder to maintain
- **Refactoring (Martin Fowler)**: Fix the design, not behavior masking - address root causes rather than symptoms

### Examples

```typescript
// ❌ Bad: Fixing symptoms - layering fixes on top of broken design
// Problem: API calls are failing inconsistently
function fetchUserData(userId: string) {
  let retries = 0;
  while (retries < 3) {
    try {
      const response = fetch(`/api/users/${userId}`);
      if (!response.ok) {
        // Symptom fix: retry on error
        retries++;
        continue;
      }
      return response.json();
    } catch (error) {
      // More symptom fixes: add timeout
      setTimeout(() => {
        retries++;
      }, 1000);
    }
  }
  // Add error logging to "fix" the issue
  console.error("Failed after retries");
  return null;
}

// Still broken: Now we have multiple timeout handlers, unclear error states, etc.
// Root cause was never addressed: no proper error handling, no request cancellation, poor API design

// ✅ Good: Root cause analysis - identify WHY it's failing, fix the design
// Root cause identified: No proper HTTP client, no request cancellation, poor error handling
// Solution: Remove the broken approach, implement clean HTTP client abstraction

// Step 1: Remove the broken implementation entirely
// Step 2: Create a proper HTTP client with clean error handling
interface HttpClient {
  get<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>>;
}

class HttpClientImpl implements HttpClient {
  async get<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? 30000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      return { success: false, error: "Unknown error occurred" };
    }
  }
}

// Step 3: Use the clean implementation
const httpClient = new HttpClientImpl();

async function fetchUserData(userId: string): Promise<User | null> {
  const result = await httpClient.get<User>(`/api/users/${userId}`);
  if (!result.success) {
    // Proper error handling at the right level
    return null;
  }
  return result.data ?? null;
}

// Clean, maintainable, addresses root cause: proper abstraction, error handling, request cancellation
```

## 7. Algorithmic Optimization

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

### Examples

```typescript
// ✅ Good: O(n) time complexity using Set for O(1) lookups
function findDuplicateUserIds(userIds: string[]): string[] {
  const seenUserIds = new Set<string>();
  const duplicateUserIds: string[] = [];

  for (const userId of userIds) {
    if (seenUserIds.has(userId)) {
      duplicateUserIds.push(userId);
    } else {
      seenUserIds.add(userId);
    }
  }

  return duplicateUserIds;
}

// ❌ Bad: O(n²) nested loop approach
function findDuplicateUserIds(userIds: string[]): string[] {
  const duplicateUserIds: string[] = [];

  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      if (userIds[i] === userIds[j]) {
        duplicateUserIds.push(userIds[i]);
      }
    }
  }

  return duplicateUserIds;
}
```

## 8. Single Source of Truth & Configuration Management

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
- **Examples of what to centralize**:
  - Model names (e.g., default LLM model, fallback models)
  - API endpoints and base URLs
  - Timeout values and retry limits
  - Feature flags and toggles
  - Default values and constants
  - Business rules and thresholds
  - Error messages and user-facing strings (consider i18n)
- **Shared utilities for cross-cutting concerns**: When logic is used in multiple places (even if slightly different), extract it into shared utilities to ensure consistency. Examples:
  - Viewport calculations and coordinate transformations (see `lib/utils/graph-viewport.ts`)
  - Node dimensions and positioning logic
  - Common calculations or transformations used across hooks/components
  - **Before writing similar logic in multiple places**: Check if shared utilities exist, and if not, create them in `/lib/utils/` with descriptive names
  - **When fixing bugs in shared logic**: Update the shared utility, not individual implementations - this fixes the bug everywhere at once

### Examples

```typescript
// ✅ Good: Configuration centralized in one place
// lib/config/models.ts
export const DEFAULT_WEB_SEARCH_MODEL = "gpt-4o" as const;
export const DEFAULT_CHAT_MODEL = "gpt-4o" as const;
export const FALLBACK_MODEL = "gpt-3.5-turbo" as const;

export const MODEL_CONFIG = {
  webSearch: DEFAULT_WEB_SEARCH_MODEL,
  chat: DEFAULT_CHAT_MODEL,
  fallback: FALLBACK_MODEL,
} as const;

// ✅ Good: Using centralized configuration
// lib/services/web-search.ts
import { MODEL_CONFIG } from "@/lib/config/models";

async function performWebSearch(query: string) {
  const response = await fetch("/api/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      model: MODEL_CONFIG.webSearch, // Single source of truth
    }),
  });
  return response.json();
}

// ❌ Bad: Configuration scattered throughout codebase
// Multiple files with hardcoded values

// file1.ts
async function performWebSearch(query: string) {
  const response = await fetch("/api/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      model: "gpt-4o", // Hardcoded - would need to change in multiple places
    }),
  });
  return response.json();
}
```


