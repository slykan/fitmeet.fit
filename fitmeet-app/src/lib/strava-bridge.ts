// Bridge for passing Strava auth code from deep link back to StravaRoutePicker
let _callback: ((code: string) => void) | null = null

export function setStravaCodeCallback(fn: (code: string) => void) {
  _callback = fn
}

export function clearStravaCodeCallback() {
  _callback = null
}

export function dispatchStravaCode(code: string): boolean {
  if (_callback) {
    _callback(code)
    _callback = null
    return true
  }
  return false
}
