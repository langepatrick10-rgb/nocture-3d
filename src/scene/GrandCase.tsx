import { useMemo } from 'react'
import { ExtrudeGeometry, LatheGeometry, Shape, Vector2 } from 'three'
import { PIANO_WIDTH, WHITE_LENGTH } from '../music/layout'
import { CHEEK, FLOOR_Y, GRAND_LENGTH, RIM_BOTTOM, RIM_HEIGHT, RIM_TOP } from './scale'

const LACQUER = {
  color: '#050506',
  metalness: 0.08,
  roughness: 0.12,
  clearcoat: 1,
  clearcoatRoughness: 0.035,
  envMapIntensity: 0.62,
  ior: 1.5,
} as const

const BRASS = {
  color: '#c6a24e',
  metalness: 1,
  roughness: 0.22,
  envMapIntensity: 0.85,
} as const

function grandShape(width: number, length: number, inset = 0): Shape {
  const hw = width / 2 - inset
  const len = length - inset * 1.4
  const s = new Shape()
  s.moveTo(-hw, inset)
  s.lineTo(hw, inset)
  s.lineTo(hw, 0.72 + inset)
  s.bezierCurveTo(hw + 0.05, len * 0.22, hw * 0.96, len * 0.48, hw * 0.42, len * 0.72)
  s.bezierCurveTo(hw * 0.18, len * 0.86, hw * 0.04, len * 0.94, -hw * 0.12, len)
  s.bezierCurveTo(-hw * 0.38, len + 0.12, -hw * 0.82, len * 0.92, -hw * 1.08, len * 0.62)
  s.bezierCurveTo(-hw * 1.22, len * 0.38, -hw * 1.16, len * 0.16, -hw, 0.72 + inset)
  s.closePath()
  return s
}

function extrudeShape(shape: Shape, depth: number, zFront: number, yBottom: number) {
  const geo = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: Math.min(0.05, depth * 0.12),
    bevelSize: 0.04,
    bevelSegments: 3,
    curveSegments: 36,
  })
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, yBottom, zFront)
  geo.computeVertexNormals()
  return geo
}

function Lacquer() {
  return <meshPhysicalMaterial {...LACQUER} />
}

function Brass() {
  return <meshPhysicalMaterial {...BRASS} />
}

function Leg({ x, z, length }: { x: number; z: number; length: number }) {
  const geo = useMemo(() => {
    const pts = [
      new Vector2(0.17, 0),
      new Vector2(0.2, 0.07),
      new Vector2(0.12, 0.16),
      new Vector2(0.09, 0.55),
      new Vector2(0.08, length - 0.28),
      new Vector2(0.14, length - 0.1),
      new Vector2(0.13, length),
    ]
    return new LatheGeometry(pts, 20)
  }, [length])

  return (
    <group position={[x, FLOOR_Y, z]}>
      <mesh geometry={geo} castShadow receiveShadow>
        <Lacquer />
      </mesh>
      <mesh position={[0, 0.045, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.18, 0.09, 16]} />
        <Brass />
      </mesh>
      <mesh position={[0, 0.01, 0]} castShadow>
        <sphereGeometry args={[0.055, 12, 10]} />
        <Brass />
      </mesh>
    </group>
  )
}

function Strings({ width, zFront }: { width: number; zFront: number }) {
  const strings = useMemo(() => {
    const items: Array<{ x: number; len: number; mid: number; rot: number }> = []
    const n = 56
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      const x0 = -width * 0.42 + t * width * 0.78
      const z0 = zFront - WHITE_LENGTH - 0.55
      const z1 = zFront - 4.2 - t * (GRAND_LENGTH - 6.8)
      const dx = 0
      const dz = z1 - z0
      items.push({
        x: x0,
        len: Math.hypot(dx, dz),
        mid: (z0 + z1) / 2,
        rot: Math.atan2(dx, -dz),
      })
    }
    return items
  }, [width, zFront])

  return (
    <group>
      {strings.map((s, i) => (
        <mesh key={i} position={[s.x, 0.42, s.mid]} rotation={[-Math.PI / 2, 0, s.rot]}>
          <cylinderGeometry args={[0.006, 0.006, s.len, 4]} />
          <meshPhysicalMaterial color="#e4d09a" metalness={1} roughness={0.16} />
        </mesh>
      ))}
    </group>
  )
}

