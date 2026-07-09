# TypeScript Guidelines

**When to use this file**: Refer to this file when working with TypeScript types, interfaces, type safety, and type definitions.

## Type Safety

- **Always use explicit types** for function parameters and return values
- **Avoid `any`** - use `unknown` if type is truly unknown, then narrow it
- **Use type guards** for runtime type checking
- **Prefer interfaces over type aliases** for object shapes (unless you need unions/intersections)
- **Use discriminated unions** for state machines or variant types
- **Export types/interfaces** that are used across modules

## Type Definitions

- **Name types descriptively**: `UserAuthenticationResponse` not `Response`
- **Use generic types** when appropriate: `ApiResponse<T>`, `PaginatedResult<T>`
- **Create type aliases** for complex types used multiple times
- **Use `const` assertions** for literal types when appropriate

---

**See also**: `agent-rules/code-style.md` for general naming conventions that apply to types.
