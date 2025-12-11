# Honeybee Kiosk App - Eye Tracking Implementation

## Overview
This Tauri app integrates native camera access (via crabcamera) with MediaPipe Holistic for real-time eye tracking and 3D face animation, running in fullscreen kiosk mode (480x480).

## Architecture

### Frontend (React + TypeScript)
- **Framework**: React 19.1.0 with TypeScript
- **Build Tool**: Vite 7.0.4
- **3D Rendering**: Three.js 0.181.2
- **Eye Tracking**: MediaPipe Holistic 0.5.1675471629
- **Audio Visualization**: Web Audio API

### Backend (Tauri + Rust)
- **Framework**: Tauri 2.0
- **Camera Plugin**: crabcamera 0.4.0 (native V4L2 on Linux)

## Key Components

### 1. MediaPipeEyeTracker.tsx
Main component that integrates all features:

#### Camera Integration (crabcamera)
```typescript
// Initialize camera system
await invoke('initialize_camera_system');

// Get available cameras
const cameras = await invoke('get_available_cameras');

// Capture frames at 50ms intervals (20 FPS)
const frame: CameraFrame = await invoke('capture_single_photo', {
  deviceId: cameraDeviceId,
  format: { width: 640, height: 480, fps: 20, format_type: "RGB8" }
});

// Convert RGB8 frame to ImageData
const imageData = new ImageData(
  new Uint8ClampedArray(frame.data),
  frame.width,
  frame.height
);

// Send to MediaPipe
await holistic.send({ image: canvas });
```

#### Eye Tracking Logic
- Detects face landmarks using MediaPipe Holistic
- Identifies eye meshes in Normal.glb model: `ballL1`, `ballR1`, `iresL1`, `IresR1`
- Calculates eye center from landmark indices: 468-473 (left), 473-478 (right)
- Moves eye meshes to follow detected gaze direction

#### 3D Scene Setup
- Three.js scene with WebGL renderer
- Gradient background (dark to darker gray)
- Directional and ambient lighting
- GLTF model loader for Normal.glb

### 2. SoundWaveVisualization.tsx
Audio-reactive circular waves around the 3D face:
- 10 LineLoop geometries in concentric circles
- Web Audio API analyser node
- Wave radius modulates based on audio frequency data
- Smooth color gradient (cyan → purple)

### 3. App.tsx
Minimal wrapper that renders MediaPipeEyeTracker fullscreen

## Configuration

### Display Settings (tauri.conf.json)
```json
{
  "windows": [{
    "width": 480,
    "height": 480,
    "fullscreen": true,
    "decorations": false,
    "resizable": false
  }]
}
```

### Camera Settings
- **Resolution**: 640x480 (downscaled from camera)
- **Frame Rate**: 20 FPS (50ms intervals)
- **Format**: RGB8 (converted to ImageData)

### MediaPipe Options
```typescript
{
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
  refineFaceLandmarks: true
}
```

## Build & Run

### Development
```bash
cd /rajesh_work_dir/Development/tauri-projects/honeybee-kiosk-app
bun install
bun run tauri dev
```

### Production
```bash
bun run tauri build
```

## Dependencies

### Frontend (package.json)
```json
{
  "@mediapipe/holistic": "^0.5.1675471629",
  "@tauri-apps/api": "^2.2.0",
  "react": "^19.1.0",
  "three": "^0.181.2"
}
```

### Backend (Cargo.toml)
```toml
[dependencies]
tauri = { version = "2.0", features = ["protocol-asset"] }
crabcamera = "0.4.0"
```

## Technical Notes

### Why crabcamera?
- WebKit2GTK (Tauri's Linux webview) doesn't support getUserMedia()
- WebRTC camera access fails with NotAllowedError
- crabcamera provides native V4L2 camera access via Tauri invoke commands
- Bypasses browser security restrictions entirely

### Frame Capture Flow
1. Timer triggers every 50ms
2. Invoke `capture_single_photo` with camera ID and format
3. Receive CameraFrame with RGB8 data array
4. Convert to Uint8ClampedArray → ImageData
5. Draw to offscreen canvas (640x480)
6. Send canvas to MediaPipe Holistic
7. MediaPipe detects face landmarks
8. onResults() callback moves eye meshes in 3D scene

### Cleanup on Unmount
```typescript
// Stop capture loop
clearInterval(captureIntervalRef.current);

// Release camera
await invoke('release_camera', { deviceId });

// Close MediaPipe
holistic.close();

// Dispose Three.js resources
renderer.dispose();
scene.traverse(object => {
  if (object.isMesh) {
    object.geometry.dispose();
    object.material.dispose();
  }
});
```

## Troubleshooting

### Camera not found
- Check camera permissions: `ls -la /dev/video*`
- Verify user in `video` group: `groups`
- Test with `v4l2-ctl --list-devices`

### MediaPipe not detecting face
- Ensure good lighting conditions
- Check camera resolution matches MediaPipe input
- Verify landmark detection confidence thresholds

### Low frame rate
- Default is 20 FPS (50ms intervals)
- Reduce to 30ms for higher FPS (if hardware supports)
- Check CPU usage during MediaPipe processing

## File Structure
```
honeybee-kiosk-app/
├── src/
│   ├── App.tsx                              # Main app wrapper
│   ├── App.css                              # Fullscreen styles
│   ├── components/
│   │   ├── MediaPipeEyeTracker.tsx         # Eye tracking + 3D scene
│   │   └── SoundWaveVisualization.tsx      # Audio visualization
│   └── assets/                              # Static assets
├── public/
│   └── Normal.glb                           # 3D face model
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs                           # Tauri app init + crabcamera plugin
│   │   └── main.rs                          # Entry point
│   ├── Cargo.toml                           # Rust dependencies
│   └── tauri.conf.json                      # Tauri configuration
└── package.json                             # Frontend dependencies
```

## Performance Characteristics
- **Initialization**: ~2-3 seconds (model loading + camera setup)
- **Frame Processing**: ~50ms per frame (MediaPipe inference)
- **3D Rendering**: 60 FPS (Three.js animation loop)
- **Memory Usage**: ~200-300 MB (MediaPipe models + Three.js scene)

## Future Improvements
- Add camera selection UI for multiple cameras
- Implement gaze tracking visualization (crosshair overlay)
- Add recording functionality for debugging
- Optimize MediaPipe settings for lower latency
- Add error recovery for camera disconnection
