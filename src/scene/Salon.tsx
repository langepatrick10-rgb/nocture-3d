import { MeshReflectorMaterial } from '@react-three/drei'
import { FLOOR_Y } from './scale'

export function Salon({
  color = '#6a5138',
  heavy = false,
}: {
  color?: string
  heavy?: boolean
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
      <planeGeometry args={[18, 16]} />
      <MeshReflectorMaterial
        blur={heavy ? [200, 50] : [280, 70]}
        resolution={heavy ? 256 : 512}
        mixBlur={0.8}
        mixStrength={0.32}
        roughness={0.5}
        color={color}
        metalness={0.06}
        depthScale={0.55}
        minDepthThreshold={0.35}
        maxDepthThreshold={1.4}
        mirror={0.1}
      />
    </mesh>
  )
}
