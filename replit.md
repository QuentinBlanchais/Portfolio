# WebGL Shape Animation

## Overview
An interactive WebGL animation where colorful shapes (rectangles and triangles) appear on click and drift away in random directions until they leave the viewport.

## Features
- Click anywhere to spawn a shape (random rectangle or triangle)
- Maximum 10 shapes on screen at a time
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

## Recent Changes
- February 5, 2026: Implemented static WebGL shapes at bottom of 404 page matching Figma design
- February 5, 2026: Added custom 404 page matching Figma design with logo, centered error text, and back button
- January 22, 2026: Created interactive click-to-spawn shape animation with drift behavior
