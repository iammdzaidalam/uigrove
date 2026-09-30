import path from 'node:path'
import { Node, type SourceFile } from 'ts-morph'
import { formatCode } from '../prettier'
import { createProject } from '../project'

export interface JsFile {
  name: string
  code: string
}

export async function tsToJs(name: string, code: string): Promise<JsFile> {
  const project = createProject()
  const source = project.createSourceFile(name, code)
  const emitted = project.emitToMemory({ targetSourceFile: source }).getFiles()[0]
  if (!emitted) throw new Error(`Nothing emitted for ${name}`)
  const jsName = path.basename(emitted.filePath)
  const output = createProject().createSourceFile(jsName, emitted.text)
  restoreBlankLines(source, output)
  return { name: jsName, code: await formatCode(output.getFullText(), 'babel') }
}

// The emitter drops blank lines, so match nodes by key
function restoreBlankLines(source: SourceFile, output: SourceFile) {
  const spaced = new Set<string>()
  for (const node of spaceable(source)) {
    if (hasBlankLineBefore(node)) spaced.add(keyOf(node))
  }
  for (const node of spaceable(output)) {
    if (spaced.has(keyOf(node))) node.prependWhitespace('\n')
  }
}

function spaceable(file: SourceFile) {
  return file.getDescendants().filter((node) => Node.isStatement(node) || isClassMember(node))
}

function isClassMember(node: Node) {
  return (
    Node.isPropertyDeclaration(node) ||
    Node.isMethodDeclaration(node) ||
    Node.isConstructorDeclaration(node) ||
    Node.isGetAccessorDeclaration(node) ||
    Node.isSetAccessorDeclaration(node)
  )
}

function hasBlankLineBefore(node: Node) {
  return node.getFullText().slice(0, node.getLeadingTriviaWidth()).includes('\n\n')
}

function keyOf(node: Node) {
  return `${scopeOf(node)} ${labelOf(node)}`
}

// Enclosing function and class names keep keys apart
function scopeOf(node: Node) {
  const names: string[] = []
  for (const ancestor of node.getAncestors()) {
    if (Node.isConstructorDeclaration(ancestor)) names.push('constructor')
    else if (Node.isArrowFunction(ancestor) || Node.isFunctionExpression(ancestor)) names.push('fn')
    else if (isNamed(ancestor)) names.push(ancestor.getName() ?? 'anonymous')
  }
  return names.join('/')
}

// Labels avoid type annotations so TS and JS nodes match
function labelOf(node: Node) {
  if (Node.isImportDeclaration(node)) return `import ${node.getModuleSpecifierValue()}`
  if (Node.isVariableStatement(node)) {
    const names = node.getDeclarations().map((declaration) => declaration.getName())
    return `variable ${names.join(' ')}`
  }
  if (Node.isExpressionStatement(node)) {
    const expression = node.getExpression()
    const target = Node.isCallExpression(expression) ? expression.getExpression() : expression
    return `expression ${collapse(target.getText())}`
  }
  if (Node.isConstructorDeclaration(node)) return 'constructor'
  if (isNamed(node)) return `${node.getKindName()} ${node.getName() ?? ''}`
  if (Node.isReturnStatement(node)) return 'return'
  if (Node.isIfStatement(node) || Node.isWhileStatement(node) || Node.isForOfStatement(node)) {
    return `${node.getKindName()} ${collapse(node.getExpression().getText())}`
  }
  return `${node.getKindName()} ${collapse(node.getText().split('{')[0] ?? '')}`
}

function isNamed(node: Node) {
  return (
    Node.isFunctionDeclaration(node) ||
    Node.isClassDeclaration(node) ||
    Node.isMethodDeclaration(node) ||
    Node.isPropertyDeclaration(node) ||
    Node.isGetAccessorDeclaration(node) ||
    Node.isSetAccessorDeclaration(node)
  )
}

function collapse(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}
