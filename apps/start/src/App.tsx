import { useEffect, useState } from 'react'
import iconUrl from './assets/icon.png'
import facebookUrl from './assets/social/facebook.png'
import instagramUrl from './assets/social/instagram.png'
import linkedinUrl from './assets/social/linkedin.png'
import pinterestUrl from './assets/social/pinterest.png'
import redditUrl from './assets/social/reddit.png'
import snapchatUrl from './assets/social/snapchat.png'
import telegramUrl from './assets/social/telegram.png'
import tiktokUrl from './assets/social/tiktok.png'
import xUrl from './assets/social/x.png'
import youtubeUrl from './assets/social/youtube.png'
import {
  defaultSettings,
  endlessScrollLimits,
  loadSettings,
  runningInBrowser,
  saveSettings,
  type StartSettings,
} from './settings'

type View = 'home' | 'settings'

const socialApps = [
  { name: 'Facebook', icon: facebookUrl },
  { name: 'YouTube', icon: youtubeUrl },
  { name: 'Instagram', icon: instagramUrl },
  { name: 'TikTok', icon: tiktokUrl },
  { name: 'X', icon: xUrl },
  { name: 'Reddit', icon: redditUrl },
  { name: 'LinkedIn', icon: linkedinUrl },
  { name: 'Pinterest', icon: pinterestUrl },
  { name: 'Telegram', icon: telegramUrl },
  { name: 'Snapchat', icon: snapchatUrl },
] as const

function Home() {
  return (
    <>
      <section className="sponsors" aria-labelledby="sponsors-heading">
        <h1 id="sponsors-heading">Sedo is made possible by</h1>
        <ul>
          <li>Your logo here</li>
        </ul>
      </section>
      <section className="apps" aria-labelledby="apps-heading">
        <div className="apps-heading">
          <h2 id="apps-heading">My apps</h2>
          <button type="button" className="add-app">
            Add app
          </button>
        </div>
        <ul className="app-grid">
          {socialApps.map((app) => (
            <li key={app.name}>
              <span className="app-icon">
                <img src={app.icon} alt="" />
              </span>
              <span className="app-name">{app.name}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function Switch({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean
  label: string
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-thumb" />
    </button>
  )
}

function SettingsPanel() {
  const [settings, setSettings] = useState<StartSettings>(defaultSettings)
  const [ready, setReady] = useState(false)
  const [customize, setCustomize] = useState(false)
  const [notice, setNotice] = useState('')
  const inBrowser = runningInBrowser()

  useEffect(() => {
    let active = true
    loadSettings()
      .then((value) => {
        if (active) {
          setSettings(value)
        }
      })
      .catch(() => {
        if (active) {
          setNotice('The saved rules could not be read.')
        }
      })
      .finally(() => {
        if (active) {
          setReady(true)
        }
      })
    return () => {
      active = false
    }
  }, [])

  async function update(next: StartSettings) {
    const previous = settings
    setSettings(next)
    setNotice('')
    try {
      const saved = await saveSettings(next)
      setSettings(saved)
    } catch {
      setSettings(previous)
      setNotice('The switch was not saved.')
    }
  }

  const feed = settings.recommendationFeed
  const youtubeOn = feed.enabled && feed.youtube
  const shortFormOn = settings.shortFormVideo.enabled
  const endless = settings.endlessScroll

  return (
    <>
      <header>
        <h1>Rules that are on</h1>
      </header>
      <section className="rule" aria-busy={!ready}>
        <div className="rule-row">
          <div>
            <h2>Recommendation blocking</h2>
            <p>Hides recommendation feeds. The video you opened, search, and channel pages stay.</p>
          </div>
          <Switch
            checked={feed.enabled}
            label="Recommendation blocking"
            disabled={!ready}
            onChange={(enabled) => update({ ...settings, recommendationFeed: { ...feed, enabled } })}
          />
        </div>
        <button
          type="button"
          className="customize"
          aria-expanded={customize}
          onClick={() => setCustomize((open) => !open)}
        >
          Customize
        </button>
        {customize ? (
          <div className="platforms">
            <div className="rule-row">
              <div>
                <h3>YouTube</h3>
                <p>Home feed and the recommendations beside a video.</p>
              </div>
              <Switch
                checked={feed.youtube}
                label="YouTube recommendation blocking"
                disabled={!ready || !feed.enabled}
                onChange={(youtube) => update({ ...settings, recommendationFeed: { ...feed, youtube } })}
              />
            </div>
          </div>
        ) : null}
        <p className="status">
          {youtubeOn
            ? 'YouTube recommendations are blocked.'
            : 'YouTube recommendations are left in place.'}
        </p>
      </section>
      <section className="rule" aria-busy={!ready}>
        <div className="rule-row">
          <div>
            <h2>Short-form video blocking</h2>
            <p>
              On every site, a vertical video of 3 minutes or less is replaced by a black box. Landscape and longer videos play.
            </p>
          </div>
          <Switch
            checked={shortFormOn}
            label="Short-form video blocking"
            disabled={!ready}
            onChange={(enabled) => update({ ...settings, shortFormVideo: { enabled } })}
          />
        </div>
        <p className="status">
          {shortFormOn
            ? 'Short-form videos are blocked. Pages that are open change when you reload them.'
            : 'Short-form videos play. Pages that are open change when you reload them.'}
        </p>
      </section>
      <section className="rule" aria-busy={!ready}>
        <div className="rule-row">
          <div>
            <h2>Endless scroll limit</h2>
            <p>
              On every site, a feed that keeps loading as you scroll shows a counter. Each load is one scroll. After the limit, the feed stops where it ends.
            </p>
          </div>
          <Switch
            checked={endless.enabled}
            label="Endless scroll limit"
            disabled={!ready}
            onChange={(enabled) => update({ ...settings, endlessScroll: { ...endless, enabled } })}
          />
        </div>
        <div className="limit" role="radiogroup" aria-label="Scrolls before a feed stops">
          <span className="limit-label">Scrolls before a feed stops</span>
          <div className="limit-options">
            {endlessScrollLimits.map((limit) => (
              <button
                key={limit}
                type="button"
                role="radio"
                className="limit-option"
                aria-checked={endless.limit === limit}
                disabled={!ready || !endless.enabled}
                onClick={() => update({ ...settings, endlessScroll: { ...endless, limit } })}
              >
                {limit}
              </button>
            ))}
          </div>
        </div>
        <p className="status">
          {endless.enabled
            ? endless.limit === 0
              ? 'Feeds stop at their first load. Pages that are open change when you reload them.'
              : `Feeds stop after ${endless.limit} ${endless.limit === 1 ? 'scroll' : 'scrolls'}. Pages that are open change when you reload them.`
            : 'Feeds keep loading. Pages that are open change when you reload them.'}
        </p>
      </section>
      {notice ? <p className="notice">{notice}</p> : null}
      {inBrowser ? null : (
        <p className="preview">
          This preview keeps the switches in this browser tab. In Sedo they are saved with the browser, and the sites you open follow them.
        </p>
      )}
    </>
  )
}

export function App() {
  const [view, setView] = useState<View>('home')

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <button type="button" className="brand" onClick={() => setView('home')}>
            <img src={iconUrl} alt="" width={36} height={41} />
            <span>SEDO</span>
          </button>
          <nav className="menu" aria-label="Start page">
            <button
              type="button"
              aria-current={view === 'settings' ? 'page' : undefined}
              onClick={() => setView('settings')}
            >
              Settings
            </button>
          </nav>
        </div>
      </header>
      <main className={view}>{view === 'home' ? <Home /> : <SettingsPanel />}</main>
    </>
  )
}
