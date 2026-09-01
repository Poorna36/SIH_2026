import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import {
  Eye, EyeOff, Compass, Layers, ZoomIn, ZoomOut, RotateCcw,
  Mountain, Droplets, Orbit, Check, X, Maximize2
} from 'lucide-react';
import type { ScenePreset, LayerVisibility, CraterDetail } from '../types';
import { CRATER_DETAILS, SCENE_PRESETS } from '../data/mockData';

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN || '';

interface CesiumViewerProps {
  selectedScene: ScenePreset;
  layers: LayerVisibility;
  onLayerChange: (layers: LayerVisibility) => void;
  onSelectScene?: (scene: ScenePreset) => void;
}

interface LayerConfig {
  key: keyof LayerVisibility;
  label: string;
  color: string;
}

const LAYER_CONFIG: LayerConfig[] = [
  { key: 'ohrc', label: 'OHRC 0.3m Warp', color: 'text-emerald-300' },
  { key: 'tmc2Slope', label: 'TMC-2 3D Slope', color: 'text-teal-300' },
  { key: 'iirsHyperspectral', label: 'IIRS Hyperspectral', color: 'text-orange-300' },
  { key: 'slzOverlay', label: 'SLZ Safe Zone', color: 'text-amber-300' },
];

const MOON_ELLIPSOID = Cesium.Ellipsoid.MOON;

// Helper to compute physically accurate Rectangles scaled to each crater's true landing / imaging swath
// Clamps max swath to realistic Chandrayaan-2 / SLZ study area (max 28 km) so maria (873 km) and giant basins don't produce giant billboard boxes
function computeAccurateCraterRectangle(
  lat: number,
  lon: number,
  diameterKm: number,
  scaleMultiplier: number = 1.05
): Cesium.Rectangle {
  const KM_PER_DEG_LAT = 30.323; // Lunar circumference / 360 = (2 * PI * 1737.4) / 360 = 30.323 km / deg
  
  // Real Chandrayaan-2 OHRC / SLZ landing footprint is localized (max ~28 km for sub-crater study sites)
  const trueFootprintKm = Math.min(diameterKm, 28.0) * scaleMultiplier;
  const radiusKm = trueFootprintKm / 2;

  // Latitude span (north/south) in degrees
  const deltaLat = radiusKm / KM_PER_DEG_LAT;

  // Longitude span (east/west) adjusted for lunar latitude convergence
  const latRad = Cesium.Math.toRadians(Math.min(Math.abs(lat), 87.5));
  const cosLat = Math.max(Math.cos(latRad), 0.15);
  const deltaLon = Math.min(deltaLat / cosLat, 4.5);

  const south = Math.max(-89.98, lat - deltaLat);
  const north = Math.min(89.98, lat + deltaLat);
  const west = Math.max(-180, lon - deltaLon);
  const east = Math.min(180, lon + deltaLon);

  return Cesium.Rectangle.fromDegrees(west, south, east, north);
}

