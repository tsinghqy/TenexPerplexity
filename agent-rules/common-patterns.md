# Common Patterns

**When to use this file**: Refer to this file when implementing new features or working with existing code patterns.

## API Client Pattern

- **Use**: `httpClient` from `lib/api/client.ts`
- **Returns**: `ApiResponse<T>` with `success` and `data`/`error` structure
- **Purpose**: Consistent error handling and response typing

## Server Authentication

- **Pattern**: `createServerSupabaseClient()` in every API route
- **Purpose**: Ensures proper authentication and user isolation
- **Location**: API routes in `app/api/**/route.ts`

## Optimistic Updates

- **Pattern**: Use `temp-` prefix for temporary IDs
- **Flow**: Create with temp ID → Server response → Replace with real ID
- **Purpose**: Immediate UI feedback before server confirmation

## Position Updates

- **Pattern**: Debounced 500ms via `useDebouncedPositionUpdate`
- **Purpose**: Reduce API calls when dragging nodes
- **Why**: Position changes fire frequently during drag operations

## Viewport Utilities

- **Pattern**: Use `lib/utils/graph-viewport.ts` for all viewport calculations
- **Functions**: `getNodeDimensions`, etc.
- **Purpose**: Centralized viewport logic (single source of truth)

---

**See also**: `.cursorrules` for comprehensive patterns and best practices.
