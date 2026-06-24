const ACTION_SOUND_URLS = [
  '/sounds/applause.mp3',
  '/sounds/ber_can.mp3',
  '/sounds/bike_bell.mp3',
  '/sounds/bike_wheel.mp3',
  '/sounds/bottle_cheers.mp3',
  '/sounds/bottle_open.mp3',
]

let currentActionSound: HTMLAudioElement | null = null

export function playRandomActionSound() {
  if (typeof window === 'undefined') return

  const source = ACTION_SOUND_URLS[Math.floor(Math.random() * ACTION_SOUND_URLS.length)]
  const audio = new Audio(source)
  audio.volume = 0.85

  currentActionSound?.pause()
  currentActionSound = audio

  audio.addEventListener('ended', () => {
    if (currentActionSound === audio) currentActionSound = null
  }, { once: true })

  audio.play().catch(() => {
    if (currentActionSound === audio) currentActionSound = null
  })
}
