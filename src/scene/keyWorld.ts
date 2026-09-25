import { KEY_COUNT } from '../music/layout'

export const keyWorldX = new Float32Array(KEY_COUNT)
export const keyWorldY = new Float32Array(KEY_COUNT)
export const keyWorldZ = new Float32Array(KEY_COUNT)

let count = 0

export function setKeyWorldCount(next: number): void {
  count = next
}

export function keyWorldCount(): number {
  return count
}