export const CesiumViewer: React.FC<CesiumViewerProps> = ({
  selectedScene,
  layers,
  onLayerChange,
  onSelectScene,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const ohrcLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const iirsLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const tmc2LayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const pinEntityRef = useRef<Cesium.Entity | null>(null);
  const craterEntitiesRef = useRef<Cesium.Entity[]>([]);
  // Ground-view refs — DOM updates only, zero React re-renders in the 60fps loop
  const groundListenerRef = useRef<(() => void) | null>(null);
  const groundHeadingRef = useRef(0);

  const [isFlying, setIsFlying] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  // Start with NO crater pre-selected — clean global Moon model at launch
  const [selectedCrater, setSelectedCrater] = useState<CraterDetail | null>(null);
  const [showInspector, setShowInspector] = useState(false);
  const [isGroundMode, setIsGroundMode] = useState(false);
  const groundDragRef = useRef<{ active: boolean; x: number; y: number } | null>(null);

  // Inspection Altitude Modes: 'global' (4200km full Moon) | 'survey' (160km) | 'recon' (24km 3D close-up)
  const [reconMode, setReconMode] = useState<'global' | 'survey' | 'recon'>('global');

  // Update dynamic OHRC / IIRS draping layers when selected crater changes
  const updateCraterDrapeLayers = useCallback((crater: CraterDetail) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Remove previous local layers
    if (ohrcLayerRef.current) {
      viewer.imageryLayers.remove(ohrcLayerRef.current, true);
      ohrcLayerRef.current = null;
    }
    if (iirsLayerRef.current) {
      viewer.imageryLayers.remove(iirsLayerRef.current, true);
      iirsLayerRef.current = null;
    }

    // Compute physically accurate bounds matching the crater's real diameter in km
    // OHRC covers the crater floor + rim (1.05x crater diameter)
    const ohrcRect = computeAccurateCraterRectangle(crater.lat, crater.lon, crater.diameterKm, 1.05);
    // IIRS hyperspectral swath covers the crater floor + surrounding ejecta blanket (1.30x crater diameter)
    const iirsRect = computeAccurateCraterRectangle(crater.lat, crater.lon, crater.diameterKm, 1.30);

    // 0.3m OHRC Ultra-Res Local Crater Drape — exact true-scale crater overlay
    Cesium.SingleTileImageryProvider.fromUrl('/assets/ohrc.jpg?v=forest_4k', {
      rectangle: ohrcRect,
      ellipsoid: MOON_ELLIPSOID,
    }).then((provider) => {
      if (!viewer.isDestroyed()) {
        const layer = viewer.imageryLayers.addImageryProvider(provider);
        layer.alpha = 0.98;
        layer.show = layers.ohrc;
        ohrcLayerRef.current = layer;
      }
    });

    // IIRS Hyperspectral Thermal Drape — calibrated to exact crater extent
    Cesium.SingleTileImageryProvider.fromUrl('/assets/iirs.jpg', {
      rectangle: iirsRect,
      ellipsoid: MOON_ELLIPSOID,
    }).then((provider) => {
      if (!viewer.isDestroyed()) {
        const layer = viewer.imageryLayers.addImageryProvider(provider);
        layer.alpha = 0.7;
        layer.show = layers.iirsHyperspectral;
        iirsLayerRef.current = layer;
      }
    });
  }, [layers.ohrc, layers.iirsHyperspectral]);

  // Stable ref so the click handler inside useEffect always calls the latest version
  const rotateToCraterRef = useRef<(crater: CraterDetail, mode?: 'global' | 'survey' | 'recon') => void>(() => {});

  // 3-phase cinematic animation: zoom out → rotate to crater → dive in
  const rotateToCrater = useCallback((crater: CraterDetail, mode: 'global' | 'survey' | 'recon' = 'recon') => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // ── 1. Stop any ground-mode rotation & reset camera transform ──
    if (groundListenerRef.current) {
      groundListenerRef.current();
      groundListenerRef.current = null;
    }
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    setIsGroundMode(false);

    // ── 2. Cancel any in-progress camera animation ──
    viewer.camera.cancelFlight();

    // ── 3. Update UI state immediately ──
    setSelectedCrater(crater);
    setShowInspector(true);
    setReconMode(mode);
    setIsFlying(true);

    const craterRadiusMeters = (crater.diameterKm * 1000) / 2;
    let targetAltitude: number;
    if (mode === 'recon') {
      targetAltitude = Math.max(55000, craterRadiusMeters * 2.6);
    } else if (mode === 'survey') {
      targetAltitude = Math.max(200000, craterRadiusMeters * 5.0);
    } else {
      targetAltitude = 4200000;
    }

    // ── Phase 1: Zoom out to global Moon view (0.9s) ──
    const globalView = Cesium.Cartesian3.fromDegrees(
      crater.lon, crater.lat, 4_200_000, MOON_ELLIPSOID
    );
    viewer.camera.flyTo({
      destination: globalView,
      orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
      duration: 1.2,
      easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
      complete: () => {
        // ── Phase 2: Rotate Moon to place crater at center (0.8s) ──
        const rotatedView = Cesium.Cartesian3.fromDegrees(
          crater.lon, crater.lat, 3_800_000, MOON_ELLIPSOID
        );
        viewer.camera.flyTo({
          destination: rotatedView,
          orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
          duration: 1.1,
          easingFunction: Cesium.EasingFunction.LINEAR_NONE,
          complete: () => {
            // ── Phase 3: Dive down into crater (1.4s) ──
            updateCraterDrapeLayers(crater);
            const diveDestination = Cesium.Cartesian3.fromDegrees(
              crater.lon, crater.lat, targetAltitude, MOON_ELLIPSOID
            );
            viewer.camera.flyTo({
              destination: diveDestination,
              orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
              duration: 2.6,
              easingFunction: Cesium.EasingFunction.QUADRATIC_IN,
              complete: () => setIsFlying(false),
              cancel: () => setIsFlying(false),
            });
          },
          cancel: () => setIsFlying(false),
        });
      },
      cancel: () => setIsFlying(false),
    });
  }, [updateCraterDrapeLayers]);

  // Keep the ref in sync with the latest callback so the useEffect click handler is never stale
  useEffect(() => {
    rotateToCraterRef.current = rotateToCrater;
  }, [rotateToCrater]);

  // Initialize Cesium on Mount
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    try {
      const viewer = new Cesium.Viewer(containerRef.current, {
        timeline: false,
        animation: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        homeButton: false,
        geocoder: false,
        sceneModePicker: false,
        projectionPicker: false,
        infoBox: false,
        selectionIndicator: false,
        fullscreenButton: false,
        vrButton: false,
        requestRenderMode: false,
        globe: new Cesium.Globe(MOON_ELLIPSOID),
        terrainProvider: new Cesium.EllipsoidTerrainProvider({ ellipsoid: MOON_ELLIPSOID }),
        contextOptions: {
          webgl: {
            alpha: false,
            depth: true,
            stencil: false,
            antialias: true,
            powerPreference: 'high-performance',
          },
        },
      });

      // ── HIGH-QUALITY RENDERING ──
      viewer.resolutionScale = window.devicePixelRatio || 1.0; // Use native display DPI for crispness
      viewer.scene.globe.maximumScreenSpaceError = 1.0; // Maximum sub-pixel sharpness across all zoom levels
      viewer.scene.globe.tileCacheSize = 2000;
      viewer.scene.globe.loadingDescendantLimit = 64;
      viewer.scene.globe.depthTestAgainstTerrain = false; // prevents imagery cut-off near surface
      viewer.scene.msaaSamples = 4; // 4x MSAA anti-aliasing for smoother edges

      // ── ULTRA-SMOOTH MOUSE / TOUCH INTERACTIONS ──
      const controller = viewer.scene.screenSpaceCameraController;

      // Zoom: smooth scroll-to-zoom at all altitudes
      controller.minimumZoomDistance = 800;   // allow zooming to 800 m above surface
      controller.maximumZoomDistance = 8_000_000; // max pull-back 8,000 km
      controller.zoomEventTypes = [
        Cesium.CameraEventType.RIGHT_DRAG,
        Cesium.CameraEventType.WHEEL,
        Cesium.CameraEventType.PINCH,
      ];
      controller.tiltEventTypes = [
        Cesium.CameraEventType.MIDDLE_DRAG,
        Cesium.CameraEventType.PINCH,
        { eventType: Cesium.CameraEventType.LEFT_DRAG, modifier: Cesium.KeyboardEventModifier.CTRL },
      ];
      // Higher inertia = smoother, gliding zoom/pan feel instead of jerky steps
      controller.inertiaZoom = 0.65;
      controller.inertiaTranslate = 0.55;
      controller.inertiaSpin = 0.7;     // smooth spin-drag momentum
      controller.maximumMovementRatio = 0.04; // prevents jarring camera jumps at low altitudes
      controller.enableCollisionDetection = false; // allow camera below globe surface threshold

      // Clear default imagery
      viewer.imageryLayers.removeAll();

      // Configure Moon Globe — warm neutral grey, zero blue atmosphere haze
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#020604');
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#8A8580'); // Warm regolith grey — NO blue tint
      viewer.scene.globe.enableLighting = false;
      viewer.scene.globe.showGroundAtmosphere = false;
      viewer.scene.fog.enabled = false; // Kill Cesium's distance fog that adds blue haze at close range
      viewer.scene.globe.atmosphereLightIntensity = 0; // Zero atmospheric scattering
      viewer.scene.globe.atmosphereRayleighScaleHeight = 0;
      viewer.scene.globe.atmosphereMieScaleHeight = 0;

      if (viewer.scene.skyAtmosphere) {
        viewer.scene.skyAtmosphere.show = false;
      }
      if (viewer.scene.skyBox) {
        viewer.scene.skyBox.show = false; // No skybox — pure deep space black
      }
      if (viewer.scene.sun) {
        viewer.scene.sun.show = false; // No sun lens flare
      }
      if (viewer.scene.moon) {
        viewer.scene.moon.show = false; // Hide Cesium's default moon (we ARE the moon)
      }

      // High-contrast directional illumination for crisp micro-crater relief
      viewer.scene.light = new Cesium.DirectionalLight({
        direction: new Cesium.Cartesian3(0.5, 0.5, -0.7),
        color: Cesium.Color.fromCssColorString('#FFFFFF'),
        intensity: 2.2,
      });

      // ── 1. PRIMARY: Full-sphere Moon Global Basemap (NASA 8K LROC Master Dataset) ──
      Cesium.SingleTileImageryProvider.fromUrl('/assets/moon_global.jpg?v=nasa_8k_master', {
        rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
        ellipsoid: MOON_ELLIPSOID,
      }).then((provider) => {
        if (!viewer.isDestroyed()) {
          const globalLayer = viewer.imageryLayers.addImageryProvider(provider);
          globalLayer.alpha = 1.0;
        }
      });

      // ── 2. TMC-2 3D Slope Elevation Grid Layer ──
      const tmc2SlopeProvider = new Cesium.GridImageryProvider({
        color: Cesium.Color.fromCssColorString('rgba(52, 211, 153, 0.35)'),
        glowColor: Cesium.Color.fromCssColorString('rgba(16, 185, 129, 0.15)'),
        cells: 16,
      });
      const tmc2Layer = viewer.imageryLayers.addImageryProvider(tmc2SlopeProvider);
      tmc2Layer.show = layers.tmc2Slope;
      tmc2LayerRef.current = tmc2Layer;

      // ── 3. Add Interactive 3D Markers & Landing Targets for All Lunar Craters ──
      const createdEntities: Cesium.Entity[] = [];
      CRATER_DETAILS.forEach((crater) => {
        const isSelected = crater.id === selectedScene.id;
        const craterEntity = viewer.entities.add({
          id: `crater_${crater.id}`,
          position: Cesium.Cartesian3.fromDegrees(crater.lon, crater.lat, 1000, MOON_ELLIPSOID),
          point: {
            pixelSize: isSelected ? 13 : 8,
            color: Cesium.Color.fromCssColorString(crater.waterAbsorptionDepthPct > 10 ? '#38BDF8' : '#FDBA74'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          ellipse: {
            semiMajorAxis: Math.min((crater.diameterKm * 1000) / 2, 45000),
            semiMinorAxis: Math.min((crater.diameterKm * 1000) / 2, 45000),
            material: Cesium.Color.fromCssColorString(
              crater.waterAbsorptionDepthPct > 10 ? 'rgba(56, 189, 248, 0.18)' : 'rgba(52, 211, 153, 0.15)'
            ),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString(crater.waterAbsorptionDepthPct > 10 ? '#38BDF8' : '#FDBA74'),
            outlineWidth: 1.5,
          },
          label: {
            text: `${crater.name} (${crater.waterAbsorptionDepthPct}% H2O)`,
            font: 'bold 11px "JetBrains Mono", monospace',
            fillColor: Cesium.Color.fromCssColorString('#FFFFFF'),
            outlineColor: Cesium.Color.fromCssColorString('#022C22'),
            outlineWidth: 4,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -14),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        createdEntities.push(craterEntity);
      });
      craterEntitiesRef.current = createdEntities;

      // ── 4. Active Mission Target Pin ──
      const pin = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          selectedScene.lon,
          selectedScene.lat,
          800,
          MOON_ELLIPSOID
        ),
        point: {
          pixelSize: 12,
          color: Cesium.Color.fromCssColorString('#FDBA74'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `SLZ TARGET: ${selectedScene.name}`,
          font: 'bold 12px "JetBrains Mono", monospace',
          fillColor: Cesium.Color.fromCssColorString('#FDBA74'),
          outlineColor: Cesium.Color.fromCssColorString('#064E3B'),
          outlineWidth: 4,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      pinEntityRef.current = pin;

      // ── 5. Interactive Click Handler on Moon Surface & Craters ──
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
        const pickedObject = viewer.scene.pick(click.position);
        if (Cesium.defined(pickedObject) && pickedObject.id) {
          const entityId = String(pickedObject.id.id || '');
          if (entityId.startsWith('crater_')) {
            const craterId = entityId.replace('crater_', '');
            const foundCrater = CRATER_DETAILS.find((c) => c.id === craterId);
            if (foundCrater) {
              // Use ref so we always call the latest rotateToCrater, never a stale closure
              rotateToCraterRef.current(foundCrater, 'recon');
              return;
            }
          }
        }

        // If clicked on Moon surface / globe ellipsoid
        const ray = viewer.camera.getPickRay(click.position);
        if (ray) {
          const cartesian = viewer.scene.globe.pick(ray, viewer.scene) || viewer.camera.pickEllipsoid(click.position, MOON_ELLIPSOID);
          if (cartesian) {
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian, MOON_ELLIPSOID);
            const latDeg = Cesium.Math.toDegrees(cartographic.latitude);
            const lonDeg = Cesium.Math.toDegrees(cartographic.longitude);
            
            // Only select if user clicked within tight proximity (<= 3.5°) of an actual verified crater marker
            let closestCrater: CraterDetail | null = null;
            let minDist = 3.5;
            for (const c of CRATER_DETAILS) {
              const dist = Math.hypot(c.lat - latDeg, c.lon - lonDeg);
              if (dist < minDist) {
                minDist = dist;
                closestCrater = c;
              }
            }
            if (closestCrater) {
              rotateToCraterRef.current(closestCrater, 'recon');
            }
            // If clicked on generic empty terrain, DO NOT relocate or paste the crater image!
          }
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      // ── Initial Camera Position: Zoomed-out Full Moon Global Overview (4,200 km altitude) ──
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          selectedScene.lon,
          selectedScene.lat,
          4_200_000, // 4,200 km altitude — fits the full 3D Moon sphere on screen with target pins visible
          MOON_ELLIPSOID
        ),
        orientation: {
          heading: 0,
          pitch: -Cesium.Math.PI_OVER_TWO, // -90°: Look STRAIGHT DOWN at Moon sphere
          roll: 0,
        },
      });

      // Force canvas buffer to resize to true DOM dimensions and render the initial frame immediately
      requestAnimationFrame(() => {
        if (viewer && !viewer.isDestroyed()) {
          viewer.resize();
          viewer.scene.render();
        }
      });

      viewerRef.current = viewer;
      setIsInitialized(true);
    } catch (err) {
      console.warn('Cesium initialization notice:', err);
    }

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only ONCE — Cesium must never be re-initialized on scene change

  // Update pin and layers when selectedScene changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !isInitialized) return;

    if (pinEntityRef.current) {
      pinEntityRef.current.position = new Cesium.ConstantPositionProperty(
        Cesium.Cartesian3.fromDegrees(
          selectedScene.lon,
          selectedScene.lat,
          800,
          MOON_ELLIPSOID
        )
      );
      if (pinEntityRef.current.label) {
        pinEntityRef.current.label.text = new Cesium.ConstantProperty(
          `SLZ TARGET: ${selectedScene.name}`
        );
      }
    }
  }, [selectedScene, isInitialized]);

  // Update layer visibility
  useEffect(() => {
    if (ohrcLayerRef.current) ohrcLayerRef.current.show = layers.ohrc;
    if (iirsLayerRef.current) iirsLayerRef.current.show = layers.iirsHyperspectral;
    if (tmc2LayerRef.current) tmc2LayerRef.current.show = layers.tmc2Slope;
  }, [layers]);

  // ── Stop ground-level rotation ──
  const exitGroundMode = useCallback(() => {
    const viewer = viewerRef.current;
    if (groundListenerRef.current) {
      groundListenerRef.current();
      groundListenerRef.current = null;
    }
    // Release the camera.lookAt lock
    if (viewer && !viewer.isDestroyed()) {
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    }
    setIsGroundMode(false);
    setIsFlying(false);
    if (selectedCrater) {
      rotateToCrater(selectedCrater, 'recon');
    }
  }, [selectedCrater, rotateToCrater]);

  // GROUND-LEVEL SURFACE VIEW — Free-Look Horizon View
  // Places camera at crater surface altitude and gives user 100% manual free-look control
  const handleGroundLevelView = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !selectedCrater) return;

    // Toggle off if already in ground mode
    if (isGroundMode) {
      exitGroundMode();
      return;
    }

    // Cancel any existing rotation listener & release transform lock
    if (groundListenerRef.current) {
      groundListenerRef.current();
      groundListenerRef.current = null;
    }
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

    setIsFlying(true);
    setIsGroundMode(false);
    setShowInspector(false);
    updateCraterDrapeLayers(selectedCrater);

    const crater = selectedCrater;
    groundHeadingRef.current = 0;

    // The crater center on the surface
    const craterPos = Cesium.Cartesian3.fromDegrees(crater.lon, crater.lat, 0, MOON_ELLIPSOID);
    const craterRadiusMeters = (crater.diameterKm * 1000) / 2;
    const sphere = new Cesium.BoundingSphere(craterPos, Math.max(5000, craterRadiusMeters));

    const isPolar = Math.abs(crater.lat) > 75;
    const orbitRange = Math.max(12000, Math.min(craterRadiusMeters * 1.1, 90000));
    const orbitPitch = isPolar ? -38 : -28; // Oblique horizon angle looking across the landscape

    // ── Fly down to crater surface level ──
    viewer.camera.flyToBoundingSphere(sphere, {
      offset: new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(0),
        Cesium.Math.toRadians(orbitPitch),
        orbitRange
      ),
      duration: 2.2,
      easingFunction: Cesium.EasingFunction.SINUSOIDAL_IN_OUT,
      complete: () => {
        setIsFlying(false);
        setIsGroundMode(true);
        // Release lookAt transform so mouse drag / touch allows user to look around freely!
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      },
      cancel: () => {
        setIsFlying(false);
      },
    });
  }, [selectedCrater, updateCraterDrapeLayers, isGroundMode, exitGroundMode]);

  // Interactive Pan / Pitch adjustments in Surface View
  const handleSurfacePan = (deltaDeg: number) => {
    const viewer = viewerRef.current;
    if (!viewer || !selectedCrater) return;
    const craterPos = Cesium.Cartesian3.fromDegrees(selectedCrater.lon, selectedCrater.lat, 0, MOON_ELLIPSOID);
    const hpr = viewer.camera.heading;
    const pitch = viewer.camera.pitch;
    const range = Cesium.Cartesian3.distance(viewer.camera.position, craterPos);
    viewer.camera.lookAt(
      craterPos,
      new Cesium.HeadingPitchRange(
        hpr + Cesium.Math.toRadians(deltaDeg),
        pitch,
        range
      )
    );
  };

  const handleSurfacePitch = (pitchDeg: number) => {
    const viewer = viewerRef.current;
    if (!viewer || !selectedCrater) return;
    const craterPos = Cesium.Cartesian3.fromDegrees(selectedCrater.lon, selectedCrater.lat, 0, MOON_ELLIPSOID);
    const hpr = viewer.camera.heading;
    const range = Cesium.Cartesian3.distance(viewer.camera.position, craterPos);
    viewer.camera.lookAt(
      craterPos,
      new Cesium.HeadingPitchRange(
        hpr,
        Cesium.Math.toRadians(pitchDeg),
        range
      )
    );
  };

  const handleGroundPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isGroundMode) return;
    groundDragRef.current = { active: true, x: event.clientX, y: event.clientY };
  };

  const handleGroundPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewer = viewerRef.current;
    if (!viewer || !isGroundMode || !groundDragRef.current || !selectedCrater) return;

    const deltaX = event.clientX - groundDragRef.current.x;
    const deltaY = event.clientY - groundDragRef.current.y;

    groundDragRef.current = { active: true, x: event.clientX, y: event.clientY };

    const rotationX = Cesium.Math.toRadians(deltaX * 0.22);
    const rotationY = Cesium.Math.toRadians(deltaY * 0.18);

    viewer.camera.rotateRight(rotationX);
    viewer.camera.rotateUp(rotationY);
  };

  const handleGroundPointerUp = () => {
    groundDragRef.current = null;
  };

  const handleZoom = (inOut: 'in' | 'out') => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const camera = viewer.camera;
    const amount = camera.positionCartographic.height * 0.35;
    if (inOut === 'in') {
      camera.zoomIn(amount);
    } else {
      camera.zoomOut(amount);
    }
  };

  const handleResetView = () => {
    setSelectedCrater(null);
    setShowInspector(false);
    setReconMode('global');
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    if (ohrcLayerRef.current) {
      viewer.imageryLayers.remove(ohrcLayerRef.current, true);
      ohrcLayerRef.current = null;
    }
    if (iirsLayerRef.current) {
      viewer.imageryLayers.remove(iirsLayerRef.current, true);
      iirsLayerRef.current = null;
    }
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(selectedScene.lon, selectedScene.lat, 4_200_000, MOON_ELLIPSOID),
      orientation: {
        heading: 0,
        pitch: -Cesium.Math.PI_OVER_TWO,
        roll: 0,
      },
      duration: 1.8,
      easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
    });
  };

  const toggleLayer = (key: keyof LayerVisibility) => {
    onLayerChange({ ...layers, [key]: !layers[key] });
  };

  const handleApplyCraterAsScene = () => {
    if (!selectedCrater || !onSelectScene) return;
    const matchedPreset = SCENE_PRESETS.find((p) => p.id === selectedCrater.id) || {
      id: selectedCrater.id,
      name: selectedCrater.name,
      lat: selectedCrater.lat,
      lon: selectedCrater.lon,
      height: selectedCrater.height,
      terrainClass: selectedCrater.lat < -60 ? 'polar_highland' : 'highland',
      craterDensity: parseFloat((3.0 + Math.random() * 2).toFixed(1)),
      solarIncidenceDeg: selectedCrater.solarIncidenceDeg,
      solarAzimuthDeg: selectedCrater.solarAzimuthDeg,
      gsdM: 0.31,
      overlayOpacity: 0.75,
      description: selectedCrater.description,
    };
    onSelectScene(matchedPreset as ScenePreset);
  };

  const [showLayerMenu, setShowLayerMenu] = useState(false);

  return (
    <div
      className="relative w-full h-full flex flex-col bg-[#020604] overflow-hidden"
      onPointerDown={handleGroundPointerDown}
      onPointerMove={handleGroundPointerMove}
      onPointerUp={handleGroundPointerUp}
      onPointerLeave={handleGroundPointerUp}
    >
      {/* ── UNIFIED TOP FLOATING CONTROL BAR (Zero Overlap & Multi-Recon Modes) ── */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between gap-2 pointer-events-auto">
        {/* Left: Terrain Draping Layer Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#04140D]/90 hover:bg-[#072417] backdrop-blur-2xl border border-emerald-500/40 text-[10px] font-mono font-bold text-white shadow-xl transition-all"
          >
            <Layers size={13} className="text-orange-300" />
            <span className="hidden sm:inline">Terrain Layers</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </button>

          {showLayerMenu && (
            <div className="absolute top-full mt-1.5 left-0 z-40 bg-[#04140D]/95 backdrop-blur-2xl rounded-2xl border border-emerald-500/40 p-2 flex flex-col gap-1 shadow-2xl min-w-[180px]">
              <div className="flex items-center gap-1.5 px-1 mb-0.5 text-[9px] font-mono text-orange-300 font-extrabold uppercase tracking-wider">
                <Layers size={11} className="text-orange-300" />
                <span>Active Overlays</span>
              </div>
              {LAYER_CONFIG.map((cfg) => (
                <button
                  key={cfg.key}
                  onClick={() => toggleLayer(cfg.key)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left transition-all text-[9.5px] font-mono font-bold ${
                    layers[cfg.key]
                      ? 'bg-emerald-500/25 border border-emerald-400/60 text-white shadow-md'
                      : 'bg-[#030E08]/60 text-slate-400 hover:text-white hover:bg-[#071F13]'
                  }`}
                >
                  {layers[cfg.key] ? (
                    <Eye size={12} className={cfg.color} />
                  ) : (
                    <EyeOff size={12} className="text-slate-600" />
                  )}
                  <span className={layers[cfg.key] ? 'text-white' : 'text-slate-400'}>
                    {cfg.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center: Target Craters Quick Carousel */}
        <div className="flex-1 min-w-0 max-w-[55%] flex items-center gap-1 bg-[#040913]/95 backdrop-blur-2xl px-2 py-1 rounded-xl border border-emerald-500/35 shadow-xl overflow-x-auto sidebar-scroll">
          <span className="text-[8.5px] font-mono font-extrabold text-emerald-400 uppercase tracking-widest pl-1 min-w-max">
            TARGETS:
          </span>
          <div className="flex items-center gap-1">
            {CRATER_DETAILS.map((crater) => {
              const isTarget = selectedCrater?.id === crater.id;
              return (
                <button
                  key={crater.id}
                  onClick={() => rotateToCrater(crater, 'recon')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9.5px] font-mono font-bold min-w-max transition-all ${
                    isTarget
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-[0_0_14px_rgba(16,185,129,0.7)] font-extrabold'
                      : 'bg-[#060F1E]/90 text-slate-200 hover:text-white hover:bg-[#0C1C34] border border-emerald-500/25'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${isTarget ? 'bg-black' : 'bg-emerald-400'}`} />
                  <span>{crater.name}</span>
                  <span className={`text-[7.5px] font-mono px-1 py-0.2 rounded ${
                    isTarget ? 'bg-black/20 text-black font-extrabold' : 'bg-emerald-950/90 text-emerald-300'
                  }`}>
                    {crater.waterAbsorptionDepthPct}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Recon Altitude Switcher & Cinematic Dive Button */}
        <div className="flex items-center gap-1.5 min-w-max">
          {/* Recon Modes: 24km Close / 160km Survey / Global */}
          <div className="bg-[#040913]/95 backdrop-blur-xl rounded-xl border border-emerald-500/30 p-0.5 flex items-center gap-0.5 shadow-lg">
            <button
              onClick={() => rotateToCrater(selectedCrater || CRATER_DETAILS[0], 'recon')}
              title="24km Close-Up 3D Surface Recon (0.3m OHRC Resolution)"
              className={`px-2 py-1 rounded-lg text-[9px] font-mono font-extrabold transition-all ${
                reconMode === 'recon'
                  ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              24km 3D Recon
            </button>
            <button
              onClick={() => rotateToCrater(selectedCrater || CRATER_DETAILS[0], 'survey')}
              title="160km Orbital Survey"
              className={`px-2 py-1 rounded-lg text-[9px] font-mono font-extrabold transition-all ${
                reconMode === 'survey'
                  ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Survey
            </button>
            <button
              onClick={handleResetView}
              title="4,500km Full Moon Global Sphere — Fit Whole Moon on Screen"
              className={`px-2 py-1 rounded-lg text-[9px] font-mono font-extrabold transition-all ${
                reconMode === 'global'
                  ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Fit Whole Moon
            </button>
          </div>

          {/* Zoom In/Out & Reset Buttons */}
          <div className="flex items-center gap-0.5 bg-[#040913]/95 backdrop-blur-2xl p-0.5 rounded-xl border border-emerald-500/35 shadow-xl">
            <button
              onClick={() => handleZoom('in')}
              title="Zoom In"
              className="p-1.5 rounded-lg hover:bg-[#0B1A2E] text-slate-300 hover:text-emerald-300 transition-colors"
            >
              <ZoomIn size={13} />
            </button>
            <button
              onClick={() => handleZoom('out')}
              title="Zoom Out"
              className="p-1.5 rounded-lg hover:bg-[#0B1A2E] text-slate-300 hover:text-emerald-300 transition-colors"
            >
              <ZoomOut size={13} />
            </button>
            <button
              onClick={handleResetView}
              title="Reset Lunar View"
              className="p-1.5 rounded-lg hover:bg-[#0B1A2E] text-slate-300 hover:text-emerald-300 transition-colors"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          <button
            onClick={handleGroundLevelView}
            disabled={isFlying}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-mono font-extrabold transition-all duration-300 border shadow-xl ${
              isFlying
                ? 'bg-[#060D1A] border-emerald-500/40 text-emerald-200 cursor-not-allowed opacity-60'
                : isGroundMode
                ? 'bg-gradient-to-r from-rose-500 to-red-400 border-rose-300 text-white shadow-[0_0_16px_rgba(239,68,68,0.5)]'
                : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 border-emerald-300 text-black shadow-[0_0_16px_rgba(16,185,129,0.5)]'
            }`}
            title={isGroundMode ? 'Exit Surface View' : 'Stand on crater surface — first-person 360° lunar horizon view'}
          >
            <span>{isFlying ? 'Descending...' : isGroundMode ? 'Stop Surface View' : 'Surface View'}</span>
          </button>
        </div>
      </div>

      {/* ── GROUND-MODE HORIZON HUD CONTROLS ── */}
      {isGroundMode && (
        <div
          className="absolute inset-0 z-25 pointer-events-none"
          style={{ animation: 'fadeInOverlay 0.5s ease forwards' }}
        >
          {/* Subtle cinematic vignette */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse 85% 75% at 50% 50%, transparent 50%, rgba(0,0,0,0.75) 100%)'
          }} />

          {/* Top-left: Mode badge + crater info */}
          <div className="absolute top-14 left-3 flex flex-col gap-1.5 pointer-events-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/85 backdrop-blur-xl border border-sky-400/60 shadow-[0_0_20px_rgba(56,189,248,0.4)]">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-[10px] font-mono font-extrabold text-sky-200 uppercase tracking-widest">3D SURFACE HORIZON VIEW</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-black/75 backdrop-blur-xl border border-emerald-500/30">
              <span className="text-[9px] font-mono text-emerald-300 font-bold block">{selectedCrater?.name}</span>
              <span className="text-[8px] font-mono text-slate-300">Diameter: {selectedCrater?.diameterKm} km · Depth: {selectedCrater?.depthKm} km</span>
            </div>
          </div>

          {/* Top-right: STOP button */}
          <div className="absolute top-14 right-3 pointer-events-auto">
            <button
              onClick={exitGroundMode}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 active:bg-rose-700 border border-rose-300/60 text-white font-mono font-extrabold text-[11px] shadow-2xl backdrop-blur-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.5)]"
            >
              <X size={13} />
              <span>EXIT SURFACE VIEW</span>
            </button>
          </div>

          {/* Bottom-center: Interactive Horizon Pan & Pitch Controls Bar */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-auto">
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-black/90 backdrop-blur-2xl border border-sky-400/60 shadow-[0_0_28px_rgba(56,189,248,0.4)]">
              {/* 360° Pan Buttons */}
              <div className="flex items-center gap-1 border-r border-white/20 pr-2.5">
                <span className="text-[9px] font-mono text-sky-300 font-bold uppercase">PAN:</span>
                <button
                  onClick={() => handleSurfacePan(-30)}
                  title="Pan 30° Left"
                  className="px-2 py-1 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-500/40 text-sky-200 text-[10px] font-mono font-extrabold transition-all"
                >
                  ⟲ Left
                </button>
                <button
                  onClick={() => handleSurfacePan(30)}
                  title="Pan 30° Right"
                  className="px-2 py-1 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-500/40 text-sky-200 text-[10px] font-mono font-extrabold transition-all"
                >
                  ⟳ Right
                </button>
              </div>

              {/* Pitch Angle Preset Toggles */}
              <div className="flex items-center gap-1 border-r border-white/20 pr-2.5">
                <span className="text-[9px] font-mono text-emerald-300 font-bold uppercase">ANGLE:</span>
                <button
                  onClick={() => handleSurfacePitch(-20)}
                  title="Look towards the distant horizon (-20°)"
                  className="px-2 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 text-[10px] font-mono font-bold transition-all"
                >
                  Horizon
                </button>
                <button
                  onClick={() => handleSurfacePitch(-45)}
                  title="Oblique crater slope angle (-45°)"
                  className="px-2 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 text-[10px] font-mono font-bold transition-all"
                >
                  Oblique
                </button>
                <button
                  onClick={() => handleSurfacePitch(-85)}
                  title="Look straight down at crater floor (-85°)"
                  className="px-2 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 text-[10px] font-mono font-bold transition-all"
                >
                  Overhead
                </button>
              </div>

              {/* Mouse Drag Hint */}
              <div className="text-[9px] font-mono text-white/80 hidden sm:block">
                <span className="text-emerald-300 font-bold">Left Drag</span> to Orbit · <span className="text-emerald-300 font-bold">Scroll</span> to Zoom
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Interactive Crater Inclination & Water-Ice Inspector (Glass Popup) ── */}
      {selectedCrater && showInspector && (
        <div className="absolute bottom-10 right-4 z-30 w-84 max-w-[92vw] bg-gradient-to-b from-[#060D1A]/98 via-[#030810]/98 to-[#02050A]/99 backdrop-blur-2xl rounded-2xl border border-emerald-400/40 p-3 shadow-[0_16px_50px_rgba(0,0,0,0.95)] inspector-enter">
          {/* Inspector Header */}
          <div className="flex items-start justify-between pb-2 border-b border-emerald-500/25">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-xs font-bold text-white font-mono leading-tight">
                  {selectedCrater.name}
                </h3>
              </div>
              <p className="text-[9px] font-mono text-cyan-300 mt-0.5">
                {selectedCrater.region} · [{selectedCrater.lat.toFixed(2)}°S, {selectedCrater.lon.toFixed(2)}°E]
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/30">
                  ⌀ {selectedCrater.diameterKm} km
                </span>
                <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#030C18] text-amber-300 border border-amber-500/30">
                  Depth: {selectedCrater.depthKm} km
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => rotateToCrater(selectedCrater)}
                title="Rotate & Center Camera"
                className="p-1 rounded-lg bg-[#081526] hover:bg-[#0E2442] text-emerald-300 border border-emerald-500/30"
              >
                <Maximize2 size={11} />
              </button>
              <button
                onClick={() => setShowInspector(false)}
                className="p-1 rounded-lg bg-[#081526] hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-emerald-500/30 transition-colors"
              >
                <X size={11} />
              </button>
            </div>
          </div>

          {/* ── SECTION 1: INCLINATION & SLOPES ── */}
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1 text-[9px] font-mono font-extrabold text-emerald-400 uppercase tracking-wider">
              <Orbit size={11} className="text-emerald-400" />
              <span>Inclination & Topographic Slope</span>
            </div>

            <div className="grid grid-cols-3 gap-1 text-center font-mono">
              <div className="bg-[#040913]/90 p-1.5 rounded-xl border border-emerald-500/20">
                <span className="text-[7.5px] text-slate-400 block">FLOOR INCL.</span>
                <span className="text-[11px] font-extrabold text-white">{selectedCrater.floorInclinationDeg}°</span>
              </div>
              <div className="bg-[#040913]/90 p-1.5 rounded-xl border border-emerald-500/20">
                <span className="text-[7.5px] text-slate-400 block">WALL SLOPE</span>
                <span className="text-[11px] font-extrabold text-amber-300">{selectedCrater.wallSlopeDeg}°</span>
              </div>
              <div className="bg-[#040913]/90 p-1.5 rounded-xl border border-emerald-500/20">
                <span className="text-[7.5px] text-slate-400 block">ORBIT INCL.</span>
                <span className="text-[11px] font-extrabold text-teal-300">{selectedCrater.orbitInclinationDeg}°</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[8px] font-mono px-1 py-0.5 bg-[#040913]/80 rounded-lg border border-emerald-500/15 text-slate-200">
              <span>Solar Sun Incidence: <strong className="text-emerald-300">{selectedCrater.solarIncidenceDeg}°</strong></span>
              <span>Azimuth: <strong className="text-cyan-300">{selectedCrater.solarAzimuthDeg}°</strong></span>
            </div>
          </div>

          {/* ── SECTION 2: 3.0 µm WATER-ICE & HYDRATION TELEMETRY ── */}
          <div className="mt-2.5 pt-2 border-t border-emerald-500/25 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-[9px] font-mono font-extrabold text-emerald-300 uppercase tracking-wider">
                <Droplets size={11} className="text-cyan-300" />
                <span>3.0 µm Water-Ice Hydration</span>
              </div>
              <span className={`text-[8px] font-mono font-extrabold px-1.5 py-0.2 rounded border ${
                selectedCrater.psrStatus.includes('PSR')
                  ? 'bg-sky-950/90 text-sky-300 border-sky-400/60 shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                  : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40'
              }`}>
                {selectedCrater.psrStatus}
              </span>
            </div>

            {/* Absorption Depth Gauge */}
            <div className="bg-[#040913]/90 p-2 rounded-xl border border-emerald-500/25">
              <div className="flex items-center justify-between text-[9px] font-mono mb-1">
                <span className="text-slate-200">3.0µm OH/H₂O Absorption Depth</span>
                <span className="text-cyan-300 font-extrabold">{selectedCrater.waterAbsorptionDepthPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-black/80 rounded-full overflow-hidden border border-emerald-500/30">
                <div
                  className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400"
                  style={{ width: `${Math.min(100, selectedCrater.waterAbsorptionDepthPct * 3.5)}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5 mt-2 font-mono text-[9px]">
                <div className="bg-[#02050A] p-1.5 rounded-lg border border-emerald-500/20">
                  <span className="text-[7.5px] text-slate-400 block">EST. WATER CONCENTRATION</span>
                  <span className="text-xs font-extrabold text-cyan-300">{selectedCrater.waterIceConcentrationWtPct} wt%</span>
                  <span className="text-[8px] text-slate-400 block">({selectedCrater.waterIcePpm.toLocaleString()} ppm)</span>
                </div>
                <div className="bg-[#02050A] p-1.5 rounded-lg border border-emerald-500/20">
                  <span className="text-[7.5px] text-slate-400 block">SURFACE TEMP / FROST</span>
                  <span className="text-xs font-extrabold text-amber-200">{selectedCrater.surfaceTempKelvin} K</span>
                  <span className="text-[8px] text-emerald-400 block font-bold">Frost Index: {selectedCrater.frostIndex}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Inspector Footer Actions */}
          <div className="mt-2.5 pt-2 border-t border-emerald-500/25 flex items-center gap-1.5">
            <button
              onClick={handleApplyCraterAsScene}
              className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-black font-mono font-extrabold text-[10px] shadow-lg transition-all"
            >
              <Check size={12} />
              <span>Set as Active Scene</span>
            </button>
            <button
              onClick={handleGroundLevelView}
              disabled={isFlying || isGroundMode}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#06192A] hover:bg-[#0A2540] border border-sky-400/40 text-sky-300 font-mono font-extrabold text-[10px] transition-all shadow-lg"
            >
              <Maximize2 size={12} />
              <span>Surface View</span>
            </button>
          </div>
        </div>
      )}

      {/* Collapsed Inspector Pill (When Inspector is closed) */}
      {!showInspector && (
        <button
          onClick={() => setShowInspector(true)}
          className="absolute bottom-10 right-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#04140D]/95 hover:bg-[#072618] border border-emerald-400/50 hover:border-orange-300 text-emerald-200 hover:text-white font-mono text-[10px] font-bold shadow-2xl backdrop-blur-2xl transition-all group pointer-events-auto"
        >
          <Droplets size={12} className="text-sky-300 animate-pulse" />
          <span>{selectedCrater ? `${selectedCrater.name} Findings` : 'Crater Findings'}</span>
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-orange-300 border border-emerald-500/40">
            {selectedCrater ? `${selectedCrater.waterAbsorptionDepthPct}% H₂O` : 'Inspect'}
          </span>
        </button>
      )}

      {/* Cesium Container (100% Full Canvas Height) */}
      <div
        ref={containerRef}
        className="w-full h-full rounded-xl overflow-hidden bg-[#020604]"
      />

      {/* Floating Viewport Footer Telemetry Bar */}
      <div className="absolute bottom-2 left-2 right-2 z-20 flex items-center justify-between px-3 py-1 bg-[#031109]/85 backdrop-blur-xl rounded-xl border border-emerald-500/25 text-[9.5px] font-mono text-white shadow-xl pointer-events-auto">
        <span className="flex items-center gap-1.5">
          <Compass size={12} className="text-orange-300" />
          <span className="font-bold">Target: {selectedScene.lat.toFixed(2)}°S, {selectedScene.lon.toFixed(2)}°E</span>
        </span>
        <span className="hidden sm:flex items-center gap-1.5">
          <Mountain size={12} className="text-emerald-300" />
          <span className="font-bold">TMC-2 DEM: 5m/px Vertical · GSD: {selectedScene.gsdM}m</span>
        </span>
        <span className="text-orange-300 font-extrabold flex items-center gap-1">
          <Droplets size={11} className="text-sky-300" />
          <span>Click on Moon or select Target Crater to rotate & inspect</span>
        </span>
      </div>
    </div>
  );
};
