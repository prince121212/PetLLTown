import { FALLBACK_PET_MANIFEST, inferActionAnchors, type PetAction, type PetActionAnchor } from '../config/petManifest'

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

const DEFAULT_ACTIONS = FALLBACK_PET_MANIFEST.actions

export type PetActionIntent =
  | 'natural'
  | 'user_speak'
  | 'ai_reply'
  | 'touch'
  | 'sleep_enter'
  | 'sleep_exit'
  | 'awake_idle'
  | 'sleep_loop'
  | 'awake_listening'
  | 'awake_reply'

export interface PetActionResolution {
  action: PetAction
  requestedId: string
  fallbackChain: string[]
  resolvedBy: 'requested' | 'fallback' | 'anchor-fallback' | 'default'
}

function normalizeActionId(value: string): string {
  return String(value || '').trim().toLowerCase()
}

function actionId(action: PetAction | null | undefined): string | undefined {
  return action ? action.id : undefined
}

function getActionPool(actions?: PetAction[] | null): PetAction[] {
  const source = Array.isArray(actions) && actions.length ? actions : DEFAULT_ACTIONS
  return source.filter((action) => Boolean(action) && typeof action.id === 'string')
}

function isPlayableAction(action?: PetAction | null): action is PetAction {
  return Boolean(action && action.id && action.videoUrls && action.videoUrls.length && action.enabled !== false)
}

function getActionById(actions: PetAction[], actionId: string): PetAction | null {
  const normalized = normalizeActionId(actionId)
  return actions.find((action) => normalizeActionId(action.id) === normalized) || null
}

function getActionAnchor(action: PetAction | string | null | undefined): { start: PetActionAnchor; end: PetActionAnchor } {
  if (!action) return { start: 'awake', end: 'awake' }

  if (typeof action === 'string') {
    const anchors = inferActionAnchors(action)
    return { start: anchors.anchorStart, end: anchors.anchorEnd }
  }

  if (action.anchorStart && action.anchorEnd) {
    return { start: action.anchorStart, end: action.anchorEnd }
  }

  const anchors = inferActionAnchors(action.id)
  return { start: anchors.anchorStart, end: anchors.anchorEnd }
}

function isSleepTransition(actionId: string): boolean {
  const normalized = normalizeActionId(actionId)
  return normalized === 'transition-awake-to-sleep' || normalized === 'sleep-enter'
}

function isWakeTransition(actionId: string): boolean {
  const normalized = normalizeActionId(actionId)
  return normalized === 'sleep-exit' || normalized === 'transition-sleep-to-awake'
}

function pickFirstPlayable(actions: PetAction[], candidates: string[]): PetAction | null {
  for (const candidate of candidates) {
    const action = getActionById(actions, candidate)
    if (isPlayableAction(action)) return action
  }
  return null
}

function getAwakeNaturalCandidates(state: PetState): string[] {
  const mood = String(state.mood || '').trim()
  const energy = Number(state.energy || 0)

  if (mood.includes('困') || energy <= 30) {
    return ['awake-idle-tired', 'awake-idle-sad', 'awake-idle-normal', 'awake-look-around', 'awake-tilt']
  }
  if (mood.includes('兴奋') || mood.includes('开心') || energy >= 80) {
    return ['awake-idle-energetic', 'awake-idle-normal', 'awake-tail', 'awake-look-around', 'awake-scratch']
  }
  if (mood.includes('好奇') || mood.includes('温柔')) {
    return ['awake-idle-normal', 'awake-look-around', 'awake-tilt', 'awake-lick']
  }
  if (mood.includes('低') || mood.includes('难过') || mood.includes('委屈')) {
    return ['awake-idle-sad', 'awake-idle-normal', 'awake-look-around', 'awake-reply-sad']
  }
  return ['awake-idle-normal', 'awake-look-around', 'awake-tilt']
}

function getSleepNaturalCandidates(): string[] {
  return ['sleep-loop', 'sleep-ear-twitch', 'sleep-tail-twitch', 'sleep-exit']
}

