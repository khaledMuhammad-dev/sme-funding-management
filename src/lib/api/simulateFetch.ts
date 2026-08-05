/**
 * The demo's network. Adds believable latency so skeletons and pending states
 * are actually exercised — a demo that resolves instantly hides half the UI work.
 */

export interface SimulateOptions {
  delayMs?: number
  /** Kept at 0 for client demos; raise it locally to exercise error states. */
  failRate?: number
}

const DEFAULT_MIN = 380
const DEFAULT_MAX = 720

let tick = 0

/** Deterministic latency inside the documented range — no `Math.random()`. */
function nextDelay() {
  tick += 1
  const span = DEFAULT_MAX - DEFAULT_MIN
  return DEFAULT_MIN + ((tick * 137) % span)
}

export function simulateFetch<T>(data: T, opts: SimulateOptions = {}): Promise<T> {
  const { delayMs = nextDelay(), failRate = 0 } = opts

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (failRate > 0 && (tick % Math.round(1 / failRate)) === 0) {
        reject(new Error('SIMULATED_NETWORK_ERROR'))
        return
      }
      resolve(data)
    }, delayMs)
  })
}

/** Mutations feel snappier than reads — matches how real optimistic UIs behave. */
export function simulateMutation<T>(data: T): Promise<T> {
  return simulateFetch(data, { delayMs: 320 })
}
