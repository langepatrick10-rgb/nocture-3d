import { useAppStore } from '../engine/store'
import { DEFAULT_GRAND_URL, ImportedGrand } from './ImportedGrand'
import { PIANOS } from './look'

export function Piano() {
  const dropped = useAppStore((s) => s.pianoGltfUrl)
  const pianoId = useAppStore((s) => s.pianoId)
  const url = dropped ?? PIANOS.find((item) => item.id === pianoId)?.url ?? DEFAULT_GRAND_URL
  return (
    <group rotation={[0, -0.12, 0]}>
      <ImportedGrand key={url} url={url} />
    </group>
  )
}