export function GrandCase() {
  const width = PIANO_WIDTH + CHEEK * 2
  const zFront = WHITE_LENGTH / 2 + 0.22
  const body = useMemo(
    () => extrudeShape(grandShape(width, GRAND_LENGTH), 0.28, zFront, RIM_BOTTOM - 0.02),
    [width, zFront],
  )
  const rim = useMemo(() => {
    const outer = grandShape(width, GRAND_LENGTH)
    const inner = grandShape(width, GRAND_LENGTH, 0.22)
    const pts = inner.getPoints(64)
    const hole = new Shape()
    const last = pts[pts.length - 1]
    hole.moveTo(last.x, last.y)
    for (let i = pts.length - 2; i >= 0; i--) hole.lineTo(pts[i].x, pts[i].y)
    hole.closePath()
    outer.holes.push(hole)
    return extrudeShape(outer, RIM_HEIGHT, zFront, RIM_BOTTOM)
  }, [width, zFront])
  const plate = useMemo(
    () => extrudeShape(grandShape(width, GRAND_LENGTH, 0.32), 0.07, zFront, 0.28),
    [width, zFront],
  )
  const lid = useMemo(
    () => extrudeShape(grandShape(width, GRAND_LENGTH, 0.04), 0.07, zFront, 0),
    [width, zFront],
  )
  const lidLiner = useMemo(
    () => extrudeShape(grandShape(width, GRAND_LENGTH, 0.1), 0.012, zFront, 0.072),
    [width, zFront],
  )

  const hw = width / 2
  const trebleZ = zFront - 1.35
  const tailZ = zFront - GRAND_LENGTH * 0.74
  const legLen = RIM_BOTTOM - FLOOR_Y - 0.02
  const fallZ = -WHITE_LENGTH / 2 - 0.22

  return (
    <group>
      <mesh geometry={body} castShadow receiveShadow>
        <Lacquer />
      </mesh>
      <mesh geometry={rim} castShadow receiveShadow>
        <Lacquer />
      </mesh>
      <mesh geometry={plate} receiveShadow>
        <meshPhysicalMaterial color="#c49a3c" metalness={0.96} roughness={0.2} envMapIntensity={0.8} />
      </mesh>
      <Strings width={width} zFront={zFront} />

      <group position={[hw * 0.08, RIM_TOP + 0.04, zFront - GRAND_LENGTH * 0.45]} rotation={[0.03, 0.02, 0.46]}>
        <mesh geometry={lid} position={[-hw * 0.08, -RIM_TOP, -(zFront - GRAND_LENGTH * 0.45)]} castShadow>
          <Lacquer />
        </mesh>
        <mesh geometry={lidLiner} position={[-hw * 0.08, -RIM_TOP, -(zFront - GRAND_LENGTH * 0.45)]}>
          <meshPhysicalMaterial color="#cbb79a" roughness={0.62} metalness={0.04} />
        </mesh>
      </group>

      <mesh
        position={[-hw * 0.28, 2.15, zFront - GRAND_LENGTH * 0.38]}
        rotation={[0.72, 0.05, 0.18]}
        castShadow
      >
        <cylinderGeometry args={[0.028, 0.028, 3.4, 10]} />
        <Lacquer />
      </mesh>

      <mesh position={[0, 0.08, fallZ + 0.12]} receiveShadow>
        <boxGeometry args={[PIANO_WIDTH + 0.06, 0.04, 0.1]} />
        <meshStandardMaterial color="#7a1e28" roughness={0.72} />
      </mesh>
      <mesh position={[0, 1.05, fallZ - 0.08]} castShadow>
        <boxGeometry args={[PIANO_WIDTH + 0.1, 0.1, 0.42]} />
        <Lacquer />
      </mesh>
      <mesh position={[0, 1.55, fallZ - 0.55]} rotation={[-0.48, 0, 0]} castShadow>
        <boxGeometry args={[4.4, 0.045, 1.35]} />
        <Lacquer />
      </mesh>
      <mesh position={[-1.15, 2.15, fallZ - 0.38]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[0.04, 0.85, 0.04]} />
        <Lacquer />
      </mesh>
      <mesh position={[1.15, 2.15, fallZ - 0.38]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[0.04, 0.85, 0.04]} />
        <Lacquer />
      </mesh>
      <mesh position={[0, 2.55, fallZ - 0.48]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[2.5, 0.035, 0.22]} />
        <Lacquer />
      </mesh>

      <mesh position={[-hw + CHEEK / 2, 0.55, 0.04]} castShadow>
        <boxGeometry args={[CHEEK, 1.55, WHITE_LENGTH + 0.28]} />
        <Lacquer />
      </mesh>
      <mesh position={[hw - CHEEK / 2, 0.55, 0.04]} castShadow>
        <boxGeometry args={[CHEEK, 1.55, WHITE_LENGTH + 0.28]} />
        <Lacquer />
      </mesh>
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <boxGeometry args={[PIANO_WIDTH, 0.2, WHITE_LENGTH + 0.16]} />
        <Lacquer />
      </mesh>

      <Leg x={-hw + 0.7} z={trebleZ} length={legLen} />
      <Leg x={hw - 0.7} z={trebleZ} length={legLen} />
      <Leg x={-hw * 0.48} z={tailZ} length={legLen} />

      <group position={[0.04, FLOOR_Y + 1.55, zFront - 0.18]}>
        <mesh position={[-0.16, 0, 0]} castShadow>
          <boxGeometry args={[0.1, 2.85, 0.08]} />
          <Lacquer />
        </mesh>
        <mesh position={[0.16, 0, 0]} castShadow>
          <boxGeometry args={[0.1, 2.85, 0.08]} />
          <Lacquer />
        </mesh>
        <mesh position={[0, -1.05, 0.1]} castShadow>
          <boxGeometry args={[0.7, 0.08, 0.28]} />
          <Lacquer />
        </mesh>
        {[-0.22, 0, 0.22].map((px) => (
          <mesh key={px} position={[px, -1.42, 0.22]} castShadow>
            <boxGeometry args={[0.16, 0.04, 0.46]} />
            <Brass />
          </mesh>
        ))}
      </group>

      <group position={[0, FLOOR_Y, zFront + 2.35]}>
        <mesh position={[0, 3.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.7, 0.11, 1.28]} />
          <Lacquer />
        </mesh>
        <mesh position={[-2.12, 1.52, 0]} castShadow>
          <boxGeometry args={[0.11, 3.05, 1.15]} />
          <Lacquer />
        </mesh>
        <mesh position={[2.12, 1.52, 0]} castShadow>
          <boxGeometry args={[0.11, 3.05, 1.15]} />
          <Lacquer />
        </mesh>
        <mesh position={[0, 1.52, -0.52]} castShadow>
          <boxGeometry args={[4.2, 2.6, 0.08]} />
          <Lacquer />
        </mesh>
      </group>
    </group>
  )
}
