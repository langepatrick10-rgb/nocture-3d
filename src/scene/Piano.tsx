import { usePlacement } from '../engine/roomStore'
import { useAppStore } from '../engine/store'
import { DEFAULT_GRAND_URL, ImportedGrand } from './ImportedGrand'
import { PIANOS } from './look'

export function Piano() {
  const pianoId = useAppStore((s) => s.pianoId)
  const placement = usePlacement()
  const url = PIANOS.find((item) => item.id === pianoId)?.url ?? DEFAULT_GRAND_URL
  return (
    <group
      position={[placement.pianoX, placement.pianoY, placement.pianoZ]}
      rotation={[0, (placement.pianoYaw * Math.PI) / 180, 0]}
      scale={placement.pianoScale}
    >
      <group rotation={[0, -0.12, 0]}>
        <ImportedGrand key={url} url={url} />
      </group>
    </group>
  )
}