function getReplyCandidates(emotion?: string): string[] {
  const normalized = String(emotion || '').trim().toLowerCase()
  if (normalized === 'happy' || normalized === 'excited' || normalized === 'positive') {
    return ['awake-reply-happy', 'awake-reply-normal', 'awake-listening']
  }
  if (normalized === 'shy' || normalized === 'comforted') {
    return ['awake-reply-shy', 'awake-reply-normal', 'awake-listening']
  }
  if (normalized === 'confused' || normalized === 'question' || normalized === 'unknown') {
    return ['awake-reply-confused', 'awake-tilt', 'awake-reply-normal', 'awake-listening']
  }
  if (normalized === 'sad' || normalized === 'sorry' || normalized === 'low') {
    return ['awake-reply-sad', 'awake-idle-sad', 'awake-reply-normal', 'awake-listening']
  }
  return ['awake-reply-normal', 'awake-listening']
}

function getListeningCandidates(): string[] {
  return ['awake-listening', 'awake-look-around', 'awake-tilt', 'awake-idle-normal']
}

function getTouchCandidates(): string[] {
  return ['awake-touch-petting', 'awake-tail', 'awake-reply-happy', 'awake-reply-normal', 'awake-idle-normal']
}

function getSleepEnterCandidates(): string[] {
  return ['transition-awake-to-sleep']
}

function getSleepExitCandidates(): string[] {
  return ['transition-sleep-to-awake']
}

function resolveSameAnchorFallback(actions: PetAction[], requestedId: string, state: PetState): PetAction | null {
  const normalized = normalizeActionId(requestedId)

  if (normalized.startsWith('awake-idle-')) {
    return pickFirstPlayable(actions, getAwakeNaturalCandidates(state))
  }

  if (normalized === 'awake-listening' || normalized === 'listening') {
    return pickFirstPlayable(actions, getListeningCandidates())
  }

  if (normalized.startsWith('awake-reply-') || normalized === 'reply') {
    return pickFirstPlayable(actions, ['awake-reply-normal', 'awake-listening', 'awake-idle-normal'])
  }

  if (normalized === 'awake-touch-petting' || normalized === 'touch-petting') {
    return pickFirstPlayable(actions, getTouchCandidates())
  }

  if (normalized === 'sleep-loop') {
    return pickFirstPlayable(actions, getSleepNaturalCandidates())
  }

  if (normalized === 'sleep-ear-twitch' || normalized === 'sleep-tail-twitch') {
    return pickFirstPlayable(actions, ['sleep-ear-twitch', 'sleep-tail-twitch', 'sleep-loop'])
  }

  if (normalized === 'transition-awake-to-sleep' || normalized === 'sleep-enter') {
    return pickFirstPlayable(actions, getSleepEnterCandidates())
  }

  if (normalized === 'transition-sleep-to-awake' || normalized === 'sleep-exit') {
    return pickFirstPlayable(actions, getSleepExitCandidates())
  }

  return pickFirstPlayable(actions, [requestedId, 'awake-idle-normal', 'sleep-loop', 'transition-sleep-to-awake'])
}

export function resolvePlayableAction(
  actions: PetAction[] | null | undefined,
  requestedId: string,
  state: PetState,
): PetActionResolution | null {
  const pool = getActionPool(actions)
  const normalized = normalizeActionId(requestedId)
  const direct = getActionById(pool, normalized)

  if (isPlayableAction(direct)) {
    return {
      action: direct,
      requestedId: normalized,
      fallbackChain: [normalized],
      resolvedBy: 'requested',
    }
  }

  const fallbackChain = buildActionFallbackChain(normalized, state)
  const fallback = pickFirstPlayable(pool, fallbackChain)

  if (fallback) {
    return {
      action: fallback,
      requestedId: normalized,
      fallbackChain,
      resolvedBy: fallback.id === normalized ? 'requested' : 'fallback',
    }
  }

  return null
}

