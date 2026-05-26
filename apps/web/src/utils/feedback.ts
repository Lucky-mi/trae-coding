function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}

function beep(frequencies: number[], duration = 0.08) {
  if (typeof window === 'undefined') return
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return

  const ctx = new AudioCtx()
  const now = ctx.currentTime

  frequencies.forEach((freq, index) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, now + index * duration)
    gain.gain.exponentialRampToValueAtTime(0.08, now + index * duration + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * duration + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + index * duration)
    osc.stop(now + index * duration + duration)
  })

  window.setTimeout(() => void ctx.close(), frequencies.length * duration * 1000 + 120)
}

export function playAchievementFeedback() {
  beep([660, 880, 990], 0.09)
  vibrate([40, 30, 60])
}

export function playEvolutionFeedback() {
  beep([392, 523, 659, 784], 0.11)
  vibrate([60, 40, 80])
}
