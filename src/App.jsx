// band-demo/src/App.jsx
import * as THREE from 'three'
import { useEffect, useRef, useState, useMemo } from 'react'

import { Canvas, extend, useThree, useFrame } from '@react-three/fiber'
import { useGLTF, useTexture, Environment, Lightformer } from '@react-three/drei'
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
} from '@react-three/rapier'
import { MeshLineGeometry, MeshLineMaterial } from 'meshline'


extend({ MeshLineGeometry, MeshLineMaterial })

const TAG_GLB =
  'https://assets.vercel.com/image/upload/contentful/image/e5382hct74si/5huRVDzcoDwnbgrKUo1Lzs/53b6dd7d6b4ffcdbd338fa60265949e1/tag.glb'

useGLTF.preload(TAG_GLB)


export default function App() {


  return (
    <Canvas
      camera={{ position: [0, 0, 13], fov: 25 }}
      gl={{ alpha: true }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >



      <ambientLight intensity={Math.PI} />

      <Physics debug={false} interpolate gravity={[0, -40, 0]} timeStep={1 / 60}>

        <Band />
      </Physics>

      <Environment blur={0.75}>


        <Lightformer
          intensity={2}
          color="white"
          position={[0, -1, 5]}
          rotation={[0, 0, Math.PI / 3]}
          scale={[100, 0.1, 1]}
        />
        <Lightformer
          intensity={3}
          color="white"
          position={[-1, -1, 1]}
          rotation={[0, 0, Math.PI / 3]}
          scale={[100, 0.1, 1]}
        />
        <Lightformer
          intensity={3}
          color="white"
          position={[1, 1, 1]}
          rotation={[0, 0, Math.PI / 3]}
          scale={[100, 0.1, 1]}
        />
        <Lightformer
          intensity={10}
          color="white"
          position={[-10, 0, 14]}
          rotation={[0, Math.PI / 2, Math.PI / 3]}
          scale={[100, 10, 1]}
        />
      </Environment>
    </Canvas>
  )
}

function Band({ maxSpeed = 50, minSpeed = 10 }) {
  const band = useRef()
  const fixed = useRef()
  const j1 = useRef()
  const j2 = useRef()
  const j3 = useRef()
  const card = useRef()

  const repX = 1.92
  const repY = 1.10
  const offX = -0.01
  const offY = 0.04



  // Scratch vectors (kept stable across renders)
  const vec = useRef(new THREE.Vector3())
  const dir = useRef(new THREE.Vector3())
  const ang = useRef(new THREE.Vector3())
  const rot = useRef(new THREE.Vector3())

  const segmentProps = {
    type: 'dynamic',
    canSleep: true,
    colliders: false,
    angularDamping: 2,
    linearDamping: 2,
  }

  const { nodes, materials } = useGLTF(TAG_GLB)

  const rawCardImage = useTexture(import.meta.env.BASE_URL + 'photo.png')




  const cardImage = useMemo(() => {
    const t = rawCardImage.clone()

    t.flipY = false
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = THREE.ClampToEdgeWrapping
    t.wrapT = THREE.ClampToEdgeWrapping

    t.anisotropy = 16

    // LIVE UV CONTROL
    t.repeat.set(repX, repY)
    t.offset.set(offX, offY)

    t.needsUpdate = true
    return t
  }, [rawCardImage, repX, repY, offX, offY])




  const { width, height } = useThree((s) => s.size)

  // Curve is mutable -> useRef (not useState) to satisfy immutability linting
  const curve = useRef(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ])
  )

  const [dragged, drag] = useState(false)
  const [hovered, hover] = useState(false)

  // Joints
  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1])
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1])
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1])
  useSphericalJoint(j3, card, [[0, 0, 0], [0, 1.45, 0]])

  // Cursor UX
  useEffect(() => {
    if (!hovered) return
    document.body.style.cursor = dragged ? 'grabbing' : 'grab'
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [hovered, dragged])

  // Configure strap texture (three.js requires mutation; ESLint rule is too strict)


  useFrame((state, delta) => {
    if (!fixed.current || !j1.current || !j2.current || !j3.current || !card.current || !band.current) return

    const v = vec.current
    const d = dir.current
    const a = ang.current
    const r = rot.current

    if (dragged) {
      v.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera)
      d.copy(v).sub(state.camera.position).normalize()
      v.add(d.multiplyScalar(state.camera.position.length()))

        ;[card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp())

      card.current.setNextKinematicTranslation({
        x: v.x - dragged.x,
        y: v.y - dragged.y,
        z: v.z - dragged.z,
      })
    }

    // Smooth out jitter when over-pulling
    ;[j1, j2].forEach((ref) => {
      if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation())
      const clampedDistance = Math.max(
        0.1,
        Math.min(1, ref.current.lerped.distanceTo(ref.current.translation()))
      )
      ref.current.lerped.lerp(
        ref.current.translation(),
        delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed))
      )
    })

    // Update strap curve
    curve.current.points[0].copy(j3.current.translation())
    curve.current.points[1].copy(j2.current.lerped)
    curve.current.points[2].copy(j1.current.lerped)
    curve.current.points[3].copy(fixed.current.translation())
    band.current.geometry.setPoints(curve.current.getPoints(32))

    // Tilt it back
    a.copy(card.current.angvel())
    r.copy(card.current.rotation())
    card.current.setAngvel({ x: a.x, y: a.y - r.y * 0.25, z: a.z })
  })

  return (
    <>
      <group position={[3.8, 4, 0]}>


        <RigidBody ref={fixed} {...segmentProps} type="fixed" />

        <RigidBody ref={j1} position={[0.5, 0, 0]} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>

        <RigidBody ref={j2} position={[1, 0, 0]} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>

        <RigidBody ref={j3} position={[1.5, 0, 0]} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>

        <RigidBody
          ref={card}
          position={[2, 0, 0]}
          {...segmentProps}
          type={dragged ? 'kinematicPosition' : 'dynamic'}
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />

          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e) => {
              e.target.releasePointerCapture(e.pointerId)
              drag(false)
            }}
            onPointerDown={(e) => {
              e.target.setPointerCapture(e.pointerId)

              // Compute drag offset (no comma operator, no undefined vars)
              const offset = new THREE.Vector3()
                .copy(e.point)
                .sub(vec.current.copy(card.current.translation()))
              drag(offset)
            }}
          >
            <mesh geometry={nodes.card.geometry}>
              <meshPhysicalMaterial
                map={cardImage}
                map-anisotropy={16}
                clearcoat={1}
                clearcoatRoughness={0.15}
                roughness={0.3}
                metalness={0.5}
              />

            </mesh>

            <mesh geometry={nodes.clip.geometry} material={materials.metal} />
            <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
          </group>
        </RigidBody>
      </group>

      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial
          color="black"
          depthTest={false}
          resolution={[width, height]}
          lineWidth={1}
        />

      </mesh>
    </>
  )
}
