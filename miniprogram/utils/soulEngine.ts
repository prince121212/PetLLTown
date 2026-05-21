export interface PetState {
  energy: number
  affection: number
  mood: string
  currentScene: string
  sleepLoopCount: number
  sleepTargetLoops: number
  lastInteractionAt: number
  consecutiveDays: number
  lastActiveDate: string
  updatedAt: number
}

const QUEUE_SIZE = 5

const IDLE_LIKE_SCENES = ['idle', 'listening', 'reply', 'sleep-exit']

export function createDefaultState(): PetState {
  return {
    energy: 80,
    affection: 50,
    mood: '开心',
    currentScene: 'idle',
    sleepLoopCount: 0,
    sleepTargetLoops: 0,
    lastInteractionAt: Date.now(),
    consecutiveDays: 1,
    lastActiveDate: todayStr(),
    updatedAt: Date.now(),
  }
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function getTimeOfDay(): string {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 9) return '早上'
  if (hour >= 9 && hour < 18) return '白天'
  if (hour >= 18 && hour < 22) return '晚上'
  return '深夜'
}

export function tick(state: PetState, elapsedSeconds: number): PetState {
  const s = { ...state }

  const timeOfDay = getTimeOfDay()
  let energyDecay = 0.012
  if (timeOfDay === '晚上') energyDecay = 0.018
  if (timeOfDay === '深夜') energyDecay = 0.025

  s.energy = clamp(s.energy - energyDecay * elapsedSeconds, 0, 100)

  const timeSinceInteraction = (Date.now() - s.lastInteractionAt) / 1000
  if (timeSinceInteraction > 300) {
    s.affection = clamp(s.affection - 0.005 * elapsedSeconds, 0, 100)
  }

  if (s.currentScene === 'sleep-loop') {
    s.energy = clamp(s.energy + 0.08 * elapsedSeconds, 0, 100)
  }

  s.updatedAt = Date.now()
  return s
}

export function moodToIcon(mood: string): string {
  switch (mood) {
    case '困了': return '😴'
    case '开心': return '😊'
    case '好奇': return '🤔'
    case '温柔': return '🥰'
    case '兴奋': return '✨'
    default: return '😊'
  }
}

export function applyEvent(state: PetState, event: string): PetState {
  const s = { ...state }
  s.lastInteractionAt = Date.now()

  switch (event) {
    case 'user_speak':
      s.affection = clamp(s.affection + 3, 0, 100)
      break
    case 'ai_replied':
      s.affection = clamp(s.affection + 2, 0, 100)
      break
    case 'user_returned':
      s.affection = clamp(s.affection + 5, 0, 100)
      break
  }

  s.updatedAt = Date.now()
  return s
}

export function setMood(state: PetState, mood: string): PetState {
  return { ...state, mood }
}

function isIdleLike(scene: string): boolean {
  return IDLE_LIKE_SCENES.includes(scene)
}

function decideNext(state: PetState, lastScene: string): string {
  if (lastScene === 'sleep-enter') return 'sleep-loop'

  if (lastScene === 'sleep-loop') {
    if (state.sleepLoopCount < state.sleepTargetLoops) return 'sleep-loop'
    return 'sleep-exit'
  }

  if (lastScene === 'listening') return 'reply'

  if (isIdleLike(lastScene)) {
    if (state.energy < 20) return 'sleep-enter'
    return 'idle'
  }

  return 'idle'
}

function findPath(from: string, to: string): string[] {
  if (isIdleLike(from)) return [to]

  if (from === 'sleep-loop') {
    if (to === 'sleep-loop' || to === 'sleep-exit') return [to]
    return ['sleep-exit', to]
  }

  if (from === 'sleep-enter') {
    return ['sleep-loop', 'sleep-exit', to]
  }

  return [to]
}

