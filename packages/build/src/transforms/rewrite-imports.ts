import { createProject } from '../project'

const rewrites: Record<string, string> = {
  '../lib/dot-canvas': '@/hooks/use-dot-canvas',
  '../lib/meta': '@/hooks/use-dot-canvas',
}

export function rewriteImports(name: string, code: string) {
  const file = createProject().createSourceFile(name, code)
  for (const declaration of file.getImportDeclarations()) {
    const target = rewrites[declaration.getModuleSpecifierValue()]
    if (target) declaration.setModuleSpecifier(target)
  }
  return file.getFullText()
}
