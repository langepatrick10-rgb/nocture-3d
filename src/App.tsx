import { Experience } from './scene/Experience'
import { useAppStore } from './engine/store'
import { BottomPiano } from './ui/BottomPiano'
import { NoteScroll } from './ui/NoteScroll'
import { Overlay } from './ui/Overlay'
import './index.css'

export default function App() {
  const viewMode = useAppStore((s) => s.viewMode)
  const playing = useAppStore((s) => s.playing)
  const songHallOpen = useAppStore((s) => s.songHallOpen)
  const transcribing = Boolean(useAppStore((s) => s.transcribeJob))
  const showBottomPiano = viewMode === 'scroll' && !songHallOpen && !transcribing
  return (
    <div
      className={`app ${viewMode === 'scroll' ? 'is-scroll' : 'is-stage'}${playing ? ' is-playing' : ''}${songHallOpen ? ' is-songs' : ''}${transcribing ? ' is-transcribe' : ''}`}
    >
      <div className="stage-wrap">
        <Experience />
        {viewMode === 'scroll' ? <NoteScroll /> : null}
        <Overlay />
      </div>
      {showBottomPiano ? <BottomPiano /> : null}
    </div>
  )
}
