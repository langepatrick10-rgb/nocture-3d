import { ContactShadows, Environment } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Suspense, useEffect } from 'react'
import { setRecordCanvas } from '../engine/recorder'
import { useAppStore } from '../engine/store'
import { Cameras } from './Cameras'
import { FallingNotes } from './FallingNotes'
import { ENVIRONMENTS } from './look'
import { Piano } from './Piano'
import { Salon } from './Salon'
import { FLOOR_Y } from './scale'

function CanvasBinder() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    setRecordCanvas(gl.domElement)
  }, [gl])
  return null
}

function Scene() {
  const environmentId = useAppStore((s) => s.environmentId)
  const pianoId = useAppStore((s) => s.pianoId)
  const dropped = useAppStore((s) => s.pianoGltfUrl)
  const heavy = !dropped && pianoId === 'marble'
  const env = ENVIRONMENTS.find((item) => item.id === environmentId) ?? ENVIRONMENTS[0]
  return (
    <>
      <color attach="background" args={[env.background]} />
      <fog attach="fog" args={[env.background, 8, 22]} />
      <hemisphereLight args={['#f4ead8', '#3a3228', 0.38]} />
      <directionalLight
        castShadow={!heavy}
        position={[-4, 6, 3]}
        intensity={heavy ? 0.85 : 1.2}
        color="#fff1d6"
        shadow-bias={-0.00018}
        shadow-normalBias={0.04}
        shadow-mapSize={heavy ? [512, 512] : [1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={18}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      {heavy ? null : (
        <spotLight position={[-3, 4, 2]} angle={0.55} penumbra={0.9} intensity={4} color="#f6e6c4" />
      )}
      {env.files ? (
        <Environment
          key={env.id}
          files={env.files}
          background
          backgroundBlurriness={env.blur}
          environmentIntensity={heavy ? env.intensity * 0.7 : env.intensity}
        />
      ) : (
        <Environment
          key={env.id}
          preset={env.preset}
          background
          backgroundBlurriness={env.blur}
          environmentIntensity={heavy ? env.intensity * 0.7 : env.intensity}
        />
      )}
      <CanvasBinder />
      <Cameras />
      <Salon color={env.background} heavy={heavy} />
      <Suspense fallback={null}>
        <Piano />
        <ContactShadows
          frames={1}
          position={[0, FLOOR_Y + 0.008, 0]}
          opacity={heavy ? 0.22 : 0.45}
          scale={10}
          blur={heavy ? 1.4 : 2.2}
          far={6}
          resolution={heavy ? 256 : 512}
        />
      </Suspense>
      <FallingNotes />
      {heavy ? null : (
        <EffectComposer>
          <Bloom intensity={0.12} luminanceThreshold={0.78} mipmapBlur />
        </EffectComposer>
      )}
    </>
  )
}

export function Experience() {
  const viewMode = useAppStore((s) => s.viewMode)
  const pianoId = useAppStore((s) => s.pianoId)
  const dropped = useAppStore((s) => s.pianoGltfUrl)
  const transcribing = Boolean(useAppStore((s) => s.transcribeJob))
  const heavy = !dropped && pianoId === 'marble'
  return (
    <Canvas
      key={dropped ? 'custom' : pianoId}
      className="stage"
      shadows={!heavy}
      frameloop={transcribing || viewMode === 'scroll' ? 'never' : 'always'}
      dpr={heavy ? [1, 1] : [1, 1.25]}
      gl={{
        antialias: !heavy,
        powerPreference: 'high-performance',
        stencil: false,
        preserveDrawingBuffer: false,
      }}
      camera={{
        position: heavy ? [1.35, 1.85, 2.65] : [0.95, 1.48, 1.92],
        fov: 40,
        near: 0.08,
        far: 40,
      }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1
      }}
    >
      <Scene />
    </Canvas>
  )
}
