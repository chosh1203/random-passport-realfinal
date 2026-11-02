/** One-shot flag so other pages can send the user straight into a new random journey. */
let pending = false

export function requestLaunch() {
  pending = true
}

export function consumeLaunch() {
  const p = pending
  pending = false
  return p
}