function buildActionFallbackChain(requestedId: string, state: PetState): string[] {
  const normalized = normalizeActionId(requestedId)

  if (normalized.startsWith('awake-idle-')) {
    return Array.from(new Set([
      normalized,
      ...getAwakeNaturalCandidates(state),
      'awake-listening',
      'awake-look-around',
    ]))
  }

  if (normalized === 'awake-listening' || normalized === 'listening') {
    return Array.from(new Set([
      normalized,
      ...getListeningCandidates(),
      ...getAwakeNaturalCandidates(state),
    ]))
  }

  if (normalized.startsWith('awake-reply-') || normalized === 'reply') {
    return Array.from(new Set([
      normalized,
      ...getReplyCandidates(state.mood),
      ...getAwakeNaturalCandidates(state),
      'awake-listening',
    ]))
  }

  if (normalized === 'awake-touch-petting' || normalized === 'touch-petting') {
    return Array.from(new Set([
      normalized,
      ...getTouchCandidates(),
      ...getAwakeNaturalCandidates(state),
    ]))
  }

  if (normalized === 'sleep-loop') {
    return Array.from(new Set([
      normalized,
      ...getSleepNaturalCandidates(),
      'transition-sleep-to-awake',
    ]))
  }

  if (normalized === 'sleep-ear-twitch' || normalized === 'sleep-tail-twitch') {
    return Array.from(new Set([
      normalized,
      'sleep-tail-twitch',
      'sleep-ear-twitch',
      'sleep-loop',
    ]))
  }

  if (normalized === 'transition-awake-to-sleep' || normalized === 'sleep-enter') {
    return [normalized, 'transition-awake-to-sleep']
  }

  if (normalized === 'transition-sleep-to-awake' || normalized === 'sleep-exit') {
    return [normalized, 'transition-sleep-to-awake']
  }

  return Array.from(new Set([
    normalized,
    'awake-idle-normal',
    'awake-listening',
    'awake-reply-normal',
    'awake-touch-petting',
    'sleep-loop',
    'transition-sleep-to-awake',
  ]))
}

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

function decideNext(state: PetState, lastScene: string, actions: PetAction[] = DEFAULT_ACTIONS): string {
  const pool = getActionPool(actions)
  const normalizedLast = normalizeActionId(lastScene)
  const lastAction = getActionById(pool, normalizedLast)
  const lastAnchor = getActionAnchor(lastAction || normalizedLast).end

  if (isSleepTransition(normalizedLast)) {
    const resolved = resolveSameAnchorFallback(pool, 'sleep-loop', state)
    return resolved ? resolved.id : normalizedLast
  }

  if (isWakeTransition(normalizedLast)) {
    const resolved = resolveSameAnchorFallback(pool, 'awake-idle-normal', state)
    return resolved ? resolved.id : normalizedLast
  }

  if (lastAnchor === 'sleep') {
    if (state.sleepLoopCount < state.sleepTargetLoops) {
      const sleeping = resolveSameAnchorFallback(pool, 'sleep-loop', state)
      return sleeping ? sleeping.id : normalizedLast
    }
    const exitScene = pickFirstPlayable(pool, getSleepExitCandidates())
    return exitScene ? exitScene.id : (actionId(resolveSameAnchorFallback(pool, 'sleep-loop', state)) || normalizedLast)
  }

  if (normalizedLast === 'awake-listening' || normalizedLast === 'listening') {
    const reply = resolveSameAnchorFallback(pool, 'awake-reply-normal', state)
    return reply ? reply.id : normalizedLast
  }

  if (normalizedLast === 'awake-touch-petting' || normalizedLast === 'touch-petting') {
    const idle = resolveSameAnchorFallback(pool, 'awake-idle-normal', state)
    return idle ? idle.id : normalizedLast
  }

  if (state.energy < 20) {
    const enter = pickFirstPlayable(pool, getSleepEnterCandidates())
    return enter ? enter.id : (actionId(resolveSameAnchorFallback(pool, 'awake-idle-tired', state)) || normalizedLast)
  }

  const idle = resolveSameAnchorFallback(pool, 'awake-idle-normal', state)
  return idle ? idle.id : normalizedLast
}

