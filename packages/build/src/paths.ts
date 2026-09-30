import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export const packageDir = path.resolve(here, '..')
export const repoDir = path.resolve(packageDir, '..', '..')
export const componentsSrcDir = path.join(repoDir, 'packages', 'components', 'src')
export const webDir = path.join(repoDir, 'apps', 'web')
export const generatedDir = path.join(webDir, 'generated')
export const registryDir = path.join(webDir, 'public', 'r')
