/**
 * Paige Dark — Monaco Editor Theme
 * =================================
 * Warm syntax palette with terracotta (#d97757) as primary accent.
 * No cold hues (blues, cyans) for syntax tokens — all syntax colors
 * are warm earth tones derived from the Paige design system.
 *
 * Color mapping:
 *   Keywords     → terracotta  #d97757
 *   Strings      → warm green  #7d9c6f
 *   Numbers      → warm gold   #d4a843
 *   Functions    → warm cream  #e8e0d4
 *   Types        → warm peach  #c9a87c
 *   Variables    → light warm  #d5cec3
 *   Operators    → muted warm  #a89c8c
 *   Comments     → muted warm  #7a7568
 */

import type * as Monaco from 'monaco-editor';

/** Theme identifier registered with Monaco. Use this when setting the editor theme. */
export const PAIGE_DARK_THEME = 'paige-dark';

/* -------------------------------------------------------------------------- */
/*  Color constants (matching design-tokens.css)                               */
/* -------------------------------------------------------------------------- */

const COLORS = {
  /** Editor / inset background */
  editorBg: '#141413',
  /** Panel / surface background */
  surfaceBg: '#252523',
  /** Elevated surfaces (hover, active) */
  elevatedBg: '#30302e',
  /** Base app background */
  baseBg: '#1a1a18',

  /** Primary text (parchment white) */
  textPrimary: '#faf9f5',
  /** Secondary text (labels, metadata) */
  textSecondary: '#a8a69e',
  /** Muted text (disabled, subtle) */
  textMuted: '#6b6960',

  /** Terracotta accent */
  terracotta: '#d97757',
  /** Lighter terracotta */
  terracottaLight: '#e8956a',
  /** Darker terracotta */
  terracottaDeep: '#b85c3a',

  /** Warm green */
  green: '#7d9c6f',
  /** Warm gold */
  gold: '#d4a843',
  /** Warm peach */
  peach: '#c9a87c',
  /** Light warm */
  lightWarm: '#d5cec3',
  /** Muted warm (operators, punctuation) */
  mutedWarm: '#a89c8c',
  /** Comment color */
  comment: '#7a7568',
  /** Warm cream (functions) */
  warmCream: '#e8e0d4',

  /** Subtle border */
  borderSubtle: '#30302e',

  /** Status colors */
  error: '#e05252',
  warning: '#d4a843',
  success: '#7cb87c',

  /** Selection: terracotta at ~30% opacity */
  selectionBg: '#d9775740',
  /** Line highlight (very subtle warm) */
  lineHighlight: '#d977570a',
  /** Find match highlight */
  findMatchBg: '#d4a84340',
  /** Find match highlight (current) */
  findMatchCurrentBg: '#d4a84360',
} as const;

/* -------------------------------------------------------------------------- */
/*  Token rules                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Build the full set of token color rules for the theme.
 * Organized by semantic category, covering common tokens across
 * TypeScript, JavaScript, Python, Rust, Go, HTML, CSS, JSON, and Markdown.
 */
