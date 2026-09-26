import { ContactShadows, Environment } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Bloom, BrightnessContrast, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Object3D, type DirectionalLight } from 'three'
import { usePlacement, useRoomStore } from '../engine/roomStore'
import { setRecordCanvas } from '../engine/recorder'
import { useAppStore } from '../engine/store'
import { Cameras } from './Cameras'
import { FallingNotes } from './FallingNotes'
import { environmentById } from './look'
import { Piano } from './Piano'
import { getRoomMood } from './roomMood'
import { Salon } from './Salon'
import { SceneRoom } from './SceneRoom'
import { StreetRain } from './StreetRain'
import { FLOOR_Y } from './scale'

function KeyLight({
  position,
  target,
  intensity,
  color,
  castShadow,
  mapSize,
  span,
  far,
}: {
  position: [number, number, number]
  target: [number, number, number]
  intensity: number
  color: string
  castShadow: boolean
  mapSize: [number, number]
  span: number
  far: number
}) {
  const lightRef = useRef<DirectionalLight>(null)
  const targetRef = useRef<Object3D>(null)
  useLayoutEffect(() => {
    const light = lightRef.current
    const aim = targetRef.current
    if (!light || !aim) return
    light.target = aim
    aim.updateMatrixWorld()
  }, [position, target])
  return (
    <>
      <object3D ref={targetRef} position={target} />
      <directionalLight
        ref={lightRef}
        castShadow={castShadow}
        position={position}
        intensity={intensity}
        color={color}
        shadow-bias={-0.00022}
        shadow-normalBias={0.04}
        shadow-mapSize={mapSize}
        shadow-camera-near={0.5}
        shadow-camera-far={far}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-camera-bottom={-span}
      />
    </>
  )
}

function CanvasBinder() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    setRecordCanvas(gl.domElement)
  }, [gl])
  return null
}

function ToneMap({ exposure }: { exposure: number }) {
  const gl = useThree((s) => s.gl)
  useLayoutEffect(() => {
    const prev = gl.toneMappingExposure
    gl.toneMappingExposure = exposure
    return () => {
      gl.toneMappingExposure = prev
    }
  }, [gl, exposure])
  return null
}

