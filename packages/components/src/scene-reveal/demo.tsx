export function SceneRevealDemoHero() {
  return (
    <div className="uig-scene-reveal__demo-hero relative h-full w-full overflow-hidden">
      <img
        src="/demo/arches.jpg"
        alt=""
        draggable={false}
        className="uig-scene-reveal__demo-image absolute inset-0 h-full w-full object-cover opacity-70"
      />
      <div className="uig-scene-reveal__demo-copy absolute inset-x-0 bottom-0 flex flex-col gap-4 p-[6%] pb-[max(6%,88px)]">
        <span className="uig-scene-reveal__demo-label text-[11px] tracking-[0.08em] uppercase opacity-55">
          Chapter one
        </span>
        <h2 className="uig-scene-reveal__demo-title max-w-[8em] text-[clamp(40px,9cqw,140px)] leading-[0.95] font-medium tracking-[-0.03em]">
          A new world of dots
        </h2>
      </div>
    </div>
  )
}

export function SceneRevealDemoNext() {
  return (
    <div className="uig-scene-reveal__demo-next relative h-full w-full overflow-hidden bg-[#09090c] text-[#f5f5f7]">
      <img
        src="/demo/knight.jpg"
        alt=""
        draggable={false}
        className="uig-scene-reveal__demo-image absolute inset-0 h-full w-full object-cover opacity-50"
      />
      <div className="uig-scene-reveal__demo-copy absolute inset-0 flex flex-col justify-end gap-4 p-[6%] pb-[max(6%,88px)]">
        <h2 className="uig-scene-reveal__demo-title text-[clamp(40px,12cqw,180px)] leading-[0.9] font-medium tracking-[-0.03em]">
          Undergrowth
        </h2>
        <p className="uig-scene-reveal__demo-text max-w-[34em] text-[clamp(14px,1.6cqw,20px)] leading-snug opacity-70">
          The grove keeps growing. Every component ships as source, installs with one command and
          runs on nothing but React.
        </p>
      </div>
    </div>
  )
}