function buildTokenRules(): Monaco.editor.ITokenThemeRule[] {
  return [
    /* ── Comments ───────────────────────────────────────────────────── */
    { token: 'comment', foreground: COLORS.comment, fontStyle: 'italic' },
    { token: 'comment.block', foreground: COLORS.comment, fontStyle: 'italic' },
    { token: 'comment.line', foreground: COLORS.comment, fontStyle: 'italic' },
    { token: 'comment.block.documentation', foreground: COLORS.comment, fontStyle: 'italic' },

    /* ── Keywords & control flow ────────────────────────────────────── */
    { token: 'keyword', foreground: COLORS.terracotta },
    { token: 'keyword.control', foreground: COLORS.terracotta },
    { token: 'keyword.operator', foreground: COLORS.terracotta },
    { token: 'keyword.other', foreground: COLORS.terracotta },
    { token: 'keyword.control.flow', foreground: COLORS.terracotta },
    { token: 'keyword.control.import', foreground: COLORS.terracotta },
    { token: 'keyword.control.export', foreground: COLORS.terracotta },
    { token: 'keyword.control.from', foreground: COLORS.terracotta },
    { token: 'keyword.control.return', foreground: COLORS.terracotta },
    { token: 'keyword.control.conditional', foreground: COLORS.terracotta },
    { token: 'keyword.control.loop', foreground: COLORS.terracotta },

    /* ── Storage (let, const, var, function, class, interface, etc.) ─ */
    { token: 'storage', foreground: COLORS.terracotta },
    { token: 'storage.type', foreground: COLORS.terracotta },
    { token: 'storage.modifier', foreground: COLORS.terracotta },

    /* ── Strings ────────────────────────────────────────────────────── */
    { token: 'string', foreground: COLORS.green },
    { token: 'string.quoted', foreground: COLORS.green },
    { token: 'string.template', foreground: COLORS.green },
    { token: 'string.regexp', foreground: COLORS.terracottaLight },
    { token: 'string.escape', foreground: COLORS.terracottaLight },
    { token: 'string.quoted.single', foreground: COLORS.green },
    { token: 'string.quoted.double', foreground: COLORS.green },
    { token: 'string.quoted.template', foreground: COLORS.green },

    /* ── Numbers ────────────────────────────────────────────────────── */
    { token: 'number', foreground: COLORS.gold },
    { token: 'number.hex', foreground: COLORS.gold },
    { token: 'number.float', foreground: COLORS.gold },
    { token: 'number.binary', foreground: COLORS.gold },
    { token: 'number.octal', foreground: COLORS.gold },
    { token: 'constant.numeric', foreground: COLORS.gold },

    /* ── Constants & booleans ───────────────────────────────────────── */
    { token: 'constant', foreground: COLORS.gold },
    { token: 'constant.language', foreground: COLORS.gold },
    { token: 'constant.language.boolean', foreground: COLORS.gold },
    { token: 'constant.language.null', foreground: COLORS.gold },
    { token: 'constant.language.undefined', foreground: COLORS.gold },

    /* ── Functions ──────────────────────────────────────────────────── */
    { token: 'entity.name.function', foreground: COLORS.warmCream },
    { token: 'support.function', foreground: COLORS.warmCream },
    { token: 'meta.function-call', foreground: COLORS.warmCream },
    { token: 'function', foreground: COLORS.warmCream },
    { token: 'function.call', foreground: COLORS.warmCream },

    /* ── Types, classes, interfaces ─────────────────────────────────── */
    { token: 'entity.name.type', foreground: COLORS.peach },
    { token: 'entity.name.class', foreground: COLORS.peach },
    { token: 'support.type', foreground: COLORS.peach },
    { token: 'support.class', foreground: COLORS.peach },
    { token: 'type', foreground: COLORS.peach },
    { token: 'type.identifier', foreground: COLORS.peach },
    { token: 'class', foreground: COLORS.peach },
    { token: 'interface', foreground: COLORS.peach },
    { token: 'enum', foreground: COLORS.peach },
    { token: 'namespace', foreground: COLORS.peach },
    { token: 'struct', foreground: COLORS.peach },

    /* ── Variables ──────────────────────────────────────────────────── */
    { token: 'variable', foreground: COLORS.lightWarm },
    { token: 'variable.other', foreground: COLORS.lightWarm },
    { token: 'variable.parameter', foreground: COLORS.lightWarm },
    { token: 'variable.language', foreground: COLORS.terracotta },
    { token: 'variable.predefined', foreground: COLORS.lightWarm },
    { token: 'identifier', foreground: COLORS.lightWarm },

    /* ── Operators & punctuation ────────────────────────────────────── */
    { token: 'operator', foreground: COLORS.mutedWarm },
    { token: 'keyword.operator.assignment', foreground: COLORS.mutedWarm },
    { token: 'keyword.operator.arithmetic', foreground: COLORS.mutedWarm },
    { token: 'keyword.operator.comparison', foreground: COLORS.mutedWarm },
    { token: 'keyword.operator.logical', foreground: COLORS.mutedWarm },
    { token: 'delimiter', foreground: COLORS.mutedWarm },
    { token: 'delimiter.bracket', foreground: COLORS.mutedWarm },
    { token: 'delimiter.parenthesis', foreground: COLORS.mutedWarm },
    { token: 'delimiter.square', foreground: COLORS.mutedWarm },
    { token: 'delimiter.curly', foreground: COLORS.mutedWarm },
    { token: 'delimiter.angle', foreground: COLORS.mutedWarm },
    { token: 'punctuation', foreground: COLORS.mutedWarm },

    /* ── Tags (HTML / JSX) ──────────────────────────────────────────── */
    { token: 'tag', foreground: COLORS.terracotta },
    { token: 'tag.id.pug', foreground: COLORS.peach },
    { token: 'tag.class.pug', foreground: COLORS.peach },
    { token: 'metatag', foreground: COLORS.terracotta },
    { token: 'metatag.content', foreground: COLORS.green },
    { token: 'metatag.html', foreground: COLORS.terracotta },
    { token: 'metatag.xml', foreground: COLORS.terracotta },

    /* ── Attributes (HTML / JSX) ────────────────────────────────────── */
    { token: 'attribute.name', foreground: COLORS.peach },
    { token: 'attribute.value', foreground: COLORS.green },
    { token: 'attribute.value.html', foreground: COLORS.green },
    { token: 'attribute.value.xml', foreground: COLORS.green },

    /* ── CSS / SCSS ─────────────────────────────────────────────────── */
    { token: 'attribute.name.css', foreground: COLORS.peach },
    { token: 'attribute.value.css', foreground: COLORS.green },
    { token: 'attribute.value.number.css', foreground: COLORS.gold },
    { token: 'attribute.value.unit.css', foreground: COLORS.terracotta },
    { token: 'attribute.value.hex.css', foreground: COLORS.gold },
    { token: 'selector', foreground: COLORS.terracotta },
    { token: 'selector.class', foreground: COLORS.peach },
    { token: 'selector.id', foreground: COLORS.peach },
    { token: 'selector.tag', foreground: COLORS.terracotta },

    /* ── JSON ───────────────────────────────────────────────────────── */
    { token: 'string.key.json', foreground: COLORS.peach },
    { token: 'string.value.json', foreground: COLORS.green },
    { token: 'number.json', foreground: COLORS.gold },
    { token: 'keyword.json', foreground: COLORS.gold },

    /* ── Markdown ───────────────────────────────────────────────────── */
    { token: 'markup.heading', foreground: COLORS.terracotta, fontStyle: 'bold' },
    { token: 'markup.bold', foreground: COLORS.warmCream, fontStyle: 'bold' },
    { token: 'markup.italic', foreground: COLORS.warmCream, fontStyle: 'italic' },
    { token: 'markup.underline', foreground: COLORS.warmCream, fontStyle: 'underline' },
    { token: 'markup.inline.raw', foreground: COLORS.green },
    { token: 'markup.list', foreground: COLORS.lightWarm },

    /* ── Decorators / annotations ───────────────────────────────────── */
    { token: 'annotation', foreground: COLORS.peach },
    { token: 'meta.decorator', foreground: COLORS.peach },
    { token: 'tag.decorator.ts', foreground: COLORS.peach },
    { token: 'tag.decorator.js', foreground: COLORS.peach },

    /* ── Misc / fallback ────────────────────────────────────────────── */
    { token: 'meta', foreground: COLORS.lightWarm },
    { token: 'invalid', foreground: COLORS.error },
    { token: 'invalid.illegal', foreground: COLORS.error },
    { token: 'invalid.deprecated', foreground: COLORS.warning, fontStyle: 'strikethrough' },

    /* ── Default (empty token) ──────────────────────────────────────── */
    { token: '', foreground: COLORS.lightWarm },
  ];
}

