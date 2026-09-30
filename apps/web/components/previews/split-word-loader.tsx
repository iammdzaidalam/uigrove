'use client'

import Image from 'next/image'
import { useState } from 'react'
import { SplitWordLoader, splitWordLoaderDefaults } from '@uigrove/components/split-word-loader'

const images = ['/demo/knight.jpg', '/demo/horse.jpg', '/demo/bloom.jpg', '/demo/arches.jpg']
const hero = images[images.length - 1] ?? ''
const ease = 'cubic-bezier(0.76, 0, 0.24, 1)'
const nav = ['Work, Studio, Journal (12)', 'Get in touch']

function Rise({ text, shown, delay = 0 }: { text: string; shown: boolean; delay?: number }) {
  return (
    <span className="inline-flex overflow-hidden whitespace-pre" aria-label={text}>
      {Array.from(text).map((letter, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="inline-block motion-reduce:transition-none!"
          style={{
            transform: shown ? 'translate3d(0, 0, 0)' : 'translate3d(0, 105%, 0)',
            transition: shown ? `transform 0.61s ${ease} ${delay + i * 0.018}s` : 'none',
          }}
        >
          {letter}
        </span>
      ))}
    </span>
  )
}

export function SplitWordLoaderPreview({ values }: { values: Record<string, unknown> }) {
  const [playKey, setPlayKey] = useState(0)
  const [shown, setShown] = useState(false)
  const word = typeof values.word === 'string' ? values.word : splitWordLoaderDefaults.word
  const fontSize = typeof values.fontSize === 'number' ? values.fontSize : 14
  const replay = () => {
    setShown(false)
    setPlayKey((key) => key + 1)
  }
  return (
    <div className="absolute inset-0">
      <SplitWordLoader
        {...values}
        images={images}
        playKey={playKey}
        onComplete={() => setShown(true)}
        className="absolute inset-0"
      >
        <div className="absolute inset-0 overflow-hidden text-[#f5f5f7] [container-type:size]">
          <Image src={hero} alt="" fill unoptimized sizes="100vw" className="object-cover" />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4 text-[12px] font-medium">
            <Rise text={`${word} ©`} shown={shown} />
            <span className="hidden sm:inline-flex">
              <Rise text={nav[0] ?? ''} shown={shown} delay={0.08} />
            </span>
            <Rise text={nav[1] ?? ''} shown={shown} delay={0.16} />
          </div>
          <h2
            className="absolute bottom-[3cqh] left-4 leading-none font-medium tracking-[-0.02em]"
            style={{ fontSize: `${fontSize}cqw` }}
          >
            <Rise text={`${word} ©`} shown={shown} delay={0.04} />
          </h2>
        </div>
      </SplitWordLoader>
      <button
        type="button"
        onClick={replay}
        className="absolute right-4 bottom-4 z-20 rounded-full border border-[#f5f5f7]/20 bg-[#09090c] px-4 py-2 font-mono text-[11px] tracking-[0.08em] text-[#f5f5f7] uppercase transition-colors duration-200 hover:bg-[#1d1d1f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5f5f7]"
      >
        Replay
      </button>
    </div>
  )
}
