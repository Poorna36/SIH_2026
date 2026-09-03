import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { ScenePreset, CraterDetail, LayerVisibility } from '../../types';
import { getCraterCatalog } from '../../services/api';


// Procedural high-resolution crinkled gold thermal foil texture
function createGoldFoilTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const l = Math.random() * 14 + 3;
      const shade = Math.random() > 0.5 ? 'rgba(255, 235, 140, 0.4)' : 'rgba(70, 45, 0, 0.45)';
      ctx.strokeStyle = shade;
      ctx.lineWidth = Math.random() * 1.5 + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * l, y + (Math.random() - 0.5) * l);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Procedural photovoltaic solar array texture with silver busbars
function createSolarPanelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#06122c';
    ctx.fillRect(0, 0, 512, 256);

    const cols = 8;
    const rows = 4;
    const cellW = (512 - 20) / cols;
    const cellH = (256 - 16) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 10 + c * cellW + 1.5;
        const y = 8 + r * cellH + 1.5;
        const w = cellW - 3;
        const h = cellH - 3;

        ctx.fillStyle = '#0a1d4a';
        ctx.fillRect(x, y, w, h);

        ctx.strokeStyle = 'rgba(100, 180, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);

        ctx.strokeStyle = 'rgba(200, 230, 255, 0.7)';
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.33, y);
        ctx.lineTo(x + w * 0.33, y + h);
        ctx.moveTo(x + w * 0.66, y);
        ctx.lineTo(x + w * 0.66, y + h);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = '#99aabf';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 508, 252);
  }
  return new THREE.CanvasTexture(canvas);
}

export interface WebGlMoonViewerProps {
  onLaunchWorkbench?: () => void;
  isLaunching?: boolean;
  isWorkbenchMode?: boolean;
  selectedCrater?: ScenePreset | null;
  cameraZoom?: number;
  craters?: CraterDetail[];
  isDrawerOpen?: boolean;
  sunAzimuthDeg?: number;
  isOrbitTourActive?: boolean;
  onProbeLocation?: (lat: number, lon: number) => void;
  onSelectCrater?: (crater: CraterDetail | ScenePreset) => void;
  layers?: LayerVisibility;
}

