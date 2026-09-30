import { contact } from '@/lib/contact'
import { CopyButton } from '../copy-button'

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 17 17 7M8 7h9v9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Contact() {
  const second = contact.x
    ? {
        label: 'Or start a conversation on X',
        text: `@${contact.x}`,
        href: `https://x.com/${contact.x}`,
      }
    : {
        label: 'Or find me on GitHub',
        text: `@${contact.github}`,
        href: `https://github.com/${contact.github}`,
      }

  return (
    <section
      aria-labelledby="custom-work-title"
      className="mx-auto w-full max-w-[1280px] px-4 pt-8 pb-28 sm:px-6"
    >
      <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-20">
        <div className="max-w-lg">
          <h2
            id="custom-work-title"
            className="text-[32px] leading-[1.04] font-medium tracking-[-0.055em] text-balance sm:text-[44px]"
          >
            Need something custom?
            <br />
            Let’s grow it.
          </h2>
          <p className="mt-5 max-w-sm text-[16px] leading-7 text-pretty text-muted">
            Bespoke components, landing pages and the small interactions that make a product feel
            alive.
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex items-end gap-3 border-b border-line pb-6">
            <a
              href={`mailto:${contact.email}?subject=Custom%20work`}
              className="group min-w-0 flex-1 rounded-sm pb-2"
            >
              <span className="mb-3 block text-[14px] text-muted">Tell me about your project</span>
              <span className="flex items-center gap-3 text-[16px] font-medium tracking-[-0.025em] transition-ui group-hover:opacity-70 sm:text-[20px]">
                <span className="min-w-0 break-words">{contact.email}</span>
                <Arrow />
              </span>
            </a>
            <CopyButton text={contact.email} />
          </div>
          <a
            href={second.href}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center justify-between gap-4 pt-6 text-[14px]"
          >
            <span className="text-muted">{second.label}</span>
            <span className="flex items-center gap-2 font-medium transition-ui group-hover:opacity-70">
              {second.text}
              <Arrow />
            </span>
          </a>
        </div>
      </div>
    </section>
  )
}
