# Frontend Vision and Product Direction

## Goal

This frontend is not a landing page. It is a lunar mission-control dashboard for exploring Chandrayaan-2 crater and terrain data, visualizing co-registration outputs, and inspecting scientific findings around water-ice potential and lunar terrain hazards.

The product should feel like a scientific workbench used by a mission analyst or researcher, not a marketing page. It should present a Moon-based visual model, allow selection of craters or targets, and show the relevant overlays, telemetry, and scientific diagnostics.

## Core product idea

- The centerpiece is a lunar 3D scene rendered as a Moon globe / terrain model.
- A user can click on the Moon surface or select a crater from the quick target list.
- The camera smoothly rotates and flies toward the selected crater.
- The selected crater becomes the active focus, with scientific overlays and local imagery loading around that crater.
- The view can switch between global overview, orbital survey, and close-up crater recon.
- The system presents scientific metadata such as crater depth, water-ice absorption, sunlight incidence, terrain class, and hydration indicators.
- The 2D co-registration panel supports comparison and QC views for alignment quality.

## Functional priorities

### 1. Moon model navigation

- Use the Moon as a spatial model and real navigation surface.
- Provide crater markers and crater-level focus.
- Smooth transitions when moving between target craters.
- Preserve the active crater state in the UI and in the scientific inspector.

### 2. Scientific inspection workflow

- Clicking a crater or target triggers a focused inspection panel.
- The panel shows terrain geometry, slope, orbit inclination, solar incidence, and water-ice signal data.
- The panel should be clear and useful for scientists, not cluttered.

### 3. Data overlay experience

- Terrain overlays should be toggled cleanly.
- OHRC, TMC-2, IIRS, and SLZ overlays should appear as optional layers.
- The overlays should not block the main navigation and should feel lightweight and readable.

### 4. Mission control feel

- Sidebars should feel like operational panels, not ad hoc controls.
- Buttons should clearly map to pipeline stages, pre-processing filters, and matcher selection.
- The interface should communicate that this is a mission analysis tool and not a marketing landing page.

## Implementation constraints

- This is frontend only. No backend or database implementation is required in this scope.
- The project currently uses mock data and static assets, which is appropriate for the current frontend phase.
- The backend can be connected later by the teammates responsible for APIs and processing services.
- The current frontend must be polished enough to demonstrate the intended user experience and data storytelling.

## UI direction

The visual style should stay in the current scientific dark theme:
- deep space black and dark green
- amber/orange accents for mission-critical data
- emerald highlights for status and scientific values
- glass-like panels with a crisp dashboard aesthetic

The interface should stay compact, structured, and technical while maintaining strong readability and smooth interaction.

## Non-goals

- No generic landing page or homepage hero section
- No backend logic or persistence work
- No unrelated marketing content
- No broad redesign that breaks the existing product intent

## Success criteria

The frontend is successful when:
- the Moon viewport feels responsive and purposeful,
- crater selection and target navigation feel smooth,
- the scientific inspector updates correctly with the selected crater,
- the overlay toggles work without visual glitches,
- the page behaves like a polished mission-control dashboard for lunar terrain analysis.

This is the intended frontend direction for the current project.
