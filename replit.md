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
- `script.js` - WebGL animation logic with shaders

## Running the Project
The project runs on port 5000 using `npx serve -l 5000`.

## Recent Changes
- January 22, 2026: Created interactive click-to-spawn shape animation with drift behavior
