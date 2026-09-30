import { createHighlighter, type Highlighter, type ThemeRegistration } from 'shiki'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

const dark: ThemeRegistration = {
  name: 'uigrove-dark',
  type: 'dark',
  colors: { 'editor.background': '#09090c', 'editor.foreground': '#f5f5f7' },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#6e6e73' } },
    { scope: ['string', 'string.template'], settings: { foreground: '#b6b6bb' } },
    {
      scope: ['constant.numeric', 'constant.language', 'constant.character'],
      settings: { foreground: '#d2d2d6' },
    },
    {
      scope: ['keyword', 'storage', 'storage.type', 'keyword.operator.new'],
      settings: { foreground: '#f5f5f7' },
    },
    {
      scope: ['keyword.operator', 'punctuation', 'meta.brace'],
      settings: { foreground: '#8a8a90' },
    },
    {
      scope: ['entity.name.function', 'support.function', 'meta.function-call'],
      settings: { foreground: '#ffffff' },
    },
    {
      scope: ['entity.name.type', 'support.type', 'entity.name.class', 'support.class'],
      settings: { foreground: '#d2d2d6' },
    },
    {
      scope: ['variable', 'variable.other', 'variable.parameter'],
      settings: { foreground: '#e6e6e9' },
    },
    {
      scope: ['variable.other.property', 'support.variable.property', 'meta.object-literal.key'],
      settings: { foreground: '#c9c9ce' },
    },
    { scope: ['entity.name.tag', 'support.class.component'], settings: { foreground: '#f5f5f7' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: '#a7a7ad' } },
    { scope: ['punctuation.definition.tag'], settings: { foreground: '#75757b' } },
    {
      scope: ['support.type.property-name.css', 'entity.name.tag.css'],
      settings: { foreground: '#e6e6e9' },
    },
    { scope: ['meta.directive', 'string.quoted.single.js'], settings: { foreground: '#b6b6bb' } },
  ],
}

const light: ThemeRegistration = {
  name: 'uigrove-light',
  type: 'light',
  colors: { 'editor.background': '#f5f5f7', 'editor.foreground': '#1d1d1f' },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#9a9aa0' } },
    { scope: ['string', 'string.template'], settings: { foreground: '#5c5c62' } },
    {
      scope: ['constant.numeric', 'constant.language', 'constant.character'],
      settings: { foreground: '#3a3a40' },
    },
    {
      scope: ['keyword', 'storage', 'storage.type', 'keyword.operator.new'],
      settings: { foreground: '#1d1d1f' },
    },
    {
      scope: ['keyword.operator', 'punctuation', 'meta.brace'],
      settings: { foreground: '#86868b' },
    },
    {
      scope: ['entity.name.function', 'support.function', 'meta.function-call'],
      settings: { foreground: '#000000' },
    },
    {
      scope: ['entity.name.type', 'support.type', 'entity.name.class', 'support.class'],
      settings: { foreground: '#3a3a40' },
    },
    {
      scope: ['variable', 'variable.other', 'variable.parameter'],
      settings: { foreground: '#2c2c30' },
    },
    {
      scope: ['variable.other.property', 'support.variable.property', 'meta.object-literal.key'],
      settings: { foreground: '#48484d' },
    },
    { scope: ['entity.name.tag', 'support.class.component'], settings: { foreground: '#1d1d1f' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: '#6a6a70' } },
    { scope: ['punctuation.definition.tag'], settings: { foreground: '#9a9aa0' } },
    {
      scope: ['support.type.property-name.css', 'entity.name.tag.css'],
      settings: { foreground: '#2c2c30' },
    },
    { scope: ['meta.directive', 'string.quoted.single.js'], settings: { foreground: '#5c5c62' } },
  ],
}

export type CodeLang = 'tsx' | 'ts' | 'jsx' | 'js' | 'css' | 'json' | 'bash'

const globalKey = '__uigroveHighlighter'
type Store = { [globalKey]?: Promise<Highlighter> }

// One highlighter per process, even across dev hot reloads
function getHighlighter() {
  const store = globalThis as Store
  store[globalKey] ??= createHighlighter({
    themes: [dark, light],
    langs: ['tsx', 'ts', 'jsx', 'js', 'css', 'json', 'bash'],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  })
  return store[globalKey]
}

function escapeHtml(code: string) {
  return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function highlight(code: string, lang: CodeLang) {
  try {
    const highlighter = await getHighlighter()
    return highlighter.codeToHtml(code, {
      lang,
      themes: { dark: 'uigrove-dark', light: 'uigrove-light' },
      defaultColor: false,
    })
  } catch {
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`
  }
}
