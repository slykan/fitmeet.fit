import { Audio } from 'expo-av'

const ACTION_SOUNDS = [
  require('../../assets/sounds/applause.mp3'),
  require('../../assets/sounds/ber_can.mp3'),
  require('../../assets/sounds/bike_bell.mp3'),
  require('../../assets/sounds/bike_wheel.mp3'),
  require('../../assets/sounds/bottle_cheers.mp3'),
  require('../../assets/sounds/bottle_open.mp3'),
]

const APPLAUSE_SOUND = require('../../assets/sounds/applause.mp3')

let currentSound: Audio.Sound | null = null

async function playSound(source: number) {
  try {
    if (currentSound) {
      await currentSound.stopAsync().catch(() => {})
      await currentSound.unloadAsync().catch(() => {})
      currentSound = null
    }

    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
    const { sound } = await Audio.Sound.createAsync(source, {
      shouldPlay: true,
      volume: 0.85,
    })

    currentSound = sound
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded || !status.didJustFinish) return
      sound.unloadAsync().catch(() => {})
      if (currentSound === sound) currentSound = null
    })
  } catch {
    currentSound = null
  }
}

export async function playRandomActionSound() {
  const source = ACTION_SOUNDS[Math.floor(Math.random() * ACTION_SOUNDS.length)]
  await playSound(source)
}

export async function playApplauseSound() {
  await playSound(APPLAUSE_SOUND)
}