export const WebGlMoonViewer: React.FC<WebGlMoonViewerProps> = ({
  isLaunching = false,
  isWorkbenchMode = false,
  selectedCrater = null,
  cameraZoom,
  craters = [],
  isDrawerOpen = false,
  sunAzimuthDeg = 68,
  isOrbitTourActive = false,
  onProbeLocation,
  layers,
  onSelectCrater,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // References for Three.js state
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const moonGroupRef = useRef<THREE.Group | null>(null);
  const satGroupRef = useRef<THREE.Group | null>(null);
  const starFieldRef = useRef<THREE.Points | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const craterPinsGroupRef = useRef<THREE.Group | null>(null);
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const probeBeaconRef = useRef<THREE.Group | null>(null);

  const targetRotationY = useRef(0);
  const targetRotationX = useRef(0);
  const isDragging = useRef(false);
  const previousPointerPosition = useRef({ x: 0, y: 0 });
  const pointerDownPos = useRef({ x: 0, y: 0 });
  const isLaunchingRef = useRef(isLaunching);
  const isWorkbenchModeRef = useRef(isWorkbenchMode);
  const isDrawerOpenRef = useRef(isDrawerOpen);
  const sunAzimuthRef = useRef(sunAzimuthDeg);
  const isOrbitTourActiveRef = useRef(isOrbitTourActive);
  const onProbeLocationRef = useRef(onProbeLocation);
  const onSelectCraterRef = useRef(onSelectCrater);
  const layersRef = useRef(layers);
  const gridGroupRef = useRef<THREE.Group | null>(null);
  const waterIceGroupRef = useRef<THREE.Group | null>(null);
  const moonMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const moonOffsetRef = useRef({ x: 1.48, y: 0 });
  const targetCameraZ = useRef(3.8);

  useEffect(() => {
    onSelectCraterRef.current = onSelectCrater;
  }, [onSelectCrater]);

  useEffect(() => {
    isDrawerOpenRef.current = isDrawerOpen;
  }, [isDrawerOpen]);

  useEffect(() => {
    isLaunchingRef.current = isLaunching;
  }, [isLaunching]);

  useEffect(() => {
    isWorkbenchModeRef.current = isWorkbenchMode;
  }, [isWorkbenchMode]);

  useEffect(() => {
    layersRef.current = layers;
    if (gridGroupRef.current) {
      gridGroupRef.current.visible = Boolean(layers?.grid);
    }
    if (waterIceGroupRef.current) {
      waterIceGroupRef.current.visible = Boolean(layers?.waterIce);
    }
    if (craterPinsGroupRef.current) {
      craterPinsGroupRef.current.visible = Boolean(layers?.craters ?? true);
    }
    if (moonMaterialRef.current) {
      if (layers?.dem) {
        moonMaterialRef.current.color.setHex(0xa8caff);
        moonMaterialRef.current.roughness = 0.65;
      } else {
        moonMaterialRef.current.color.setHex(0xdcd8d2);
        moonMaterialRef.current.roughness = 0.95;
      }
    }
  }, [layers]);

  useEffect(() => {
    sunAzimuthRef.current = sunAzimuthDeg;
    if (keyLightRef.current) {
      const rad = (sunAzimuthDeg * Math.PI) / 180;
      keyLightRef.current.position.set(6 * Math.cos(rad), 2.8, 6 * Math.sin(rad));
    }
  }, [sunAzimuthDeg]);

  useEffect(() => {
    isOrbitTourActiveRef.current = isOrbitTourActive;
  }, [isOrbitTourActive]);

  useEffect(() => {
    onProbeLocationRef.current = onProbeLocation;
  }, [onProbeLocation]);

  useEffect(() => {
    if (cameraZoom !== undefined) {
      targetCameraZ.current = cameraZoom;
    }
  }, [cameraZoom]);

  useEffect(() => {
    if (selectedCrater && isWorkbenchModeRef.current) {
      targetRotationY.current = (selectedCrater.lon) * (Math.PI / 180);
      targetRotationX.current = (-selectedCrater.lat) * (Math.PI / 180) * 0.4;
      targetCameraZ.current = 2.6;
    }
  }, [selectedCrater]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = mountRef.current;
    if (!canvas || !container) return;

    let animId: number;
    let width = container.clientWidth;
    let height = container.clientHeight;

    // 1. Full-Screen Scene & Perspective Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    let aspect = width / height;
    const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
    camera.position.set(0, 0, 5.0);
    cameraRef.current = camera;

    // Calculate Moon X position based on aspect ratio
    const updateMoonPosition = () => {
      const asp = container.clientWidth / container.clientHeight;
      if (asp > 1.3) {
        moonOffsetRef.current.x = 1.50;
        camera.position.z = 4.8;
      } else if (asp > 0.85) {
        moonOffsetRef.current.x = 1.48;
        camera.position.z = 5.2;
      } else {
        moonOffsetRef.current.x = 0.65;
        camera.position.z = 5.8;
      }
      if (moonGroupRef.current) {
        moonGroupRef.current.position.set(moonOffsetRef.current.x, 0, 0);
      }
    };

    // 2. High-Performance Hardware-Accelerated Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    // 3. Space Lighting calibrated to match Cesium's authentic NASA 8K lunar regolith illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfffef8, 1.1);
    const initialRad = (sunAzimuthRef.current * Math.PI) / 180;
    keyLight.position.set(6 * Math.cos(initialRad), 2.8, 6 * Math.sin(initialRad));
    scene.add(keyLight);
    keyLightRef.current = keyLight;

    const fillLight = new THREE.DirectionalLight(0xbfbcb5, 0.45);
    fillLight.position.set(-4, -2, 3);
    scene.add(fillLight);

    // 4. Hardware-Accelerated 3D WebGL Stars (optimized count)
    const starCount = 1000;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      starPositions[i3] = (Math.random() - 0.5) * 70;
      starPositions[i3 + 1] = (Math.random() - 0.5) * 70;
      starPositions[i3 + 2] = (Math.random() - 0.5) * 70;

      const choice = Math.random();
      if (choice > 0.7) {
        starColors[i3] = 0.45; starColors[i3 + 1] = 0.75; starColors[i3 + 2] = 1.0; // Electric blue star
      } else if (choice > 0.45) {
        starColors[i3] = 1.0; starColors[i3 + 1] = 0.95; starColors[i3 + 2] = 0.85; // Warm gold star
      } else {
        starColors[i3] = 0.95; starColors[i3 + 1] = 0.95; starColors[i3 + 2] = 0.95; // Crisp white star
      }
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });

    const starField = new THREE.Points(starGeo, starMat);
    starFieldRef.current = starField;
    scene.add(starField);

    // 5. Main Moon Group - Optimized smooth geometry
    const moonGroup = new THREE.Group();
    moonGroupRef.current = moonGroup;
    updateMoonPosition();
    scene.add(moonGroup);

    const radius = 0.95;
    const moonGeometry = new THREE.SphereGeometry(radius, 64, 64);

    const textureLoader = new THREE.TextureLoader();
    const moonTexture = textureLoader.load('/assets/moon_global_4k.jpg');
    moonTexture.colorSpace = THREE.SRGBColorSpace;
    moonTexture.generateMipmaps = true;
    moonTexture.minFilter = THREE.LinearMipmapLinearFilter;
    moonTexture.magFilter = THREE.LinearFilter;

    const moonMaterial = new THREE.MeshStandardMaterial({
      map: moonTexture,
      roughness: 0.95,
      metalness: 0.0,
      color: 0xdcd8d2,
    });

    const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
    // Align with Cesium's canonical Near Side orientation (Mare Imbrium, Oceanus Procellarum, Tycho)
    moonMesh.rotation.y = -Math.PI / 2;
    moonGroup.add(moonMesh);
    moonMaterialRef.current = moonMaterial;

    // Selenographic Coordinate Grid (Lat/Lon parallels and meridians)
    const gridGroup = new THREE.Group();
    gridGroup.visible = Boolean(layersRef.current?.grid);
    gridGroupRef.current = gridGroup;
    moonMesh.add(gridGroup);

    const gridMat = new THREE.LineBasicMaterial({
      color: 0x4aa3ff,
      transparent: true,
      opacity: 0.35,
    });

    [-60, -30, 0, 30, 60].forEach((latDeg) => {
      const latR = (latDeg * Math.PI) / 180;
      const circleR = radius * 1.003 * Math.cos(latR);
      const circleY = radius * 1.003 * Math.sin(latR);
      const circleGeo = new THREE.BufferGeometry();
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * circleR, circleY, Math.sin(a) * circleR));
      }
      circleGeo.setFromPoints(pts);
      gridGroup.add(new THREE.Line(circleGeo, gridMat));
    });

    for (let lonDeg = 0; lonDeg < 180; lonDeg += 30) {
      const lonR = (lonDeg * Math.PI) / 180;
      const meridianGeo = new THREE.BufferGeometry();
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(
          Math.sin(a) * radius * 1.003 * Math.cos(lonR),
          Math.cos(a) * radius * 1.003,
          Math.sin(a) * radius * 1.003 * Math.sin(lonR)
        ));
      }
      meridianGeo.setFromPoints(pts);
      gridGroup.add(new THREE.Line(meridianGeo, gridMat));
    }

    // Water Ice Cryogenic Traps Overlay (Polar Caps)
    const waterIceGroup = new THREE.Group();
    waterIceGroup.visible = Boolean(layersRef.current?.waterIce);
    waterIceGroupRef.current = waterIceGroup;
    moonMesh.add(waterIceGroup);

    const southCryoCap = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.05, radius * 0.38, 32),
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      })
    );
    southCryoCap.rotation.x = Math.PI / 2;
    southCryoCap.position.y = -radius * 0.985;
    waterIceGroup.add(southCryoCap);

    const northCryoCap = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.05, radius * 0.38, 32),
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      })
    );
    northCryoCap.rotation.x = Math.PI / 2;
    northCryoCap.position.y = radius * 0.985;
    waterIceGroup.add(northCryoCap);

    // 3D Glowing Crater Pins on Lunar Surface
    const craterPinsGroup = new THREE.Group();
    craterPinsGroupRef.current = craterPinsGroup;
    craterPinsGroup.visible = Boolean(layersRef.current?.craters ?? true) && isWorkbenchModeRef.current;
    moonMesh.add(craterPinsGroup);

    // 3D Glowing Surface Probe Beacon
    const probeBeacon = new THREE.Group();
    probeBeacon.visible = false;
    moonMesh.add(probeBeacon);
    probeBeaconRef.current = probeBeacon;

    const probeDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x00ffff })
    );
    probeBeacon.add(probeDot);

    const probeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.032, 0.046, 32),
      new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    probeRing.rotation.x = Math.PI / 2;
    probeBeacon.add(probeRing);

    const renderCraterDots = (items: CraterDetail[]) => {
      while (craterPinsGroup.children.length > 0) {
        craterPinsGroup.remove(craterPinsGroup.children[0]);
      }
      items.forEach((crater) => {
        const latRad = (crater.lat * Math.PI) / 180;
        const lonRad = ((crater.lon - 90) * Math.PI) / 180;
        const r = radius * 1.004;
        const px = r * Math.cos(latRad) * Math.sin(lonRad);
        const py = r * Math.sin(latRad);
        const pz = r * Math.cos(latRad) * Math.cos(lonRad);

        const dotGeo = new THREE.SphereGeometry(0.018, 12, 12);
        const dotMat = new THREE.MeshBasicMaterial({
          color: (crater.waterAbsorptionDepthPct ?? 0) > 10 ? 0x38bdf8 : 0xfdba74,
        });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.userData = { crater };
        dot.position.set(px, py, pz);
        craterPinsGroup.add(dot);
      });
    };

    if (craters && craters.length > 0) {
      renderCraterDots(craters);
    } else {
      getCraterCatalog().then((list) => {
        if (list && list.length > 0) {
          renderCraterDots(
            list.map((c) => ({
              id: c.id,
              name: c.name,
              lat: c.lat,
              lon: c.lon,
              height: c.height,
              diameterKm: c.diameter_km,
              depthKm: c.depth_km,
              region: c.region,
              floorInclinationDeg: c.floor_inclination_deg,
              wallSlopeDeg: c.wall_slope_deg,
              orbitInclinationDeg: c.orbit_inclination_deg,
              solarIncidenceDeg: c.solar_incidence_deg,
              solarAzimuthDeg: c.solar_azimuth_deg,
              waterAbsorptionDepthPct: c.water_absorption_depth_pct,
              waterIceConcentrationWtPct: c.water_ice_concentration_wt_pct,
              waterIcePpm: c.water_ice_ppm,
              psrStatus: c.psr_status as any,
              subsurfaceHydrationLevel: c.subsurface_hydration_level as any,
              surfaceTempKelvin: c.surface_temp_kelvin,
              frostIndex: c.frost_index,
              spectrometerBand: c.spectrometer_band,
              description: c.description,
            }))
          );
        }
      });
    }

    // 6. Genuine Physical 3D Chandrayaan-2 Model (75% scale)
    const satGroup = new THREE.Group();
    satGroup.scale.set(0.75, 0.75, 0.75);
    satGroupRef.current = satGroup;

    // Materials
    const goldFoilTex = createGoldFoilTexture();
    const solarTex = createSolarPanelTexture();

    const goldFoilMat = new THREE.MeshStandardMaterial({
      map: goldFoilTex,
      color: 0xffd700,
      metalness: 0.90,
      roughness: 0.28,
    });

    const busChassisMat = new THREE.MeshStandardMaterial({
      color: 0x222226,
      metalness: 0.85,
      roughness: 0.2,
    });

    const solarPanelMat = new THREE.MeshStandardMaterial({
      map: solarTex,
      metalness: 0.7,
      roughness: 0.22,
    });

    const dishMat = new THREE.MeshStandardMaterial({
      color: 0xf5f5f7,
      metalness: 0.4,
      roughness: 0.3,
    });

    // Central Avionics Bus Core
    const busMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.24), goldFoilMat);
    satGroup.add(busMesh);

    // Structural equipment deck collars
    const topDeck = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.04, 0.185), busChassisMat);
    topDeck.position.y = 0.10;
    satGroup.add(topDeck);

    const bottomDeck = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.03, 0.185), busChassisMat);
    bottomDeck.position.y = -0.10;
    satGroup.add(bottomDeck);

    // Dual High-Resolution Solar Array Wings (textured silicon cells)
    const wingGeo = new THREE.BoxGeometry(0.48, 0.012, 0.20);

    const leftWing = new THREE.Mesh(wingGeo, solarPanelMat);
    leftWing.position.x = -0.34;
    satGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, solarPanelMat);
    rightWing.position.x = 0.34;
    satGroup.add(rightWing);

    // Gold solar panel hinge struts
    const hingeGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.10);
    const leftHinge = new THREE.Mesh(hingeGeo, goldFoilMat);
    leftHinge.rotation.z = Math.PI / 2;
    leftHinge.position.x = -0.12;
    satGroup.add(leftHinge);

    const rightHinge = new THREE.Mesh(hingeGeo, goldFoilMat);
    rightHinge.rotation.z = Math.PI / 2;
    rightHinge.position.x = 0.12;
    satGroup.add(rightHinge);

    // Optical High-Resolution Camera (OHRC) Payload Lens pointing down (nadir)
    const ohrcBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 0.12, 16),
      new THREE.MeshStandardMaterial({ color: 0x111115, metalness: 0.95, roughness: 0.1 })
    );
    ohrcBarrel.position.set(0, -0.14, 0);
    satGroup.add(ohrcBarrel);

    // Steerable High-Gain Parabolic Dish Antenna
    const dishGroup = new THREE.Group();
    const dishMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.02, 0.035, 20),
      dishMat
    );
    dishGroup.add(dishMesh);

    // Feed horn sub-reflector tripod
    const feedHorn = new THREE.Mesh(
      new THREE.ConeGeometry(0.02, 0.04, 8),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 })
    );
    feedHorn.position.y = 0.03;
    dishGroup.add(feedHorn);

    dishGroup.position.set(0, 0.14, 0.08);
    dishGroup.rotation.x = Math.PI / 3.5;
    satGroup.add(dishGroup);

    // 4 Corner Reaction Control Thruster (RCS) pods
    const thrusterMat = new THREE.MeshStandardMaterial({ color: 0x888890, metalness: 0.8, roughness: 0.2 });
    const thrusterCorners = [
      [0.08, -0.08, 0.10],
      [-0.08, -0.08, 0.10],
      [0.08, -0.08, -0.10],
      [-0.08, -0.08, -0.10],
    ];
    thrusterCorners.forEach(([tx, ty, tz]) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.03, 8), thrusterMat);
      cone.position.set(tx, ty, tz);
      cone.rotation.x = Math.PI;
      satGroup.add(cone);
    });

    // Active Cyan Telemetry Beacon LED
    const beaconLight = new THREE.PointLight(0x00f0ff, 3.0, 2.0);
    beaconLight.position.set(0, 0.16, -0.12);
    satGroup.add(beaconLight);

    const beaconDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x00ffff })
    );
    beaconDot.position.copy(beaconLight.position);
    satGroup.add(beaconDot);

    scene.add(satGroup);

    // 7. Raycaster: Only rotate when dragging directly on or near the Moon!
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e: PointerEvent) => {
      if (isDrawerOpenRef.current) return;
      if ((e.target as HTMLElement)?.closest('[data-sidebar], .sidebar-scroll, [role="dialog"], button, a, input, select, textarea')) return;

      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects([moonMesh], true);

      const moonScreenPos = moonGroup.position.clone().project(camera);
      const distToMoon = Math.hypot(mouse.x - moonScreenPos.x, mouse.y - moonScreenPos.y);

      if (isWorkbenchModeRef.current) {
        isDragging.current = true;
        previousPointerPosition.current = { x: e.clientX, y: e.clientY };
        pointerDownPos.current = { x: e.clientX, y: e.clientY };
      } else {
        if (intersects.length > 0 || distToMoon < 0.28) {
          isDragging.current = true;
          previousPointerPosition.current = { x: e.clientX, y: e.clientY };
          pointerDownPos.current = { x: e.clientX, y: e.clientY };
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging.current || !moonGroupRef.current) return;
      const deltaX = e.clientX - previousPointerPosition.current.x;
      const deltaY = e.clientY - previousPointerPosition.current.y;

      targetRotationY.current += deltaX * 0.005;
      targetRotationX.current += deltaY * 0.005;
      targetRotationX.current = Math.max(-0.6, Math.min(0.6, targetRotationX.current));

      previousPointerPosition.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      isDragging.current = false;
      const dist = Math.hypot(e.clientX - pointerDownPos.current.x, e.clientY - pointerDownPos.current.y);
      if (dist < 6 && isWorkbenchModeRef.current && cameraRef.current) {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, cameraRef.current);

        // 1. Check if user clicked on a 3D crater pin
        if (craterPinsGroupRef.current && craterPinsGroupRef.current.visible) {
          const pinIntersects = raycaster.intersectObjects(craterPinsGroupRef.current.children);
          if (pinIntersects.length > 0) {
            const crater = pinIntersects[0].object.userData?.crater;
            if (crater) {
              onSelectCraterRef.current?.(crater);
              return;
            }
          }
        }

        // 2. Click on general lunar surface to probe coordinates
        const intersects = raycaster.intersectObject(moonMesh);
        if (intersects.length > 0) {
          const pt = intersects[0].point.clone();
          moonMesh.worldToLocal(pt);
          const r = pt.length();
          const lat = Math.asin(Math.max(-1, Math.min(1, pt.y / r))) * (180 / Math.PI);
          const lon = Math.atan2(pt.x, pt.z) * (180 / Math.PI);

          if (probeBeaconRef.current) {
            probeBeaconRef.current.position.copy(pt.clone().normalize().multiplyScalar(radius * 1.015));
            probeBeaconRef.current.visible = true;
          }

          onProbeLocationRef.current?.(parseFloat(lat.toFixed(2)), parseFloat(lon.toFixed(2)));
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (!isWorkbenchModeRef.current || isDrawerOpenRef.current) return;
      if ((e.target as HTMLElement)?.closest('[data-sidebar], .sidebar-scroll, [role="dialog"], button, a, input, select, textarea')) return;
      e.preventDefault();
      const zoomStep = e.deltaY * 0.003;
      targetCameraZ.current = Math.max(2.2, Math.min(6.5, targetCameraZ.current + zoomStep));
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('wheel', handleWheel, { passive: false });

    // Responsive Canvas Resize
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      width = container.clientWidth;
      height = container.clientHeight;
      aspect = width / height;
      camera.aspect = aspect;
      updateMoonPosition();
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // 8. Animation Loop
    let orbitAngle = 0;
    const orbitRadius = radius * 1.55; // 1.47 units
    const orbitInclination = Math.PI / 3.8;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Do not waste GPU/CPU cycles when tab is inactive
      if (document.hidden) return;

      const delta = Math.min(clock.getDelta(), 0.1);
      const currentMoonX = moonOffsetRef.current.x;

      if (craterPinsGroupRef.current) {
        craterPinsGroupRef.current.visible = isWorkbenchModeRef.current;
      }

      // Moon Rotation
      if (moonGroupRef.current) {
        if (!isDragging.current) {
          if (isLaunchingRef.current) {
            targetRotationY.current = THREE.MathUtils.lerp(targetRotationY.current, 0, 0.1);
            targetRotationX.current = THREE.MathUtils.lerp(targetRotationX.current, 0, 0.1);
          } else if (!isWorkbenchModeRef.current) {
            targetRotationY.current += 0.075 * delta;
          } else if (isOrbitTourActiveRef.current) {
            targetRotationY.current += 0.12 * delta;
          }
        }

        moonGroupRef.current.rotation.y +=
          (targetRotationY.current - moonGroupRef.current.rotation.y) * 0.08;
        moonGroupRef.current.rotation.x +=
          (targetRotationX.current - moonGroupRef.current.rotation.x) * 0.08;
      }

      // Real 3D Satellite Attitude & Orbit: Only on landing page (smoothly hidden in backend workbench)
      if (satGroupRef.current) {
        const targetScale = isWorkbenchModeRef.current ? 0.0 : (isLaunchingRef.current ? 0.25 : 0.75);
        satGroupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
        satGroupRef.current.visible = satGroupRef.current.scale.x > 0.01;

        if (satGroupRef.current.visible) {
          // (2 * Math.PI) / 20.0 = 0.314159 rad/sec -> 1 full orbit every 20 seconds!
          const orbitSpeed = isLaunchingRef.current ? 1.2 : (Math.PI * 2) / 20.0;
          orbitAngle += orbitSpeed * delta;
          const rawX = Math.cos(orbitAngle) * orbitRadius;
          const rawZ = Math.sin(orbitAngle) * orbitRadius;
          const satPos = new THREE.Vector3(rawX, 0, rawZ);
          satPos.applyAxisAngle(new THREE.Vector3(1, 0.2, 0).normalize(), orbitInclination);

          satGroupRef.current.position.set(
            currentMoonX + satPos.x,
            satPos.y,
            satPos.z
          );

          // Nadir pointing: camera points at Moon center, solar panels catch sunlight
          satGroupRef.current.lookAt(currentMoonX, 0, 0);
          satGroupRef.current.rotateZ(orbitAngle * 0.15);
        }
      }

      // Smooth glide to center on Launch or in workbench mode!
      if (isWorkbenchModeRef.current || isLaunchingRef.current) {
        moonOffsetRef.current.x = THREE.MathUtils.lerp(moonOffsetRef.current.x, 0.0, 0.08);
      } else {
        const asp = container.clientWidth / container.clientHeight;
        const targetX = asp > 1.3 ? 1.50 : asp > 0.85 ? 1.48 : 0.65;
        moonOffsetRef.current.x = THREE.MathUtils.lerp(moonOffsetRef.current.x, targetX, 0.08);
      }
      if (moonGroupRef.current) {
        moonGroupRef.current.position.x = moonOffsetRef.current.x;
      }

      // WebGL Stars subtle drift
      if (starFieldRef.current) {
        starFieldRef.current.rotation.y += 0.0002;
        starFieldRef.current.rotation.x += 0.0001;
      }

      // Camera: smoothly transitions to center and matches the Cesium Workbench Moon scale (Z = 3.8)
      if (cameraRef.current) {
        if (isWorkbenchModeRef.current) {
          cameraRef.current.position.lerp(new THREE.Vector3(0, 0, targetCameraZ.current), 0.08);
        } else if (isLaunchingRef.current) {
          cameraRef.current.position.lerp(new THREE.Vector3(0, 0, 3.8), 0.08);
        } else {
          const asp = container.clientWidth / container.clientHeight;
          const defaultZ = asp > 1.3 ? 4.8 : asp > 0.85 ? 5.2 : 5.8;
          cameraRef.current.position.lerp(new THREE.Vector3(0, 0, defaultZ), 0.05);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('wheel', handleWheel);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full h-full pointer-events-auto select-none overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
    </div>
  );
};
