import { Project, QuoteKind, ts } from 'ts-morph'

export function createProject() {
  return new Project({
    useInMemoryFileSystem: true,
    manipulationSettings: { quoteKind: QuoteKind.Single },
    compilerOptions: {
      jsx: ts.JsxEmit.Preserve,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      removeComments: false,
      declaration: false,
      isolatedModules: true,
    },
  })
}
