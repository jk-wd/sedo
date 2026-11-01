declare global {
  var sedoOnReply: (id: string, value: unknown) => void
}

export type StartSettings = {
  recommendationFeed: {
    enabled: boolean
    youtube: boolean
  }
  shortFormVideo: {
    enabled: boolean
  }
  endlessScroll: {
    enabled: boolean
    limit: number
  }
}

export const endlessScrollLimits = [0, 1, 2, 3, 4, 5]
const defaultEndlessScrollLimit = 3

export const defaultSettings: StartSettings = {
  recommendationFeed: {
    enabled: true,
    youtube: true,
  },
  shortFormVideo: {
    enabled: true,
  },
  endlessScroll: {
    enabled: true,
    limit: defaultEndlessScrollLimit,
  },
}

const storageKey = 'sedo-start-settings'

type ChromeSend = (message: string, args: unknown[]) => void

const pending = new Map<string, (value: StartSettings) => void>()
let nextId = 0

function chromeSend(): ChromeSend | null {
  const chromeObject = (globalThis as { chrome?: { send?: ChromeSend } }).chrome
  return chromeObject?.send ?? null
}

export function runningInBrowser(): boolean {
  return chromeSend() !== null
}

function normalize(value: unknown): StartSettings {
  const record = value as {
    recommendationFeed?: { enabled?: unknown; youtube?: unknown }
    shortFormVideo?: { enabled?: unknown }
    endlessScroll?: { enabled?: unknown; limit?: unknown }
  } | null
  const feed = record?.recommendationFeed
  const limit = record?.endlessScroll?.limit
  return {
    recommendationFeed: {
      enabled: feed?.enabled !== false,
      youtube: feed?.youtube !== false,
    },
    shortFormVideo: {
      enabled: record?.shortFormVideo?.enabled !== false,
    },
    endlessScroll: {
      enabled: record?.endlessScroll?.enabled !== false,
      limit:
        typeof limit === 'number' && endlessScrollLimits.includes(limit)
          ? limit
          : defaultEndlessScrollLimit,
    },
  }
}

globalThis.sedoOnReply = (id: string, value: unknown) => {
  const resolve = pending.get(id)
  pending.delete(id)
  resolve?.(normalize(value))
}

function request(message: string, payload?: StartSettings): Promise<StartSettings> {
  const send = chromeSend()
  if (!send) {
    return Promise.reject(new Error('missing browser bridge'))
  }
  return new Promise((resolve, reject) => {
    const id = String(++nextId)
    const timer = window.setTimeout(() => {
      pending.delete(id)
      reject(new Error('settings timed out'))
    }, 3000)
    pending.set(id, (value) => {
      window.clearTimeout(timer)
      resolve(value)
    })
    send(message, payload === undefined ? [id] : [id, payload])
  })
}

export function loadSettings(): Promise<StartSettings> {
  if (!runningInBrowser()) {
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      return Promise.resolve(defaultSettings)
    }
    try {
      return Promise.resolve(normalize(JSON.parse(raw)))
    } catch {
      return Promise.resolve(defaultSettings)
    }
  }
  return request('getSettings')
}

export function saveSettings(settings: StartSettings): Promise<StartSettings> {
  if (!runningInBrowser()) {
    localStorage.setItem(storageKey, JSON.stringify(settings))
    return Promise.resolve(settings)
  }
  return request('setSettings', settings)
}
