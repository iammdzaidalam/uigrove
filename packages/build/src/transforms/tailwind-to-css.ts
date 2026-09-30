import {
  Node,
  SyntaxKind,
  type ArrayLiteralExpression,
  type Expression,
  type JsxAttribute,
  type NoSubstitutionTemplateLiteral,
  type SourceFile,
  type StringLiteral,
} from 'ts-morph'
import { formatCode } from '../prettier'
import { createProject } from '../project'
import { compileUtilities } from './compile-css'

type Literal = StringLiteral | NoSubstitutionTemplateLiteral

export interface ExtractResult {
  code: string
  classes: Map<string, string[]>
}

export interface CssVariant {
  code: string
  css: string
}

export async function tailwindToCss(name: string, code: string, slug: string): Promise<CssVariant> {
  const extracted = extractTailwind(name, code, slug)
  const file = createProject().createSourceFile(name, extracted.code)
  addCssImport(file, `./${slug}.css`)
  return {
    code: await formatCode(file.getFullText(), 'typescript'),
    css: await compileUtilities(extracted.classes),
  }
}

export function extractTailwind(name: string, code: string, slug: string): ExtractResult {
  const file = createProject().createSourceFile(name, code)
  const classes = new Map<string, string[]>()
  const names = new ClassNames(slug, usedClassNames(file))
  for (const attribute of classNameAttributes(file)) {
    extractAttribute(attribute, names, classes)
    simplify(attribute)
  }
  return { code: file.getFullText(), classes }
}

function extractAttribute(
  attribute: JsxAttribute,
  names: ClassNames,
  classes: Map<string, string[]>,
) {
  const tag = tagOf(attribute)
  const literals = literalsIn(attribute)
  let elementClass = literals.flatMap(tokensOf).find(isOwnClass)
  const record = (name: string, utilities: string[]) => {
    classes.set(name, [...(classes.get(name) ?? []), ...utilities])
  }

  for (const literal of literals) {
    const tokens = tokensOf(literal)
    const own = tokens.filter(isOwnClass)
    const utilities = tokens.filter((token) => !isOwnClass(token))
    if (utilities.length === 0) continue

    const first = own[0]
    if (first) {
      elementClass ??= first
      record(elementClass, utilities)
      literal.setLiteralValue(own.join(' '))
      continue
    }

    if (!isRemovable(literal)) {
      const name = isDirectValue(literal) ? (elementClass ??= names.next(tag)) : names.next(tag)
      record(name, utilities)
      literal.setLiteralValue(name)
      continue
    }

    if (elementClass) {
      record(elementClass, utilities)
      removeLiteral(literal)
    } else {
      elementClass = names.next(tag)
      record(elementClass, utilities)
      literal.setLiteralValue(elementClass)
    }
  }
}

class ClassNames {
  private slug: string
  private used: Set<string>

  constructor(slug: string, used: Set<string>) {
    this.slug = slug
    this.used = used
  }

  next(tag: string) {
    const base = `uig-${this.slug}__${tag.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    let name = base
    for (let n = 2; this.used.has(name); n++) name = `${base}-${n}`
    this.used.add(name)
    return name
  }
}

function classNameAttributes(file: SourceFile) {
  return file
    .getDescendantsOfKind(SyntaxKind.JsxAttribute)
    .filter((attribute) => attribute.getNameNode().getText() === 'className')
}

function usedClassNames(file: SourceFile) {
  const used = new Set<string>()
  for (const attribute of classNameAttributes(file)) {
    for (const literal of literalsIn(attribute)) {
      for (const token of tokensOf(literal)) if (isOwnClass(token)) used.add(token)
    }
  }
  return used
}

function literalsIn(attribute: JsxAttribute): Literal[] {
  const literals: Literal[] = [
    ...attribute.getDescendantsOfKind(SyntaxKind.StringLiteral),
    ...attribute.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
  ]
  return literals.sort((a, b) => a.getStart() - b.getStart())
}

function tokensOf(literal: Literal) {
  return literal.getLiteralText().split(/\s+/).filter(Boolean)
}

function isOwnClass(token: string) {
  return token.startsWith('uig-')
}

function tagOf(attribute: JsxAttribute) {
  const element = attribute.getParentOrThrow().getParentOrThrow()
  if (Node.isJsxOpeningElement(element) || Node.isJsxSelfClosingElement(element)) {
    return element.getTagNameNode().getText()
  }
  return 'element'
}

function isDirectValue(literal: Literal) {
  const parent = literal.getParent()
  return Node.isJsxAttribute(parent) || Node.isJsxExpression(parent)
}

function isRemovable(literal: Literal) {
  const parent = literal.getParent()
  if (Node.isArrayLiteralExpression(parent)) return true
  return Node.isCallExpression(parent) && parent.getArguments().includes(literal)
}

function removeLiteral(literal: Literal) {
  const parent = literal.getParent()
  if (Node.isArrayLiteralExpression(parent)) parent.removeElement(literal)
  else if (Node.isCallExpression(parent)) parent.removeArgument(literal)
}

function simplify(attribute: JsxAttribute) {
  const initializer = attribute.getInitializer()
  if (!Node.isJsxExpression(initializer)) return
  const expression = initializer.getExpression()
  if (!expression) return
  const value = staticValue(expression)
  if (value !== undefined) attribute.setInitializer(`"${value}"`)
}

// A join over string literals only is a constant
function staticValue(expression: Expression): string | undefined {
  if (Node.isStringLiteral(expression) || Node.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.getLiteralText()
  }
  const joined = joinedArray(expression)
  if (!joined) return undefined
  const elements = joined.array.getElements()
  const literals = elements.filter(Node.isStringLiteral)
  if (literals.length !== elements.length) return undefined
  return literals.map((literal) => literal.getLiteralText()).join(joined.separator)
}

function joinedArray(
  expression: Expression,
): { array: ArrayLiteralExpression; separator: string } | undefined {
  if (!Node.isCallExpression(expression)) return undefined
  const callee = expression.getExpression()
  if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== 'join') return undefined
  const separator = expression.getArguments()[0]
  if (!Node.isStringLiteral(separator)) return undefined
  let node: Expression = callee.getExpression()
  while (Node.isCallExpression(node)) {
    const inner = node.getExpression()
    if (!Node.isPropertyAccessExpression(inner) || inner.getName() !== 'filter') return undefined
    node = inner.getExpression()
  }
  if (!Node.isArrayLiteralExpression(node)) return undefined
  return { array: node, separator: separator.getLiteralText() }
}

function addCssImport(file: SourceFile, specifier: string) {
  const first = file.getImportDeclarations()[0]
  const index = first ? first.getChildIndex() : directiveCount(file)
  file.insertImportDeclaration(index, { moduleSpecifier: specifier })
}

// Directives like 'use client' must stay on top
function directiveCount(file: SourceFile) {
  let count = 0
  for (const statement of file.getStatements()) {
    if (!Node.isExpressionStatement(statement)) break
    if (!Node.isStringLiteral(statement.getExpression())) break
    count++
  }
  return count
}
