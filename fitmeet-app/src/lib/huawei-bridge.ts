// Bridge for passing Huawei auth code from deep link back to connected-apps screen
let _callback: ((code: string) => void) | null = null

export function setHuaweiCodeCallback(fn: (code: string) => void) {
  _callback = fn
}

export function clearHuaweiCodeCallback() {
  _callback = null
}

export function dispatchHuaweiCode(code: string): boolean {
  if (_callback) {
    _callback(code)
    _callback = null
    return true
  }
  return false
}
