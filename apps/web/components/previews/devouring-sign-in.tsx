'use client'

import { DevouringSignIn } from '@uigrove/components/devouring-sign-in'

export function DevouringSignInPreview({ values }: { values: Record<string, unknown> }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-8">
      <DevouringSignIn {...values} className="max-w-[720px]" />
    </div>
  )
}