function findPath(from: string, to: string, actions: PetAction[] = DEFAULT_ACTIONS): string[] {
  const pool = getActionPool(actions)
  const normalizedFrom = normalizeActionId(from)
  const normalizedTo = normalizeActionId(to)

  if (normalizedFrom === normalizedTo) return [normalizedTo]

  if (isSleepTransition(normalizedFrom)) {
    return [actionId(resolveSameAnchorFallback(pool, 'sleep-loop', createDefaultState())) || 'sleep-loop', normalizedTo]
  }

  if (isWakeTransition(normalizedFrom)) {
    return [actionId(resolveSameAnchorFallback(pool, 'awake-idle-normal', createDefaultState())) || 'awake-idle-normal', normalizedTo]
  }

  const fromAnchor = getActionAnchor(normalizedFrom).end
  const toAnchor = getActionAnchor(normalizedTo).start

  if (fromAnchor === toAnchor) return [normalizedTo]

  if (fromAnchor === 'awake' && toAnchor === 'sleep') {
    const transition = pickFirstPlayable(pool, getSleepEnterCandidates())
    return transition ? [transition.id, normalizedTo] : [normalizedFrom]
  }

  if (fromAnchor === 'sleep' && toAnchor === 'awake') {
    const transition = pickFirstPlayable(pool, getSleepExitCandidates())
    return transition ? [transition.id, normalizedTo] : [normalizedFrom]
  }

  return [normalizedTo]
}

