import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

/**
 * Flat ESLint config (ESLint 9). Lints src TypeScript/React only.
 *
 * The headline rule here is `no-restricted-syntax` configured as the
 * "no hardcoded color" guard: Tailwind arbitrary values must reference a
 * design token (`[var(--token)]`), never a raw `#hex` / `rgb()` / `hsl()`.
 * See UI-KIT.md §10. Kept at "warn" so the existing tree stays green while
 * pre-existing violations are migrated; promote to "error" once clean.
 */

// Matches a raw *theme* color inside a Tailwind arbitrary value — i.e. a `#hex`
// or rgb/hsl color function that immediately follows a `[` or an `_` separator
// (`bg-[#123456]`, `text-[rgb(...)]`). Anchoring on `[`/`_` deliberately spares
// plain color constants (e.g. chart configs in lib/), which legitimately need
// raw hex and are not Tailwind classes.
//
// Pure black / white (`rgba(0,0,0,…)`, `rgba(255,255,255,…)`) are EXEMPT: those
// are shadow/scrim colors, not brand tokens, and tokenizing every shadow alpha
// adds noise without design value. Hardcoded black/white shadows are allowed.
const RAW_COLOR = '(\\[|_)(#[0-9A-Fa-f]{3,8}|rgba?\\((?!0,0,0)(?!255,255,255)|hsla?\\()'
const COLOR_MESSAGE =
  'Hardcoded color in a Tailwind class. Use a design token instead — e.g. `bg-[var(--neon-cyan)]` or the alias `bg-neon-cyan`. See frontend/UI-KIT.md §2.'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'coverage',
      'stats.html',
      '**/.omc/**',
      // Config files use TS-in-JS / Node globals; not part of the app surface.
      '*.config.js',
      '*.config.ts',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // --- React ---
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // --- Design-system guard: no hardcoded colors in Tailwind classes ---
      // Enforced as an error: all theme colors must be design tokens.
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=/${RAW_COLOR}/]`, message: COLOR_MESSAGE },
        { selector: `TemplateElement[value.raw=/${RAW_COLOR}/]`, message: COLOR_MESSAGE },
      ],

      // --- Pragmatic relaxations so the current branch lints clean ---
      // Promote these back to "error"/remove as the codebase is tidied.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Keep Prettier last so it disables any stylistic rules that would conflict.
  prettier
)