/* -------------------------------------------------------------------------- */
/*  Editor chrome colors                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Build the editor UI (chrome) color overrides.
 * These control background, selection, gutter, widgets, etc.
 */
function buildEditorColors(): Monaco.editor.IColors {
  return {
    /* ── Editor core ──────────────────────────────────────────────── */
    'editor.background': COLORS.editorBg,
    'editor.foreground': COLORS.lightWarm,
    'editorCursor.foreground': COLORS.terracotta,
    'editor.selectionBackground': COLORS.selectionBg,
    'editor.inactiveSelectionBackground': '#d977572a',
    'editor.selectionHighlightBackground': '#d977571a',
    'editor.lineHighlightBackground': COLORS.lineHighlight,
    'editor.lineHighlightBorder': '#00000000',

    /* ── Find / replace ───────────────────────────────────────────── */
    'editor.findMatchBackground': COLORS.findMatchBg,
    'editor.findMatchHighlightBackground': COLORS.findMatchCurrentBg,
    'editor.findRangeHighlightBackground': '#d977570d',

    /* ── Word highlight ───────────────────────────────────────────── */
    'editor.wordHighlightBackground': '#d977571a',
    'editor.wordHighlightStrongBackground': '#d977572a',

    /* ── Gutter ───────────────────────────────────────────────────── */
    'editorLineNumber.foreground': COLORS.textMuted,
    'editorLineNumber.activeForeground': COLORS.textSecondary,
    'editorGutter.background': COLORS.editorBg,

    /* ── Indent guides ────────────────────────────────────────────── */
    'editorIndentGuide.background': COLORS.borderSubtle,
    'editorIndentGuide.activeBackground': COLORS.mutedWarm,

    /* ── Bracket matching ─────────────────────────────────────────── */
    'editorBracketMatch.background': '#d977572a',
    'editorBracketMatch.border': COLORS.terracotta,

    /* ── Bracket pair colorization (warm palette, no blues/cyans) ── */
    'editorBracketHighlight.foreground1': COLORS.terracotta,
    'editorBracketHighlight.foreground2': COLORS.gold,
    'editorBracketHighlight.foreground3': COLORS.peach,
    'editorBracketHighlight.foreground4': COLORS.green,
    'editorBracketHighlight.foreground5': COLORS.terracottaLight,
    'editorBracketHighlight.foreground6': COLORS.warmCream,

    /* ── Whitespace / ruler ───────────────────────────────────────── */
    'editorWhitespace.foreground': '#30302e60',
    'editorRuler.foreground': COLORS.borderSubtle,

    /* ── Scrollbar ────────────────────────────────────────────────── */
    'scrollbar.shadow': '#00000040',
    'scrollbarSlider.background': '#a89c8c20',
    'scrollbarSlider.hoverBackground': '#a89c8c40',
    'scrollbarSlider.activeBackground': '#a89c8c60',

    /* ── Widget (autocomplete, hover, peek) ───────────────────────── */
    'editorWidget.background': COLORS.surfaceBg,
    'editorWidget.foreground': COLORS.lightWarm,
    'editorWidget.border': COLORS.borderSubtle,
    'editorSuggestWidget.background': COLORS.surfaceBg,
    'editorSuggestWidget.border': COLORS.borderSubtle,
    'editorSuggestWidget.foreground': COLORS.lightWarm,
    'editorSuggestWidget.selectedBackground': COLORS.elevatedBg,
    'editorSuggestWidget.highlightForeground': COLORS.terracotta,
    'editorHoverWidget.background': COLORS.surfaceBg,
    'editorHoverWidget.border': COLORS.borderSubtle,
    'editorHoverWidget.foreground': COLORS.lightWarm,

    /* ── Peek view ────────────────────────────────────────────────── */
    'peekView.border': COLORS.terracotta,
    'peekViewEditor.background': COLORS.editorBg,
    'peekViewResult.background': COLORS.surfaceBg,
    'peekViewTitle.background': COLORS.surfaceBg,
    'peekViewTitleLabel.foreground': COLORS.warmCream,
    'peekViewTitleDescription.foreground': COLORS.textSecondary,
    'peekViewResult.matchHighlightBackground': COLORS.findMatchBg,

    /* ── Overview ruler (scrollbar decorations) ───────────────────── */
    'editorOverviewRuler.border': '#00000000',
    'editorOverviewRuler.findMatchForeground': COLORS.terracotta,
    'editorOverviewRuler.selectionHighlightForeground': '#d9775560',
    'editorOverviewRuler.errorForeground': COLORS.error,
    'editorOverviewRuler.warningForeground': COLORS.warning,

    /* ── Error / warning squiggles ────────────────────────────────── */
    'editorError.foreground': COLORS.error,
    'editorWarning.foreground': COLORS.warning,
    'editorInfo.foreground': COLORS.peach,

    /* ── Input (find widget, quick open) ──────────────────────────── */
    'input.background': COLORS.baseBg,
    'input.foreground': COLORS.lightWarm,
    'input.border': COLORS.borderSubtle,
    'input.placeholderForeground': COLORS.textMuted,
    'inputOption.activeBorder': COLORS.terracotta,
    'inputOption.activeBackground': '#d977572a',
    focusBorder: COLORS.terracotta,

    /* ── Diff editor ──────────────────────────────────────────────── */
    'diffEditor.insertedTextBackground': '#7d9c6f20',
    'diffEditor.removedTextBackground': '#e0525220',

    /* ── Minimap (disabled, but define just in case) ──────────────── */
    'minimap.background': COLORS.editorBg,
  };
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Register the "paige-dark" custom theme with a Monaco editor instance.
 *
 * Call this once during application initialization, before creating any
 * editor instances that use the theme.
 *
 * @example
 * ```ts
 * import { loader } from '@monaco-editor/react';
 * import { registerPaigeDarkTheme, PAIGE_DARK_THEME } from './utils/theme';
 *
 * loader.init().then((monaco) => {
 *   registerPaigeDarkTheme(monaco);
 * });
 *
 * // Then in your editor component:
 * <Editor theme={PAIGE_DARK_THEME} ... />
 * ```
 */
export function registerPaigeDarkTheme(monaco: typeof Monaco): void {
  monaco.editor.defineTheme(PAIGE_DARK_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: buildTokenRules(),
    colors: buildEditorColors(),
  });
}
