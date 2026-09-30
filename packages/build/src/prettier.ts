import { readFile } from 'node:fs/promises'
import path from 'node:path'
import * as prettier from 'prettier'
import { repoDir } from './paths'

export type Parser = 'typescript' | 'babel' | 'css'

let options: Promise<prettier.Options> | undefined

function loadOptions() {
  options ??= readFile(path.join(repoDir, '.prettierrc'), 'utf8').then(
    (text) => JSON.parse(text) as prettier.Options,
  )
  return options
}

export async function formatCode(code: string, parser: Parser) {
  return prettier.format(code, { ...(await loadOptions()), parser })
}
