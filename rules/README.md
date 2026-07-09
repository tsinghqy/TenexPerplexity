# Cursor Rules Directory

This directory contains project-specific rules and guidelines that guide the AI assistant's behavior when working with this codebase.

## What is the `.cursor` Directory?

The `.cursor` directory is a workspace scaffold for the Cursor editor that maintains context and configuration settings to enhance your development workflow. The `rules/` subdirectory houses project-specific guidelines and rules that guide the AI's behavior and interactions with your codebase.

### Key Purposes of `.cursor` Directory:

1. **Context Management**: Stores metadata and configuration files that help Cursor maintain context about your project, enabling features like code indexing and intelligent code suggestions.

2. **Customization**: By defining rules within the `rules/` subdirectory, you can customize the AI's behavior to align with your project's coding standards, architectural patterns, and specific workflows.

3. **Consistency Across Projects**: The `.cursor` directory allows for consistent application of rules and settings across different projects, facilitating a standardized development experience.

4. **Version Control**: These rules are part of your project and should be committed to version control, ensuring that rules are shared among team members and maintained consistently across different environments.

## Rules Organization

This rules directory is organized into focused, maintainable files:

- **`core-principles.md`** - Foundational development principles: naming conventions, DRY, abstractions, fix-before-add, root cause analysis, optimization, single source of truth
- **`code-structure.md`** - Code organization, file structure, function structure (Clean Code principles), complexity reduction, error handling
- **`typescript.md`** - TypeScript-specific guidelines: type safety, type definitions, best practices
- **`react-nextjs.md`** - React/Next.js guidelines: components, hooks, API routes, mobile responsiveness
- **`code-review-checklist.md`** - Comprehensive checklist for code reviews and quality assurance
- **`memory-bank.md`** - Guidelines for creating and maintaining project documentation in the memory bank

## Best Practices

Following Cursor's recommended best practices:

1. **Modular Organization**: Each rule file focuses on a specific aspect of development, making it easier to maintain and update
2. **Focused and Concise**: Rules are kept focused and actionable (ideally under 500 lines per file)
3. **Clear and Descriptive**: File names clearly indicate their purpose
4. **Version Controlled**: All rules are committed to version control for team consistency
5. **Living Documentation**: Rules are updated as the project evolves and best practices are refined

## Usage

Cursor automatically reads all `.md` files in the `rules/` directory when providing AI assistance. The AI assistant will reference these rules when:

- Generating code
- Refactoring existing code
- Answering questions about code structure
- Making recommendations for improvements
- Reviewing code changes

## Adding New Rules

When adding new rules:

1. Determine if they belong in an existing file or warrant a new file
2. Keep files focused - if a file exceeds 500 lines, consider splitting it
3. Use clear, descriptive file names
4. Include examples when helpful
5. Update this README if adding new rule files

## Migration from `.cursorrules`

This rules directory structure replaces the previous single `.cursorrules` file. The single file has been split into focused modules for better organization and maintainability. If you have a `.cursorrules` file, you can safely remove it after migrating to this structure.


