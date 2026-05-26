import { useEffect } from 'react'
import ExpPlant, { getPlantStageInfo } from './ExpPlant'
import { playEvolutionFeedback } from '../utils/feedback'

type EvolutionModalProps = {
  prevExp: number
  nextExp: number
}

export default function EvolutionModal({ prevExp, nextExp }: EvolutionModalProps) {
  const prevStage = getPlantStageInfo(prevExp)
  const nextStage = getPlantStageInfo(nextExp)

  useEffect(() => {
    playEvolutionFeedback()
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-black/45 backdrop-blur-sm">
      <div className="relative w-[min(92vw,760px)] overflow-hidden rounded-[2rem] border border-brand-400/20 bg-panel-950/95 p-6 shadow-[0_0_60px_rgba(168,85,247,0.25)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.18),transparent_50%)]" />
        <div className="relative">
          <div className="text-center">
            <div className="text-xs tracking-[0.2em] text-brand-200/70">EVOLUTION</div>
            <div className="mt-3 text-3xl font-bold text-white">植物进化完成</div>
            <div className="mt-2 text-sm text-white/65">
              你的知识植物从「{prevStage.name}」成长到了「{nextStage.name}」
            </div>
          </div>
          <div className="mt-8 grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
            <div className="scale-90 opacity-75">
              <ExpPlant exp={prevExp} />
            </div>
            <div className="flex justify-center">
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-brand-100 shadow-glow">
                升级
              </div>
            </div>
            <div className="animate-[pop_0.5s_ease-out_forwards]">
              <ExpPlant exp={nextExp} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
