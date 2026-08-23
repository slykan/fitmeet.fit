const ACTION_SOUND_URLS = [
  '/sounds/applause.mp3',
  '/sounds/ber_can.mp3',
  '/sounds/bike_bell.mp3',
  '/sounds/bike_wheel.mp3',
  '/sounds/bottle_cheers.mp3',
  '/sounds/bottle_open.mp3',
]

let currentActionSound: HTMLAudioElement | null = null

function playSound(source: string) {
  if (typeof window === 'undefined') return

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

export function playRandomActionSound() {
  const source = ACTION_SOUND_URLS[Math.floor(Math.random() * ACTION_SOUND_URLS.length)]
  playSound(source)
}

export function playApplauseSound() {
  playSound('/sounds/applause.mp3')
}
