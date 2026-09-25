export interface Interval {
  begin: number
  end: number
}

/** Semi-CRF decode from TuesdayCrowd/audio-claudio SemiCrfViterbi (Unlicense). */
export function semiCrfDecode(
  score: Float32Array,
  t: number,
  nBatch: number,
  forcedStartPos: Int32Array | null = null,
): Interval[][] {
  if (t <= 0) throw new Error(`T must be positive, got ${t}.`)
  if (score.length !== t * t * nBatch) {
    throw new Error(`score has ${score.length} elements, expected ${t * t * nBatch}`)
  }

  const at = (e: number, b: number, k: number) => score[(e * t + b) * nBatch + k]

  const q = new Float32Array(t * nBatch)
  const ptrLen = (t - 1) * nBatch < 0 ? 0 : (t - 1) * nBatch
  const ptr = new Int32Array(ptrLen)

  for (let k = 0; k < nBatch; k++) {
    const d = at(t - 1, t - 1, k)
    q[(t - 1) * nBatch + k] = d > 0 ? d : 0
  }

  for (let i = 1; i < t; i++) {
    const begin = t - i - 1
    for (let k = 0; k < nBatch; k++) {
      let best = q[(t - i) * nBatch + k]
      let sel = 0
      for (let e = t - i; e < t; e++) {
        const cand = q[e * nBatch + k] + at(e, begin, k)
        const s = e - (t - i) + 1
        if (cand > best) {
          best = cand
          sel = s
        }
      }
      ptr[(i - 1) * nBatch + k] = sel - 1
      const diag = at(begin, begin, k)
      q[begin * nBatch + k] = best + (diag > 0 ? diag : 0)
    }
  }

  const result: Interval[][] = []
  for (let k = 0; k < nBatch; k++) {
    let j = forcedStartPos === null ? 0 : forcedStartPos[k]
    const intervals: Interval[] = []
    while (j < t - 1) {
      const curSel = ptr[(t - j - 2) * nBatch + k]
      if (at(j, j, k) > 0) intervals.push({ begin: j, end: j })
      if (curSel < 0) {
        j += 1
      } else {
        const e = curSel + j + 1
        intervals.push({ begin: j, end: e })
        j = e
      }
    }

    if (at(t - 1, t - 1, k) > 0) intervals.push({ begin: t - 1, end: t - 1 })
    result.push(intervals)
  }

  return result
}
