# WebGL Shape Animation

An interactive WebGL animation where colorful shapes appear on click and drift away in random directions.

![WebGL Animation](https://img.shields.io/badge/WebGL-Interactive-blue) ![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow) ![License](https://img.shields.io/badge/License-MIT-green)

## Demo

[View Live Demo](https://your-username.github.io/your-repo-name)

## Features

- **Click to Spawn** - Click anywhere to create a random shape (rectangle, triangle, or circle)
- **Smooth Animations** - Shapes pop in with a satisfying scale animation
- **Drifting Motion** - Each shape floats in a random direction with gentle rotation
- **Auto Cleanup** - Shapes automatically disappear when they leave the viewport
- **Vibrant Colors** - 10 gradient color combinations for visual variety
- **Performance Optimized** - Maximum of 8 shapes on screen at a time

## Tech Stack

- Pure JavaScript (ES6+)
- WebGL for hardware-accelerated rendering
- GLSL vertex and fragment shaders
- Signed Distance Functions (SDF) for smooth shape rendering

## Getting Started

### Prerequisites

- A modern web browser with WebGL support
- Node.js (for local development server)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/webgl-shape-animation.git
   cd webgl-shape-animation
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to `http://localhost:5000`

## Project Structure

```
├── index.html          # Main HTML file with canvas element
├── script.js           # WebGL animation logic and shaders
├── style.css           # Page styling
├── github-pages/       # GitHub Pages deployment files
│   ├── index.html
│   ├── script.js
│   └── style.css
└── package.json        # Project dependencies
```

## How It Works

The animation uses WebGL to render shapes efficiently on the GPU. Key technical details:

1. **Vertex Shader** - Handles shape positioning, rotation, and scaling
2. **Fragment Shader** - Uses SDFs to render rounded rectangles, triangles, and circles with smooth edges
3. **Animation Loop** - Updates shape positions and removes off-screen shapes each frame

## Customization

You can customize the animation by modifying these values in `script.js`:

- `MAX_SHAPES` - Maximum number of shapes on screen
- `colors` array - Shape color gradients
- `BACKGROUND_COLOR` - Canvas background color
- Shape sizes and animation speeds

## Browser Support

Works in all modern browsers with WebGL support:
- Chrome 56+
- Firefox 51+
- Safari 11+
- Edge 79+

## License

This project is open source and available under the [MIT License](LICENSE).

## Contributing

Contributions are welcome! Feel free to submit issues and pull requests.
