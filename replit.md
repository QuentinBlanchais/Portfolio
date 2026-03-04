# WebGL Shape Animation

## Overview
An interactive WebGL animation where colorful shapes (rectangles and triangles) appear on click and drift away in random directions until they leave the viewport.

## Features
- Click anywhere to spawn a shape (random rectangle or triangle)
- Maximum 8 shapes on screen at a time
- Shapes pop in with a scale animation
- Each shape drifts in a random direction with rotation
- Shapes are automatically removed when they leave the viewport
- Vibrant color palette with 9 different colors
- Background color: #F5F1F1

## Tech Stack
- Pure JavaScript with WebGL
- GLSL vertex and fragment shaders
- Static file serving with `serve`

## Project Structure
- `index.html` - Main HTML file with canvas element
- `404.html` - Custom 404 error page
- `script.js` - WebGL animation logic with shaders

## Running the Project
The project runs on port 5000 using `npx serve -l 5000`.

## 404 Page Behavior
The 404 page displays static WebGL shapes piled at the bottom center of the screen. Key differences from the main page:
- Shapes are positioned statically (no physics/drift)
- 9 shapes arranged in a pile formation at the bottom
- Shapes use the same SDF-based WebGL rendering for consistency
- Click interactions are still enabled for spawning additional shapes

## Architecture Notes
- Render loop uses forward iteration with writeIdx pattern (swap-and-pop) for O(1) shape removal instead of Array.splice()
- Single consolidated resize handler with requestAnimationFrame throttling
- WebGL context loss/restore handling with animFrameId tracking to prevent duplicate render loops
- Module-level temp arrays for colors to avoid per-frame allocation
- `updateZones()` guarded with typeof check as it may not exist on all pages

## Recent Changes
- February 27, 2026: Added full Agents in Jira case study with CSS styles for agent-specific components (keynote link, icons grid, two-image layout, 3-column screenshot grid cards, apps panel). Downloaded all assets from Figma (hero images, app icons, focus/principle icons, grid screenshots, result icons). Updated Results section with Figma icons. Added mobile responsive styles for all new agent components.
- February 14, 2026: Implemented deferred asset loading for modal images. All images inside about modal and project modal use `data-src`/`data-srcset` instead of `src`/`srcset` to prevent loading during initial page render. After landing page animation starts (2s delay + requestIdleCallback), images are progressively loaded in background with 50ms intervals. Opening a modal immediately flushes any remaining deferred images via `flushDeferredImages()`.
- February 13, 2026: Implemented lazy loading mechanism for faster image loading. Added `loading="lazy"` and `decoding="async"` to all non-critical images. Converted preview hover images to WebP (up to 93% smaller). Added `<picture>` with WebP `<source>` for all remaining images. Background preloads hover preview images using `requestIdleCallback` with sequential loading after page load.
- February 12, 2026: Converted all large PNG images to WebP format (72% smaller total) with `<picture>` fallback for older browsers. Images: carousel slides, hero images, attached_assets photos. Original PNGs kept as fallbacks.
- February 11, 2026: Updated Joining Jira project modal with full case study layout (friction points section, approach 3-column grid, Welcome mockup showcase with gradient, screenshots grid, 2 strategic pillars, collaboration section, results/effects metrics)
- February 10, 2026: Added slide animation between project modals (slide-out-left + slide-in-right with scale, breadcrumb animates vertically, safety timeout fallbacks)
- February 9, 2026: Performance and stability cleanup of script.js (O(1) render loop, context loss handling, consolidated resize, eliminated redundant allocations)
- February 9, 2026: Added project detail modal that slides up from bottom when clicking a project link, matching Figma design
- February 5, 2026: Implemented static WebGL shapes at bottom of 404 page matching Figma design
- February 5, 2026: Added custom 404 page matching Figma design with logo, centered error text, and back button
- January 22, 2026: Created interactive click-to-spawn shape animation with drift behavior
