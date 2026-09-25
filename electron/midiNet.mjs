const MUTOPIA_SEARCH =
  'https://www.mutopiaproject.org/cgibin/make-table.cgi?Instrument=Piano&solo=1&searchingfor='
const BITMIDI_SEARCH = 'https://bitmidi.com/search?q='
const MAX_BYTES = 8 * 1024 * 1024
const HEADERS = {
  'User-Agent': 'Nocture3D/1.0 (personal library search)',
  Accept: 'text/html,application/octet-stream,*/*',
}

const ALLOWED_PREFIXES = [
  'https://www.mutopiaproject.org/ftp/',
  'https://mutopiaproject.org/ftp/',
  'https://bitmidi.com/uploads/',
]

export function isAllowedMidiUrl(url) {
  if (typeof url !== 'string') return false
  if (!url.endsWith('.mid') && !url.endsWith('.midi')) return false
  return ALLOWED_PREFIXES.some((prefix) => url.startsWith(prefix))
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseMutopia(html) {
  const chunks = html.split('class="table-bordered result-table"').slice(1)
  const hits = []
  for (const chunk of chunks) {
    const mid = chunk.match(/href="(https:\/\/(?:www\.)?mutopiaproject\.org\/ftp\/[^"]+\.mid)"/i)
    if (!mid) continue
    const cells = [...chunk.matchAll(/<td>([\s\S]*?)<\/td>/gi)].map((match) => stripTags(match[1]))
    const title = cells[0] || 'Untitled'
    const composer = (cells[1] || '')
      .replace(/^by\s+/i, '')
      .replace(/\s*\(.*$/, '')
      .trim()
    hits.push({
      title,
      composer: composer || 'Mutopia',
      source: 'mutopia',
      midiUrl: mid[1],
    })
  }
  return hits
}

function parseBitmidi(html) {
  const hits = []
  const seen = new Set()
  const pattern =
    /"name":"([^"]+)","slug":"([^"]+)"[\s\S]*?"downloadUrl":"(\/uploads\/\d+\.mid)"/g
  let match = pattern.exec(html)
  while (match) {
    const midiUrl = `https://bitmidi.com${match[3]}`
    if (!seen.has(midiUrl)) {
      seen.add(midiUrl)
      hits.push({
        title: match[1].replace(/\.mid$/i, '').replace(/[_]+/g, ' ').trim() || 'Untitled',
        composer: 'BitMidi',
        source: 'bitmidi',
        midiUrl,
      })
    }
    match = pattern.exec(html)
  }
  return hits
}

async function readText(url) {
  const response = await fetch(url, { headers: HEADERS })
  if (!response.ok) throw new Error(`Search failed (${response.status})`)
  return response.text()
}

export async function searchOnlineMidi(query) {
  const q = String(query ?? '')
    .trim()
    .slice(0, 80)
  if (q.length < 2) return []

  const encoded = encodeURIComponent(q)
  const [mutopia, bitmidi] = await Promise.allSettled([
    readText(`${MUTOPIA_SEARCH}${encoded}`).then(parseMutopia),
    readText(`${BITMIDI_SEARCH}${encoded}`).then(parseBitmidi),
  ])

  const hits = []
  if (mutopia.status === 'fulfilled') hits.push(...mutopia.value.slice(0, 10))
  if (bitmidi.status === 'fulfilled') hits.push(...bitmidi.value.slice(0, 12))

  const seen = new Set()
  return hits.filter((hit) => {
    if (seen.has(hit.midiUrl)) return false
    seen.add(hit.midiUrl)
    return isAllowedMidiUrl(hit.midiUrl)
  })
}

export async function fetchMidiBytes(url) {
  if (!isAllowedMidiUrl(url)) throw new Error('That MIDI source is not allowed')
  const response = await fetch(url, { headers: HEADERS })
  if (!response.ok) throw new Error(`Could not download MIDI (${response.status})`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length < 8 || buffer.length > MAX_BYTES) throw new Error('MIDI file is unusable')
  if (buffer.subarray(0, 4).toString('ascii') !== 'MThd') throw new Error('Download was not a MIDI file')
  return buffer
}