export function buildQueue(state: PetState, currentPlaying: string | null): string[] {
  const queue: string[] = []
  let s = { ...state }

  if (currentPlaying) {
    queue.push(currentPlaying)
  }

  while (queue.length < QUEUE_SIZE) {
    const last = queue[queue.length - 1] || 'idle'
    const next = decideNext(s, last)

    if (next === 'sleep-enter' && s.sleepTargetLoops === 0) {
      s = { ...s, sleepTargetLoops: randInt(2, 6), sleepLoopCount: 0 }
    }
    if (next === 'sleep-loop') {
      s = { ...s, sleepLoopCount: s.sleepLoopCount + 1 }
    }

    queue.push(next)
  }

  return queue
}

export function handleEvent(event: string, state: PetState, queue: string[]): { state: PetState; queue: string[] } {
  let s = applyEvent(state, event)
  const playing = queue[0] || 'idle'

  let targetScene: string | null = null
  if (event === 'user_speak') targetScene = 'listening'
  if (event === 'energy_low') targetScene = 'sleep-enter'
  if (event === 'energy_full') targetScene = 'sleep-exit'

  if (!targetScene) {
    return { state: s, queue }
  }

  const path = findPath(playing, targetScene)
  const newQueue = [playing, ...path]

  if (targetScene === 'sleep-enter') {
    s = { ...s, sleepTargetLoops: randInt(2, 6), sleepLoopCount: 0 }
  }

  while (newQueue.length < QUEUE_SIZE) {
    const last = newQueue[newQueue.length - 1]
    const next = decideNext(s, last)
    if (next === 'sleep-loop') {
      s = { ...s, sleepLoopCount: s.sleepLoopCount + 1 }
    }
    newQueue.push(next)
  }

  return { state: s, queue: newQueue.slice(0, QUEUE_SIZE) }
}

export function advanceQueue(state: PetState, queue: string[]): { state: PetState; queue: string[]; next: string } {
  const next = queue.length > 0 ? queue[0] : 'idle'
  const remaining = queue.slice(1)
  let s = { ...state, currentScene: next }

  if (next === 'sleep-loop') {
    s.sleepLoopCount = s.sleepLoopCount + 1
  }
  if ((next === 'sleep-exit' || next === 'idle') && (state.currentScene === 'sleep-loop' || state.currentScene === 'sleep-exit')) {
    s.sleepLoopCount = 0
    s.sleepTargetLoops = 0
  }

  while (remaining.length < QUEUE_SIZE) {
    const last = remaining[remaining.length - 1] || next
    const fill = decideNext(s, last)
    if (fill === 'sleep-enter' && s.sleepTargetLoops === 0) {
      s = { ...s, sleepTargetLoops: randInt(2, 6), sleepLoopCount: 0 }
    }
    if (fill === 'sleep-loop') {
      s = { ...s, sleepLoopCount: s.sleepLoopCount + 1 }
    }
    remaining.push(fill)
  }

  return { state: s, queue: remaining.slice(0, QUEUE_SIZE), next }
}

export function computeRelationship(consecutiveDays: number): { icon: string; text: string } {
  if (consecutiveDays >= 100) return { icon: '👑', text: `连续${consecutiveDays}天` }
  if (consecutiveDays >= 30) return { icon: '💎', text: `连续${consecutiveDays}天` }
  if (consecutiveDays >= 14) return { icon: '💫', text: `连续${consecutiveDays}天` }
  if (consecutiveDays >= 7) return { icon: '🔥🔥', text: `连续${consecutiveDays}天` }
  if (consecutiveDays >= 2) return { icon: '🔥', text: `连续${consecutiveDays}天` }
  return { icon: '🌱', text: '初见' }
}

export function updateConsecutiveDays(state: PetState): PetState {
  const s = { ...state }
  const today = todayStr()

  if (s.lastActiveDate === today) return s

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

  if (s.lastActiveDate === yStr) {
    s.consecutiveDays++
  } else {
    s.consecutiveDays = 1
  }

  s.lastActiveDate = today
  return s
}
