import { KEY_COUNT } from '../music/layout'

export const HAND_LEFT = 1
export const HAND_RIGHT = 2

export const pressSong = new Uint8Array(KEY_COUNT)
export const pressUser = new Uint8Array(KEY_COUNT)
export const pressHand = new Uint8Array(KEY_COUNT)
export const expectedMask = new Uint8Array(KEY_COUNT)
export const expectHand = new Uint8Array(KEY_COUNT)
export const noteGen = new Uint32Array(KEY_COUNT)

export function handCode(hand: 'left' | 'right'): number {
  return hand === 'left' ? HAND_LEFT : HAND_RIGHT
}

export function clearMasks(): void {
  pressSong.fill(0)
  pressUser.fill(0)
  pressHand.fill(0)
  expectedMask.fill(0)
  expectHand.fill(0)
}