export function buildQueue(state: PetState, currentPlaying: string | null, actions: PetAction[] = DEFAULT_ACTIONS): string[] {
  const pool = getActionPool(actions)
  const queue: string[] = []
  let s = { ...state }

  if (currentPlaying) {
    queue.push(currentPlaying)
  }

  while (queue.length < QUEUE_SIZE) {
    const last = queue[queue.length - 1] || 'idle'
    const next = decideNext(s, last, pool)

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

export function handleEvent(event: string, state: PetState, queue: string[], actions: PetAction[] = DEFAULT_ACTIONS): { state: PetState; queue: string[] } {
  let s = applyEvent(state, event)
  const playing = queue[0] || 'idle'

  let targetScene: string | null = null
  if (event === 'user_speak') targetScene = 'awake-listening'
  if (event === 'energy_low') targetScene = 'transition-awake-to-sleep'
  if (event === 'energy_full') targetScene = 'transition-sleep-to-awake'

  if (!targetScene) {
    return { state: s, queue }
  }

  const path = findPath(playing, targetScene, actions)
  const newQueue = [playing, ...path]

  if (targetScene === 'transition-awake-to-sleep' || targetScene === 'sleep-enter') {
    s = { ...s, sleepTargetLoops: randInt(2, 6), sleepLoopCount: 0 }
  }

  while (newQueue.length < QUEUE_SIZE) {
    const last = newQueue[newQueue.length - 1]
    const next = decideNext(s, last, actions)
    if (next === 'sleep-loop') {
      s = { ...s, sleepLoopCount: s.sleepLoopCount + 1 }
    }
    newQueue.push(next)
  }

  return { state: s, queue: newQueue.slice(0, QUEUE_SIZE) }
}

export function advanceQueue(state: PetState, queue: string[], actions: PetAction[] = DEFAULT_ACTIONS): { state: PetState; queue: string[]; next: string } {
  const next = queue.length > 0 ? queue[0] : 'idle'
  const remaining = queue.slice(1)
  let s = { ...state, currentScene: next }

  if (next === 'sleep-loop') {
    s.sleepLoopCount = s.sleepLoopCount + 1
  }
  if ((next === 'sleep-exit' || next === 'transition-sleep-to-awake' || next === 'idle' || next === 'awake-idle-normal') && (state.currentScene === 'sleep-loop' || state.currentScene === 'sleep-exit' || state.currentScene === 'transition-sleep-to-awake')) {
    s.sleepLoopCount = 0
    s.sleepTargetLoops = 0
  }

  while (remaining.length < QUEUE_SIZE) {
    const last = remaining[remaining.length - 1] || next
    const fill = decideNext(s, last, actions)
    if ((fill === 'sleep-enter' || fill === 'transition-awake-to-sleep') && s.sleepTargetLoops === 0) {
      s = { ...s, sleepTargetLoops: randInt(2, 6), sleepLoopCount: 0 }
    }
    if (fill === 'sleep-loop') {
      s = { ...s, sleepLoopCount: s.sleepLoopCount + 1 }
    }
    remaining.push(fill)
  }

  return { state: s, queue: remaining.slice(0, QUEUE_SIZE), next }
}

export function resolveAiReplyAction(state: PetState, emotion: string, actions: PetAction[] = DEFAULT_ACTIONS): string {
  const pool = getActionPool(actions)
  const resolved = resolveSameAnchorFallback(pool, getReplyCandidates(emotion)[0], state)
  return resolved ? resolved.id : 'awake-reply-normal'
}

export function resolveNextActionByIntent(state: PetState, queue: string[], intent: PetActionIntent, actions: PetAction[] = DEFAULT_ACTIONS, emotion = ''): { state: PetState; queue: string[] } {
  const pool = getActionPool(actions)
  const current = queue[0] || 'idle'
  const currentAnchor = getActionAnchor(getActionById(pool, current) || current).end

  const resolveTarget = (targetId: string): string | null => {
    const result = resolvePlayableAction(pool, targetId, state)
    return result ? result.action.id : null
  }

  let target: string | null = null
  let transition: string | null = null

  if (intent === 'user_speak' || intent === 'awake_listening') {
    target = resolveTarget('awake-listening')
  } else if (intent === 'touch') {
    target = resolveTarget('awake-touch-petting')
  } else if (intent === 'sleep_enter') {
    transition = actionId(pickFirstPlayable(pool, getSleepEnterCandidates())) || null
    target = transition || resolveTarget('awake-idle-tired') || resolveTarget('awake-idle-normal')
  } else if (intent === 'sleep_exit') {
    transition = actionId(pickFirstPlayable(pool, getSleepExitCandidates())) || null
    target = transition || resolveTarget('sleep-loop')
  } else if (intent === 'ai_reply') {
    target = resolveTarget(resolveAiReplyAction(state, emotion, pool))
  } else if (intent === 'awake_reply') {
    target = resolveTarget(resolveAiReplyAction(state, emotion, pool))
  } else if (intent === 'sleep_loop') {
    target = resolveTarget('sleep-loop')
  } else {
    target = resolveTarget(actionId(resolveSameAnchorFallback(pool, 'awake-idle-normal', state)) || 'awake-idle-normal')
  }

  if (!target) {
    return { state, queue }
  }

  const targetAnchor = getActionAnchor(getActionById(pool, target) || target).start
  const path: string[] = []

  if (currentAnchor === 'sleep' && targetAnchor === 'awake' && !isWakeTransition(current)) {
    const wake = pickFirstPlayable(pool, getSleepExitCandidates())
    if (wake) {
      path.push(wake.id)
    } else {
      const safeSleep = resolveSameAnchorFallback(pool, 'sleep-loop', state)
      return { state, queue: safeSleep ? [current, safeSleep.id] : queue }
    }
  }

  if (currentAnchor === 'awake' && targetAnchor === 'sleep' && !isSleepTransition(current)) {
    const sleep = pickFirstPlayable(pool, getSleepEnterCandidates())
    if (sleep) {
      path.push(sleep.id)
    } else {
      const safeAwake = resolveSameAnchorFallback(pool, 'awake-idle-tired', state)
      return { state, queue: safeAwake ? [current, safeAwake.id] : queue }
    }
  }

  const resolvedTarget = target
  if (resolvedTarget !== current) {
    path.push(resolvedTarget)
  }

  const nextQueue = [current, ...path]

  while (nextQueue.length < QUEUE_SIZE) {
    const last = nextQueue[nextQueue.length - 1]
    const fill = decideNext(state, last, pool)
    nextQueue.push(fill)
  }

  return { state, queue: nextQueue.slice(0, QUEUE_SIZE) }
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
