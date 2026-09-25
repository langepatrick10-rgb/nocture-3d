export const GOLD_HEX = '#e4c15c'
export const GOLD_LIT_HEX = '#ffe7a8'
export const LEFT_HEX = '#3d7dff'
export const LEFT_LIT_HEX = '#9ec2ff'
export const RIGHT_HEX = '#ff4a45'
export const RIGHT_LIT_HEX = '#ff9a8c'

export function noteFill(
  hand: 'left' | 'right',
  mode: 'gold' | 'hands',
  active: boolean,
): string {
  if (mode !== 'hands') return active ? GOLD_LIT_HEX : GOLD_HEX
  if (hand === 'left') return active ? LEFT_LIT_HEX : LEFT_HEX
  return active ? RIGHT_LIT_HEX : RIGHT_HEX
}
