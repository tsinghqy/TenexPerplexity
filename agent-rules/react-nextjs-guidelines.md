# React/Next.js Guidelines

**When to use this file**: Refer to this file when working with React components, hooks, API routes, or mobile responsiveness. For performance optimization, see `react-best-practices.md`.

## Components

- **Use descriptive component names**: `UserProfileCard` not `Card`, `ChatMessageBubble` not `Bubble`
- **Extract props interfaces** with descriptive names: `ChatInputProps`, `UserProfileCardProps`
- **Keep components focused** - if a component exceeds 200 lines, consider splitting it
- **Use composition** - prefer children props and render props over prop drilling
- **Extract complex logic** into custom hooks
- **Use meaningful prop names**: `onMessageSend` not `onClick`, `isLoading` not `loading`

## Hooks

- **Name hooks with `use` prefix**: `useUserAuthentication`, `useChatMessages`
- **Return descriptive objects** from hooks: `{ user, isLoading, error }` not `{ data, loading, err }`
- **Extract hook logic** when it's reused or complex
- **Keep hooks focused** on a single concern

## API Routes

- **Use descriptive route handlers**: `handleGetUserProfile`, `handleCreateChatMessage`
- **Extract business logic** from route handlers into service functions
- **Use consistent error handling** across all routes
- **Return typed responses** using shared response types
- **Validate input** using Zod or similar validation libraries

## Mobile Responsiveness

- **ALL UI changes must be mobile responsive** - test on mobile viewports (320px - 768px)
- **Mobile-first approach**: Design for mobile first, then enhance for larger screens
- **Use Tailwind responsive breakpoints**: `sm:`, `md:`, `lg:`, `xl:`, `2xl:` for progressive enhancement
- **Test touch targets**: Ensure interactive elements are at least 44x44px on mobile
- **Responsive typography**: Use responsive text sizes (e.g., `text-sm md:text-base lg:text-lg`)
- **Flexible layouts**: Use `flex-col md:flex-row` for layouts that adapt to screen size
- **Responsive spacing**: Adjust padding/margins for mobile (e.g., `p-4 md:p-6 lg:p-8`)
- **Hide/show elements**: Use `hidden md:block` or `block md:hidden` for conditional visibility
- **Responsive grids**: Use `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` for adaptive grids
- **Mobile navigation**: Ensure navigation works on mobile (hamburger menus, bottom nav, etc.)
- **Touch-friendly inputs**: Ensure form inputs are properly sized and accessible on mobile
- **Horizontal scrolling**: Avoid horizontal scrolling on mobile - use vertical stacking instead
- **Viewport meta tag**: Ensure proper viewport configuration in layout files
- **Test on real devices**: When possible, test on actual mobile devices, not just browser dev tools

---

**See also**: 
- `agent-rules/react-best-practices.md` for React performance optimization
- `agent-rules/code-style.md` for general code style guidelines
- `memory-bank/mobile-responsiveness.md` for detailed mobile patterns