function Scene() {
  const env = environmentById('studio')
  const placement = usePlacement()
  const inRoom = Boolean(placement.url)
  const sceneHasLights = useRoomStore((s) => s.sceneHasLights)
  const flashlightOn = useAppStore((s) => s.flashlightOn)
  const authorLit = inRoom && sceneHasLights
  const pitchBlack = authorLit && !flashlightOn
  const mood = useMemo(() => getRoomMood(placement.url), [placement.url])
  const useMood = inRoom && !authorLit
  const bg = authorLit ? (flashlightOn ? '#050508' : '#000000') : useMood ? mood.background : env.background
  const hemi = useMood ? mood.hemi : inRoom ? 0.22 : 0.38
  const dir = useMood ? mood.dir : 1.2
  const dirPos: [number, number, number] = useMood
    ? [
        placement.pianoX + mood.dirOffset[0],
        placement.pianoY + mood.dirOffset[1],
        placement.pianoZ + mood.dirOffset[2],
      ]
    : [
        placement.pianoX - 4,
        placement.pianoY + 6,
        placement.pianoZ + 3,
      ]
  const shadowSpan = useMood ? mood.shadowSpan : 8
  const exposure = authorLit ? 1 : useMood ? mood.exposure : env.exposure ?? 1

  return (
    <>
      <color attach="background" args={[bg]} />
      {authorLit ? null : useMood && mood.fogMode === 'exp2' ? (
        <fogExp2 attach="fog" args={[mood.fogColor, mood.fogDensity]} />
      ) : useMood && mood.fogMode === 'linear' ? (
        <fog attach="fog" args={[mood.fogColor, mood.fogNear, mood.fogFar]} />
      ) : typeof env.fogFar === 'number' ? (
        <fog attach="fog" args={[env.background, env.fogNear ?? 8, env.fogFar]} />
      ) : null}
      <ToneMap exposure={exposure} />
      {authorLit ? null : (
        <hemisphereLight
          args={[useMood ? mood.hemiSky : '#f4ead8', useMood ? mood.hemiGround : '#3a3228', hemi]}
        />
      )}
      {authorLit ? null : (
        <KeyLight
          position={dirPos}
          target={[placement.pianoX, placement.pianoY, placement.pianoZ]}
          intensity={dir}
          color={useMood ? mood.dirColor : '#fff1d6'}
          castShadow
          mapSize={[1024, 1024]}
          span={shadowSpan}
          far={useMood ? mood.shadowFar : 24}
        />
      )}
      {inRoom ? null : (
        <spotLight position={[-3, 4, 2]} angle={0.55} penumbra={0.9} intensity={4} color="#f6e6c4" />
      )}
      <CanvasBinder />
      <Cameras />
      {inRoom ? null : <Salon color={env.background} />}
      <Suspense fallback={null}>
        {inRoom ? (
          <>
            {authorLit ? null : (
              <Environment preset={mood.envPreset} environmentIntensity={mood.envIntensity} />
            )}
            <SceneRoom url={placement.url} />
          </>
        ) : (
          <Environment
            key={env.id}
            preset={env.preset}
            background
            backgroundBlurriness={env.blur}
            environmentIntensity={env.intensity}
          />
        )}
        <Piano />
        {useMood && mood.rain ? (
          <StreetRain x={placement.pianoX} y={placement.pianoY} z={placement.pianoZ} />
        ) : null}
        {pitchBlack ? null : (
          <ContactShadows
            key={`${placement.pianoX.toFixed(2)}-${placement.pianoY.toFixed(2)}-${placement.pianoZ.toFixed(2)}-${placement.pianoScale.toFixed(2)}`}
            frames={1}
            position={[placement.pianoX, placement.pianoY + FLOOR_Y + 0.008, placement.pianoZ]}
            opacity={authorLit ? 0.18 : useMood ? mood.contactOpacity : inRoom ? 0.4 : 0.45}
            scale={Math.max(6, 10 * placement.pianoScale)}
            blur={useMood && mood.rain ? 2.8 : 2.2}
            far={6}
            resolution={512}
          />
        )}
      </Suspense>
      <FallingNotes />
      <EffectComposer>
          <Bloom
            intensity={
              pitchBlack ? 0 : authorLit ? 0.18 : useMood ? mood.bloomIntensity : inRoom ? 0.07 : 0.12
            }
            luminanceThreshold={
              authorLit ? 0.55 : useMood ? mood.bloomThreshold : inRoom ? 0.86 : 0.78
            }
            mipmapBlur
          />
          {useMood && (mood.brightness !== 0 || mood.contrast !== 0) ? (
            <BrightnessContrast brightness={mood.brightness} contrast={mood.contrast} />
          ) : null}
          {useMood && mood.noise > 0 ? <Noise opacity={mood.noise} /> : null}
          {useMood && mood.vignette > 0 ? <Vignette offset={0.28} darkness={mood.vignette} /> : null}
        </EffectComposer>
    </>
  )
}

export function Experience() {
  const viewMode = useAppStore((s) => s.viewMode)
  const pianoId = useAppStore((s) => s.pianoId)
  const environmentId = useAppStore((s) => s.environmentId)
  const transcribing = Boolean(useAppStore((s) => s.transcribeJob))
  const marble = pianoId === 'marble'
  const placement = usePlacement()
  const inRoom = Boolean(placement.url)
  const start = marble ? ([1.35, 1.85, 2.65] as const) : ([0.95, 1.48, 1.92] as const)
  return (
    <Canvas
      key={`${pianoId}-${environmentId}`}
      className="stage"
      shadows
      frameloop={transcribing || viewMode === 'scroll' ? 'never' : 'always'}
      dpr={[1, 1.25]}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        stencil: false,
        preserveDrawingBuffer: false,
      }}
      camera={{
        position: [...start],
        fov: 40,
        near: 0.08,
        far: inRoom ? 220 : 80,
      }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1
      }}
    >
      <Scene />
    </Canvas>
  )
}
