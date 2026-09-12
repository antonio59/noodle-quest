import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameProps } from '@/types';
import { webglSupported } from '@/lib/webgl';
import { playMove as sfxMove } from '@/lib/feedback';
import {
  newCube, applyMove, invert, isSolved, scramble, COLOR_HEX, FACE_NORMALS,
  type Cube, type Move, type Axis, type Vec3,
} from './logic';

const GAP = 1.06;
const DARK = '#1a1730';

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Materials in three.js box order: +x, -x, +y, -y, +z, -z — matches FACE_NORMALS. */
interface CubieMeshProps {
  pos: Vec3;
  colors: (string | null)[];
  onDown: (e: { face: { normal: THREE.Vector3 } | null; point: THREE.Vector3; nativeEvent: PointerEvent; stopPropagation: () => void }, pos: Vec3) => void;
}

const CubieMesh = memo(function CubieMesh({ pos, colors, onDown }: CubieMeshProps) {
  const colorKey = colors.join('|');
  const materials = useMemo(
    () => colorKey.split('|').map(c => new THREE.MeshStandardMaterial({
      color: c ? COLOR_HEX[c as keyof typeof COLOR_HEX] : DARK,
      roughness: 0.35,
      metalness: 0.05,
    })),
    [colorKey],
  );
  useEffect(() => () => { materials.forEach(m => m.dispose()); }, [materials]);
  return (
    <mesh
      position={[pos[0] * GAP, pos[1] * GAP, pos[2] * GAP]}
      material={materials}
      onPointerDown={e => onDown(e as never, pos)}
    >
      <boxGeometry args={[0.97, 0.97, 0.97]} />
    </mesh>
  );
});

interface PendingDrag {
  cubiePos: Vec3;
  normal: Vec3;
  point: THREE.Vector3;
  startX: number;
  startY: number;
}

interface CubeSceneProps {
  cube: Cube;
  anim: { move: Move; started: number } | null;
  onAnimDone: () => void;
  onFaceDragStart: (drag: PendingDrag) => void;
  yaw: number;
  pitch: number;
  animMs: number;
}

function CubeScene({ cube, anim, onAnimDone, onFaceDragStart, yaw, pitch, animMs }: CubeSceneProps) {
  const layerRef = useRef<THREE.Group>(null);
  const doneRef = useRef(false);

  useEffect(() => { doneRef.current = false; }, [anim]);

  useFrame(() => {
    if (!anim || !layerRef.current || doneRef.current) return;
    const t = Math.min(1, (performance.now() - anim.started) / animMs);
    const eased = 1 - Math.pow(1 - t, 3);
    const angle = eased * (Math.PI / 2) * anim.move.dir;
    const rot: [number, number, number] = [0, 0, 0];
    rot[anim.move.axis] = angle;
    layerRef.current.rotation.set(...rot);
    if (t >= 1) {
      doneRef.current = true;
      onAnimDone();
    }
  });

  const inAnimLayer = (c: Cube[number]) => anim !== null && c.pos[anim.move.axis] === anim.move.layer;

  const handleDown = useCallback((e: { face: { normal: THREE.Vector3 } | null; point: THREE.Vector3; nativeEvent: PointerEvent; stopPropagation: () => void }, pos: Vec3) => {
    if (!e.face) return;
    e.stopPropagation();
    const n = e.face.normal;
    onFaceDragStart({
      cubiePos: pos,
      normal: [Math.round(n.x), Math.round(n.y), Math.round(n.z)] as Vec3,
      point: e.point.clone(),
      startX: e.nativeEvent.clientX,
      startY: e.nativeEvent.clientY,
    });
  }, [onFaceDragStart]);

  const renderCubie = (cubie: Cube[number], i: number) => (
    <CubieMesh key={i} pos={cubie.pos} colors={cubie.colors} onDown={handleDown} />
  );

  return (
    <group rotation={[pitch, yaw, 0]}>
      <group ref={layerRef}>{cube.map((c, i) => (inAnimLayer(c) ? renderCubie(c, i) : null))}</group>
      {cube.map((c, i) => (inAnimLayer(c) ? null : renderCubie(c, i)))}
      <ambientLight intensity={0.85} />
      <directionalLight position={[5, 8, 6]} intensity={0.9} />
      <directionalLight position={[-6, -4, -5]} intensity={0.4} />
    </group>
  );
}

/** Bridges R3F internals out so drag math can project tangents to screen. */
function CameraBridge({ out }: { out: React.MutableRefObject<{ camera: THREE.Camera; size: { width: number; height: number } } | null> }) {
  const { camera, size } = useThree();
  out.current = { camera, size };
  return null;
}

function CubeTwistGame({ stage, onScore, onProgress, onMessage, onEnd, paused, multiplayerState, onMultiplayerMove }: GameProps) {
  const isOnline = !!multiplayerState;
  const playerNumber = multiplayerState?.playerNumber ?? 1;
  const isHost = isOnline && playerNumber === 1;
  const isMyTurn = !isOnline || multiplayerState?.currentPlayer === playerNumber;
  const oppName = multiplayerState?.opponentName ?? 'Opponent';
  const oppAvatar = multiplayerState?.opponentAvatar ?? '';

  const scrambleLen = Math.min(2 + stage, 20);
  const [started, setStarted] = useState(false);
  const [cube, setCube] = useState<Cube>(newCube);
  const [anim, setAnim] = useState<{ move: Move; started: number; record: boolean } | null>(null);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [view, setView] = useState({ yaw: 0.62, pitch: 0.42 });
  const [reverse, setReverse] = useState(false);

  const endedRef = useRef(false);
  const historyRef = useRef<Move[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const faceDragRef = useRef<PendingDrag | null>(null);
  const orbitRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const bridgeRef = useRef<{ camera: THREE.Camera; size: { width: number; height: number } } | null>(null);
  const animRef = useRef(anim);
  useEffect(() => { animRef.current = anim; }, [anim]);

  const supported = useMemo(webglSupported, []);
  const animMs = reducedMotion() ? 1 : 180;

  useEffect(() => {
    endedRef.current = false;
    return () => { endedRef.current = true; };
  }, []);

  // Online: hydrate cube from shared boardState; end when someone solves
  useEffect(() => {
    if (!isOnline || !multiplayerState) return;
    const bs = multiplayerState.boardState as { cube?: Cube; moveCount?: number } | null | undefined;
    if (bs?.cube) {
      // Don't overwrite mid-animation — local commit already applied the cube
      if (!animRef.current) setCube(bs.cube);
      if (typeof bs.moveCount === 'number') setMoves(bs.moveCount);
      setStarted(true);
    }
    if (multiplayerState.winner != null && !endedRef.current) {
      endedRef.current = true;
      const iWon = multiplayerState.winner === playerNumber;
      onScore(iWon ? 150 : 10);
      onProgress(iWon ? 1 : 0.3);
      onEnd({
        score: iWon ? 150 : 10,
        stars: iWon ? 3 : 1,
        summary: iWon ? 'You solved the cube!' : `${oppName} solved the cube first.`,
      });
    }
  }, [isOnline, multiplayerState, playerNumber, oppName, onScore, onProgress, onEnd]);

  // Solve timer (frozen while the tab is hidden)
  useEffect(() => {
    if (!started || endedRef.current || paused) return;
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [started, paused]);

  const start = () => {
    const { cube: scrambled } = scramble(newCube(), scrambleLen);
    setCube(scrambled);
    setStarted(true);
    setMoves(0);
    onMessage(
      isOnline
        ? `Scrambled with ${scrambleLen} twists — first to solve wins!`
        : `Scrambled with ${scrambleLen} twists — restore every face!`,
    );
    if (isOnline && isHost) {
      // turnSeat keeps seat 1 after the seed move (makeMove would otherwise rotate to 2)
      onMultiplayerMove?.({ boardState: { cube: scrambled, moveCount: 0, turnSeat: 1 } });
    }
  };

  const commitMove = useCallback((move: Move, record: boolean) => {
    setCube(prev => {
      const next = applyMove(prev, move);
      const nextCount = moves + 1;

      if (isOnline) {
        const solved = isSolved(next);
        onMultiplayerMove?.({
          boardState: { cube: next, moveCount: nextCount },
          winner: solved ? playerNumber : undefined,
        });
        return next;
      }

      if (isSolved(next) && !endedRef.current) {
        endedRef.current = true;
        const used = nextCount;
        const efficient = used <= scrambleLen * 2;
        const score = Math.max(20, scrambleLen * 15 - Math.max(0, used - scrambleLen) * 2 - seconds);
        const stars = efficient ? 3 : 2;
        onScore(score);
        onProgress(1);
        setTimeout(() => onEnd({
          score,
          stars,
          summary: `Solved in ${used} moves and ${seconds}s${efficient ? ' — barely more than the scramble!' : '!'}`,
        }), 900);
      }
      return next;
    });
    setMoves(m => m + 1);
    if (record && !isOnline) historyRef.current.push(move);
    setCanUndo(!isOnline && historyRef.current.length > 0);
  }, [moves, seconds, scrambleLen, onScore, onProgress, onEnd, isOnline, playerNumber, onMultiplayerMove]);

  const playMove = useCallback((move: Move, record = true) => {
    if (anim || endedRef.current) return;
    if (isOnline && !isMyTurn) return;
    sfxMove();
    setAnim({ move, started: performance.now(), record });
  }, [anim, isOnline, isMyTurn]);

  const onAnimDone = useCallback(() => {
    if (!anim) return;
    commitMove(anim.move, anim.record);
    setAnim(null);
  }, [anim, commitMove]);

  const undo = () => {
    if (isOnline) return;
    const last = historyRef.current[historyRef.current.length - 1];
    if (!last || anim) return;
    historyRef.current.pop();
    setCanUndo(historyRef.current.length > 0);
    playMove(invert(last), false);
  };

  const giveUp = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    onScore(10);
    onProgress(0.2);
    onEnd({ score: 10, stars: 1, summary: `A ${scrambleLen}-twist scramble is no joke. Try an earlier stage to warm up!` });
  };

  // ── Drag interactions ──────────────────────────────────────────────────
  const onFaceDragStart = useCallback((drag: PendingDrag) => {
    faceDragRef.current = drag;
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    // Background drag = orbit (face drags are captured by cubie meshes first)
    if (!faceDragRef.current) {
      orbitRef.current = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const face = faceDragRef.current;
    if (face && bridgeRef.current) {
      const dx = e.clientX - face.startX;
      const dy = e.clientY - face.startY;
      if (Math.abs(dx) + Math.abs(dy) < 14) return; // dead zone

      // Project the two face tangents to screen space and pick the one the
      // finger followed; normal × tangent gives the turn axis.
      const { camera, size } = bridgeRef.current;
      const groupQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(view.pitch, view.yaw, 0));
      const tangents = FACE_NORMALS.filter(
        t => t[0] * face.normal[0] + t[1] * face.normal[1] + t[2] * face.normal[2] === 0,
      );

      const toScreen = (world: THREE.Vector3) => {
        const p = world.clone().project(camera);
        return { x: (p.x + 1) * size.width / 2, y: (1 - p.y) * size.height / 2 };
      };

      let best: { t: Vec3; score: number; sign: 1 | -1 } | null = null;
      for (const t of tangents) {
        const worldT = new THREE.Vector3(...t).applyQuaternion(groupQuat);
        const a = toScreen(face.point);
        const b = toScreen(face.point.clone().add(worldT.multiplyScalar(0.6)));
        const sx = b.x - a.x;
        const sy = b.y - a.y;
        const dot = dx * sx + dy * sy;
        const mag = Math.abs(dot) / (Math.hypot(sx, sy) || 1);
        if (!best || mag > best.score) best = { t, score: mag, sign: dot >= 0 ? 1 : -1 };
      }
      faceDragRef.current = null;
      if (!best) return;

      const t: Vec3 = [best.t[0] * best.sign, best.t[1] * best.sign, best.t[2] * best.sign];
      const n = face.normal;
      // axis = n × t
      const axisVec: Vec3 = [
        n[1] * t[2] - n[2] * t[1],
        n[2] * t[0] - n[0] * t[2],
        n[0] * t[1] - n[1] * t[0],
      ];
      const axis = axisVec.findIndex(v => v !== 0) as Axis;
      if (axis < 0) return;
      const dir = (axisVec[axis] > 0 ? 1 : -1) as 1 | -1;
      const layer = face.cubiePos[axis] as -1 | 0 | 1;
      playMove({ axis, layer, dir });
      return;
    }

    const orbit = orbitRef.current;
    if (orbit) {
      setView({
        yaw: orbit.yaw + (e.clientX - orbit.x) * 0.009,
        pitch: Math.max(-1.2, Math.min(1.2, orbit.pitch + (e.clientY - orbit.y) * 0.007)),
      });
    }
  };

  const onPointerUp = () => {
    faceDragRef.current = null;
    orbitRef.current = null;
  };

  // ── Keyboard + button moves (view-independent face turns) ─────────────
  const FACE_KEYS: Record<string, { axis: Axis; layer: 1 | -1; label: string }> = {
    u: { axis: 1, layer: 1, label: 'Top' },
    d: { axis: 1, layer: -1, label: 'Bottom' },
    r: { axis: 0, layer: 1, label: 'Right' },
    l: { axis: 0, layer: -1, label: 'Left' },
    f: { axis: 2, layer: 1, label: 'Front' },
    b: { axis: 2, layer: -1, label: 'Back' },
  };

  const turnFace = (key: string, reversed: boolean) => {
    const f = FACE_KEYS[key];
    if (!f) return;
    playMove({ axis: f.axis, layer: f.layer, dir: reversed ? -1 : 1 });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (FACE_KEYS[k]) {
      e.preventDefault();
      turnFace(k, e.shiftKey !== reverse);
    }
  };

  if (!supported) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-5xl" aria-hidden>🧊</div>
        <h2 className="text-xl font-bold">Cube Twist needs 3D graphics</h2>
        <p className="text-text-muted text-sm max-w-xs">
          This game uses WebGL, which isn't available on this device or browser.
        </p>
      </div>
    );
  }

  if (!started) {
    // Guest waits for host to scramble into boardState
    if (isOnline && !isHost) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
          <div className="text-6xl" aria-hidden>🧊</div>
          <h2 className="text-2xl font-bold">Cube Twist</h2>
          <p className="text-sm text-text-muted text-center">
            Waiting for {oppAvatar} {oppName} to scramble the cube…
          </p>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-6xl" aria-hidden>🧊</div>
        <h2 className="text-2xl font-bold">Cube Twist</h2>
        <div className="bg-card rounded-xl p-4 max-w-xs w-full space-y-2 text-sm text-text-muted">
          <div className="flex items-start gap-2"><span>👆</span><span>Swipe across a face to twist that layer</span></div>
          <div className="flex items-start gap-2"><span>🔄</span><span>Drag the background to spin the whole cube</span></div>
          <div className="flex items-start gap-2"><span>⌨️</span><span>Keys work too: U D L R F B (+ Shift reverses)</span></div>
          <div className="flex items-start gap-2"><span>🏁</span><span>{isOnline ? 'First to solve the shared cube wins' : 'Make every side one solid color to win'}</span></div>
        </div>
        <p className="text-xs text-text-muted">
          {isOnline
            ? <>Online vs {oppAvatar} {oppName} · Stage {stage}: <span className="text-accent font-bold">{scrambleLen} scramble twists</span></>
            : <>Stage {stage}: <span className="text-accent font-bold">{scrambleLen} scramble twists</span></>}
        </p>
        <button
          onClick={start}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all"
        >
          Scramble & Start
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-2 justify-center py-2 text-xs flex-shrink-0 flex-wrap">
        <span className="bg-card rounded-lg px-3 py-1.5 font-bold text-accent">Moves: {moves}</span>
        <span className="bg-card rounded-lg px-3 py-1.5 font-bold text-text-muted">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </span>
        <span className="bg-card rounded-lg px-3 py-1.5 text-text-muted">Scramble: {scrambleLen}</span>
        {isOnline && (
          <span className={`rounded-lg px-3 py-1.5 font-bold ${isMyTurn ? 'bg-accent text-bg' : 'bg-card text-text-muted'}`}>
            {isMyTurn ? 'Your turn' : `${oppAvatar} ${oppName}'s turn`}
          </span>
        )}
      </div>

      <div
        className="flex-1 min-h-0 touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl mx-2"
        tabIndex={0}
        role="application"
        aria-roledescription="twisty cube"
        aria-label={`Cube Twist. ${moves} moves so far. ${isOnline ? (isMyTurn ? 'Your turn.' : `Waiting for ${oppName}.`) : ''} Keys U, D, L, R, F, B twist faces; hold Shift to reverse.`}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <Canvas camera={{ position: [4.4, 3.6, 5.6], fov: 40 }} dpr={[1, 2]}>
          <CameraBridge out={bridgeRef} />
          <CubeScene
            cube={cube}
            anim={anim}
            onAnimDone={onAnimDone}
            onFaceDragStart={onFaceDragStart}
            yaw={view.yaw}
            pitch={view.pitch}
            animMs={animMs}
          />
        </Canvas>
      </div>

      {/* Face buttons — tap-friendly and screen-reader friendly */}
      <div className="flex-shrink-0 px-3 py-2 space-y-1.5">
        <div className="flex gap-1.5 justify-center" role="group" aria-label="Face turns">
          {Object.entries(FACE_KEYS).map(([k, f]) => (
            <button
              key={k}
              onClick={() => turnFace(k, reverse)}
              disabled={isOnline && !isMyTurn}
              aria-label={`Turn ${f.label} face${reverse ? ' counterclockwise' : ''}`}
              className="game-cell w-10 h-10 bg-card hover:bg-card-hover rounded-xl text-sm font-black text-text transition-all active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30"
            >
              {k.toUpperCase()}{reverse ? '′' : ''}
            </button>
          ))}
          <button
            onClick={() => setReverse(r => !r)}
            role="switch"
            aria-checked={reverse}
            aria-label="Reverse direction"
            className={`w-10 h-10 rounded-xl text-sm font-black transition-all active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              reverse ? 'bg-accent text-bg' : 'bg-card hover:bg-card-hover text-text-muted'
            }`}
          >
            ↺
          </button>
        </div>
        <div className="flex gap-2 justify-center">
          {!isOnline && (
            <button
              onClick={undo}
              disabled={!canUndo || !!anim}
              className="text-xs font-semibold text-text-muted hover:text-text bg-card hover:bg-card-hover px-4 py-1.5 rounded-lg transition-colors disabled:opacity-30"
            >
              Undo
            </button>
          )}
          {!isOnline && (
            <button
              onClick={giveUp}
              className="text-xs font-semibold text-text-muted hover:text-danger bg-card hover:bg-card-hover px-4 py-1.5 rounded-lg transition-colors"
            >
              Give up
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CubeTwistGame;
