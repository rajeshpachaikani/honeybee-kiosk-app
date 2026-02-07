# Honeybee Kiosk App - Architecture Plan

## Executive Summary

This document outlines the architecture for two major features:
1. **Top Swipe System Overlay** (Brightness & Volume)
2. **Built-in Mini Apps** (Calendar, Camera, Photo Viewer, Audio Recorder, Music Player)

The design prioritizes **modularity**, **JavaScript-first approach**, and **kiosk stability**.

---

## 1. High-Level Architecture

### 1.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              HONEYBEE KIOSK APP                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                           FRONTEND (React + TypeScript)                     │ │
│  ├────────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                             │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │ │
│  │  │                         App Shell (App.tsx)                          │   │ │
│  │  │  ┌────────────┐  ┌────────────┐  ┌─────────────────────────────────┐│   │ │
│  │  │  │ Navigation │  │ App Router │  │  Global Context Providers       ││   │ │
│  │  │  │  Manager   │  │            │  │  (Media, Settings, Toast)       ││   │ │
│  │  │  └────────────┘  └────────────┘  └─────────────────────────────────┘│   │ │
│  │  └─────────────────────────────────────────────────────────────────────┘   │ │
│  │                                     │                                       │ │
│  │         ┌───────────────────────────┼───────────────────────────┐          │ │
│  │         ▼                           ▼                           ▼          │ │
│  │  ┌─────────────┐           ┌─────────────────┐          ┌──────────────┐   │ │
│  │  │ Home Screen │           │ System Overlay  │          │   Mini Apps  │   │ │
│  │  │ (EyeTracker │           │    (Swipe)      │          │   Container  │   │ │
│  │  │  + Status)  │           │                 │          │              │   │ │
│  │  └─────────────┘           │ ┌────────────┐  │          │ ┌──────────┐ │   │ │
│  │                            │ │ Brightness │  │          │ │ Calendar │ │   │ │
│  │                            │ │   Slider   │  │          │ ├──────────┤ │   │ │
│  │                            │ ├────────────┤  │          │ │  Camera  │ │   │ │
│  │                            │ │  Volume    │  │          │ ├──────────┤ │   │ │
│  │                            │ │  Slider    │  │          │ │  Photos  │ │   │ │
│  │                            │ └────────────┘  │          │ ├──────────┤ │   │ │
│  │                            └─────────────────┘          │ │ Recorder │ │   │ │
│  │                                                         │ ├──────────┤ │   │ │
│  │                                                         │ │  Music   │ │   │ │
│  │                                                         │ └──────────┘ │   │ │
│  │                                                         └──────────────┘   │ │
│  │                                                                             │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │ │
│  │  │                      Shared Components                               │   │ │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │   │ │
│  │  │  │  Slider  │ │  Button  │ │  Modal   │ │  Toast   │ │ MediaCard │  │   │ │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └───────────┘  │   │ │
│  │  └─────────────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                           │
│                            Tauri IPC │ (invoke / listen)                        │
│                                      ▼                                           │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                           BACKEND (Rust)                                    │ │
│  ├────────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                             │ │
│  │  ┌──────────────────────────────────────────────────────────────────────┐  │ │
│  │  │                         Command Modules                               │  │ │
│  │  │  ┌──────────────┐  ┌───────────────┐  ┌───────────────────────────┐  │  │ │
│  │  │  │   System     │  │    Media      │  │    Existing Commands      │  │  │ │
│  │  │  │  Controls    │  │   Storage     │  │  (WiFi, Provisioning,     │  │  │ │
│  │  │  │              │  │               │  │   Voice Agent IPC)        │  │  │ │
│  │  │  │ • brightness │  │ • save_photo  │  │                           │  │  │ │
│  │  │  │ • volume     │  │ • list_photos │  │                           │  │  │ │
│  │  │  └──────────────┘  │ • save_audio  │  └───────────────────────────┘  │  │ │
│  │  │                    │ • list_audio  │                                  │  │ │
│  │  │                    │ • delete_*    │                                  │  │ │
│  │  │                    └───────────────┘                                  │  │ │
│  │  └──────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                             │ │
│  │  ┌──────────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    Linux System Integration                           │  │ │
│  │  │  ┌────────────────────┐       ┌────────────────────────────────────┐ │  │ │
│  │  │  │  brightnessctl     │       │  PipeWire / PulseAudio / ALSA      │ │  │ │
│  │  │  │  (display control) │       │  (audio volume - speaker only)     │ │  │ │
│  │  │  └────────────────────┘       └────────────────────────────────────┘ │  │ │
│  │  └──────────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                         FILE SYSTEM (Sandboxed)                             │ │
│  │  ~/.config/honeybee/                                                        │ │
│  │    ├── media/                                                               │ │
│  │    │   ├── photos/          # Captured images                               │ │
│  │    │   │   └── *.jpg                                                        │ │
│  │    │   └── audio/           # Recorded audio                                │ │
│  │    │       └── *.webm                                                       │ │
│  │    └── qr/                  # Existing QR directory                         │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Frontend vs Backend Responsibility Matrix

| Feature | JavaScript (Frontend) | Rust (Backend) |
|---------|----------------------|----------------|
| **System Overlay** | | |
| - Swipe detection & gesture | ✅ Touch events | - |
| - Overlay animation | ✅ CSS transitions | - |
| - Slider UI components | ✅ React components | - |
| - Brightness control | Invoke command | ✅ `brightnessctl` |
| - Volume control | Invoke command | ✅ PipeWire/Pulse/ALSA |
| **Mini Apps** | | |
| - Calendar | ✅ Full JS (date-fns) | - |
| - Camera capture | ✅ Web API (MediaDevices) | Fallback only |
| - Photo viewer | ✅ Full JS | ✅ List files |
| - Audio recorder | ✅ Web API (MediaRecorder) | Fallback only |
| - Music player | ✅ Web Audio API | ✅ List files |
| **Media Storage** | - | ✅ Secure paths |
| - Save media | Invoke with blob | ✅ Write to sandboxed dir |
| - List media | Invoke command | ✅ Read directory |
| - Delete media | Invoke command | ✅ Delete files |

---

## 2. Project Structure

### 2.1 Proposed Frontend Structure

```
src/
├── App.tsx                          # Main app shell with router
├── App.css                          # Global styles
├── main.tsx                         # Entry point
├── vite-env.d.ts
│
├── types/                           # Shared TypeScript types
│   ├── index.ts
│   ├── media.ts                     # Photo, Audio types
│   ├── system.ts                    # Brightness, Volume types
│   └── provisioning.ts              # Existing types extracted
│
├── hooks/                           # Custom React hooks
│   ├── useSwipeGesture.ts           # Top swipe detection
│   ├── useBrightness.ts             # Brightness control
│   ├── useVolume.ts                 # Volume control
│   ├── useMediaStorage.ts           # Media file operations
│   ├── useCamera.ts                 # Camera access
│   ├── useAudioRecorder.ts          # Audio recording
│   └── useWebSocket.ts              # Extracted from EyeTracker
│
├── context/                         # React Context providers
│   ├── AppContext.tsx               # Global app state
│   ├── MediaContext.tsx             # Media files state
│   └── ToastContext.tsx             # Notifications
│
├── components/                      # UI Components
│   ├── shared/                      # Reusable components
│   │   ├── Slider.tsx               # Touch-friendly slider
│   │   ├── Button.tsx               # Kiosk button
│   │   ├── Modal.tsx                # Full-screen modal
│   │   ├── Toast.tsx                # Notification toast
│   │   ├── MediaCard.tsx            # Photo/Audio card
│   │   ├── LoadingSpinner.tsx
│   │   └── IconButton.tsx
│   │
│   ├── home/                        # Home screen components
│   │   ├── HomeScreen.tsx           # Main home view
│   │   ├── EyeTracker.tsx           # Refactored (3D only)
│   │   ├── StatusOverlays.tsx       # WiFi, Provisioning overlays
│   │   ├── VoiceAgentStatus.tsx     # Voice quota display
│   │   └── AppLauncher.tsx          # Mini apps grid
│   │
│   ├── overlay/                     # System overlay
│   │   ├── SystemOverlay.tsx        # Main overlay container
│   │   ├── SwipeDetector.tsx        # Edge swipe detection
│   │   ├── BrightnessControl.tsx    # Brightness slider
│   │   └── VolumeControl.tsx        # Volume slider (speaker only)
│   │
│   └── apps/                        # Mini applications
│       ├── AppContainer.tsx         # Wrapper for all mini apps
│       ├── calendar/
│       │   ├── CalendarApp.tsx
│       │   ├── CalendarGrid.tsx
│       │   └── DayCell.tsx
│       ├── camera/
│       │   ├── CameraApp.tsx
│       │   ├── CameraPreview.tsx
│       │   └── CaptureButton.tsx
│       ├── photos/
│       │   ├── PhotosApp.tsx
│       │   ├── PhotoGrid.tsx
│       │   └── PhotoViewer.tsx
│       ├── recorder/
│       │   ├── RecorderApp.tsx
│       │   ├── WaveformVisualizer.tsx
│       │   └── RecordingControls.tsx
│       └── music/
│           ├── MusicApp.tsx
│           ├── TrackList.tsx
│           └── PlayerControls.tsx
│
├── services/                        # Tauri IPC wrappers
│   ├── systemService.ts             # Brightness, volume commands
│   ├── mediaService.ts              # Photo, audio file operations
│   └── provisioningService.ts       # Existing IPC extracted
│
├── utils/                           # Utility functions
│   ├── formatters.ts                # Date, time, file size
│   ├── mediaHelpers.ts              # Blob, base64 conversions
│   └── constants.ts                 # App constants
│
└── styles/                          # CSS modules
    ├── variables.css                # CSS custom properties
    ├── animations.css               # Shared animations
    ├── overlay.css                  # System overlay styles
    └── apps.css                     # Mini app styles
```

### 2.2 Proposed Backend Structure

```
src-tauri/src/
├── main.rs                          # Entry point (unchanged)
├── lib.rs                           # App builder with commands
│
├── commands/                        # Command modules
│   ├── mod.rs                       # Module exports
│   ├── wifi.rs                      # WiFi commands (extracted)
│   ├── qr.rs                        # QR commands (extracted)
│   ├── system.rs                    # NEW: Brightness, Volume
│   └── media.rs                     # NEW: Media storage
│
├── ipc/                             # IPC modules
│   ├── mod.rs
│   ├── provisioning.rs              # Renamed from provisioning_ipc.rs
│   └── voice_agent.rs               # Renamed from voice_agent_ipc.rs
│
└── utils/                           # Utilities
    ├── mod.rs
    └── paths.rs                     # Sandboxed path helpers
```

---

## 3. Feature 1: Top Swipe System Overlay

### 3.1 UI Behavior

```
┌─────────────────────────────────────────────────────────────────┐
│ ▼▼▼  SWIPE DOWN FROM TOP EDGE  ▼▼▼                              │  ← Invisible trigger zone (30px)
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    SYSTEM OVERLAY                          │  │
│  │                    (Slides down with spring animation)     │  │
│  │                                                            │  │
│  │   ☀️ Brightness ─────────────────────────────●──────  85%  │  │
│  │                                                            │  │
│  │   🔊 Volume     ───────────────●──────────────────────  50%│  │
│  │                                                            │  │
│  │                 ─────────────────────────────              │  │
│  │                       (Drag handle)                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│                     (Background: blurred app content)           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Dismissal triggers:
  • Swipe up on overlay
  • Tap outside overlay
  • 5-second auto-dismiss after last interaction
```

### 3.2 Swipe Detection Implementation

```typescript
// hooks/useSwipeGesture.ts

interface SwipeConfig {
  edgeThreshold: number;    // Distance from edge to trigger (30px)
  swipeThreshold: number;   // Minimum swipe distance (50px)
  velocityThreshold: number; // Minimum velocity (0.3)
}

export function useSwipeGesture(config: SwipeConfig) {
  // Touch event handling
  // Only activates when touch starts within edgeThreshold of top
  // Tracks velocity for natural feel
  // Returns { isActive, progress, dismiss }
}
```

### 3.3 Rust Backend: System Controls

```rust
// src-tauri/src/commands/system.rs

/// Get current display brightness (0-100)
#[tauri::command]
pub fn get_brightness() -> Result<u8, String> {
    // Uses: brightnessctl get && brightnessctl max
    // Returns: percentage
}

/// Set display brightness (0-100)
#[tauri::command]
pub fn set_brightness(level: u8) -> Result<(), String> {
    // Uses: brightnessctl set {level}%
    // Clamps to 5-100 (never fully black)
}

/// Get current speaker volume (0-100)
#[tauri::command]
pub fn get_volume() -> Result<u8, String> {
    // Priority: PipeWire > PulseAudio > ALSA
    // PipeWire: wpctl get-volume @DEFAULT_AUDIO_SINK@
    // PulseAudio: pactl get-sink-volume @DEFAULT_SINK@
    // ALSA: amixer get Master
}

/// Set speaker volume (0-100) - OUTPUT ONLY
#[tauri::command]
pub fn set_volume(level: u8) -> Result<(), String> {
    // PipeWire: wpctl set-volume @DEFAULT_AUDIO_SINK@ {level}%
    // PulseAudio: pactl set-sink-volume @DEFAULT_SINK@ {level}%
    // ALSA: amixer set Master {level}%
    // NOTE: Never touches INPUT/microphone volume
}
```

### 3.4 OS-Level Integration Strategy (Linux)

| Control | Primary Method | Fallback | Package Required |
|---------|---------------|----------|------------------|
| **Brightness** | `brightnessctl` | Direct sysfs write | `brightnessctl` |
| **Volume** | PipeWire (`wpctl`) | PulseAudio (`pactl`) → ALSA (`amixer`) | pipewire / pulseaudio / alsa-utils |

**Detection Order:**
```rust
fn detect_audio_backend() -> AudioBackend {
    if Command::new("wpctl").arg("--version").status().is_ok() {
        AudioBackend::PipeWire
    } else if Command::new("pactl").arg("--version").status().is_ok() {
        AudioBackend::PulseAudio
    } else {
        AudioBackend::Alsa
    }
}
```

---

## 4. Feature 2: Built-in Mini Apps

### 4.1 App Navigation Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                         HOME SCREEN                               │
│                                                                   │
│                       ┌─────────────────┐                        │
│                       │                 │                        │
│                       │   3D EyeTracker │                        │
│                       │     Avatar      │                        │
│                       │                 │                        │
│                       └─────────────────┘                        │
│                                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ 📅       │ │ 📷       │ │ 🖼️       │ │ 🎤       │ │ 🎵     │ │
│  │ Calendar │ │ Camera   │ │ Photos   │ │ Recorder │ │ Music  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                                   │
│                        (App Launcher Grid)                        │
└──────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
          ┌─────────────────┐   ┌─────────────────┐
          │   Full-Screen   │   │   Full-Screen   │
          │    Mini App     │   │    Mini App     │
          │                 │   │                 │
          │  ← Back button  │   │  ← Back button  │
          │  (top-left)     │   │  (top-left)     │
          └─────────────────┘   └─────────────────┘
```

### 4.2 Mini App Specifications

#### 4.2.1 Calendar App

```typescript
// components/apps/calendar/CalendarApp.tsx

Features:
- Current month view with day cells
- Navigation: previous/next month
- Highlight current day
- Touch-friendly large targets
- No event storage (view only)

Libraries:
- date-fns (lightweight date manipulation)

State:
- currentMonth: Date
- selectedDay: Date | null
```

#### 4.2.2 Camera App

```typescript
// components/apps/camera/CameraApp.tsx

Features:
- Live camera preview (Web API: navigator.mediaDevices)
- Capture button
- Last capture thumbnail
- Switch camera (if multiple)
- Full-screen viewfinder

Web APIs Used:
- navigator.mediaDevices.getUserMedia()
- ImageCapture API (or canvas fallback)

Capture Flow:
1. User taps capture button
2. Canvas captures frame from video stream
3. Canvas exported as Blob (JPEG, 85% quality)
4. Blob sent to Rust via invoke('save_photo', { data: base64 })
5. Rust saves to ~/.config/honeybee/media/photos/
6. Toast notification shown
```

#### 4.2.3 Photo Viewer App

```typescript
// components/apps/photos/PhotosApp.tsx

Features:
- Grid view of all photos
- Tap to view full-screen
- Swipe left/right in viewer
- Delete option
- Sort by date (newest first)

Data Flow:
1. invoke('list_photos') → returns array of { path, name, timestamp, size }
2. Photos displayed as <img src="asset://localhost/..." />
3. Tauri's asset protocol serves files securely
```

#### 4.2.4 Audio Recorder App

```typescript
// components/apps/recorder/RecorderApp.tsx

Features:
- Large record button
- Recording timer display
- Waveform visualization
- Stop and save
- Preview last recording

Web APIs Used:
- navigator.mediaDevices.getUserMedia({ audio: true })
- MediaRecorder API
- Web Audio API (for visualization)

Recording Flow:
1. User taps record
2. MediaRecorder starts with audio stream
3. AudioContext analyzes for waveform
4. User taps stop
5. Blob collected from MediaRecorder
6. invoke('save_audio', { data: base64, duration })
7. Saved to ~/.config/honeybee/media/audio/
```

#### 4.2.5 Music Player App

```typescript
// components/apps/music/MusicApp.tsx

Features:
- List of recorded audio files
- Now playing display
- Play/Pause/Skip controls
- Progress bar (seekable)
- Simple waveform or album art placeholder

Web APIs Used:
- HTML5 Audio element
- Tauri asset protocol for playback

Playback Flow:
1. invoke('list_audio') → returns array of recordings
2. User selects track
3. <audio src="asset://localhost/..." /> loads file
4. Standard audio controls for playback
```

### 4.3 Media Storage Implementation

```rust
// src-tauri/src/commands/media.rs

const MEDIA_DIR: &str = ".config/honeybee/media";
const PHOTOS_DIR: &str = "photos";
const AUDIO_DIR: &str = "audio";

#[derive(Serialize)]
pub struct MediaFile {
    pub path: String,
    pub name: String,
    pub timestamp: i64,
    pub size: u64,
    pub duration: Option<f32>,  // For audio files
}

/// Save captured photo
#[tauri::command]
pub fn save_photo(data: String) -> Result<MediaFile, String> {
    // Decode base64
    // Generate filename: photo_YYYYMMDD_HHMMSS.jpg
    // Write to photos directory
    // Return MediaFile info
}

/// List all photos
#[tauri::command]
pub fn list_photos() -> Result<Vec<MediaFile>, String> {
    // Read photos directory
    // Sort by timestamp descending
    // Return list
}

/// Save recorded audio
#[tauri::command]
pub fn save_audio(data: String, duration: f32) -> Result<MediaFile, String> {
    // Decode base64
    // Generate filename: recording_YYYYMMDD_HHMMSS.webm
    // Write to audio directory
    // Return MediaFile info
}

/// List all audio files
#[tauri::command]
pub fn list_audio() -> Result<Vec<MediaFile>, String> {
    // Read audio directory
    // Sort by timestamp descending
    // Return list with duration
}

/// Delete media file (photo or audio)
#[tauri::command]
pub fn delete_media(path: String) -> Result<(), String> {
    // Validate path is within media directory (security!)
    // Delete file
}
```

### 4.4 Tauri Asset Protocol Configuration

```json
// src-tauri/tauri.conf.json - Add to security.assetProtocol

{
  "security": {
    "assetProtocol": {
      "enable": true,
      "scope": [
        "$HOME/.config/honeybee/media/**"
      ]
    }
  }
}
```

---

## 5. Media Handling Strategy

### 5.1 Storage Paths

```
~/.config/honeybee/
├── media/
│   ├── photos/
│   │   ├── photo_20260202_143052.jpg
│   │   ├── photo_20260202_143215.jpg
│   │   └── ...
│   └── audio/
│       ├── recording_20260202_150030.webm
│       ├── recording_20260202_151245.webm
│       └── ...
├── qr/                              (existing)
└── config.toml                      (future: app settings)
```

### 5.2 File Naming Convention

| Type | Format | Example |
|------|--------|---------|
| Photo | `photo_YYYYMMDD_HHMMSS.jpg` | `photo_20260202_143052.jpg` |
| Audio | `recording_YYYYMMDD_HHMMSS.webm` | `recording_20260202_150030.webm` |

### 5.3 Permissions & Security

1. **Sandboxed Paths**: All media operations use `dirs::home_dir()` + hardcoded relative paths
2. **Path Validation**: Delete operations validate path is within media directory
3. **No Direct File Picking**: Users cannot browse filesystem
4. **Asset Protocol Scoped**: Only media directory exposed via asset protocol
5. **No Execute Permission**: Media files stored without execute bits

### 5.4 Storage Limits (Future Enhancement)

```rust
// Configurable limits
const MAX_PHOTOS: usize = 1000;
const MAX_AUDIO_FILES: usize = 500;
const MAX_STORAGE_MB: u64 = 2048;  // 2GB total

// Auto-cleanup: Delete oldest when limit reached
```

---

## 6. Recommended Libraries & APIs

### 6.1 JavaScript Libraries

| Library | Purpose | Size | Justification |
|---------|---------|------|---------------|
| **date-fns** | Calendar date handling | ~7KB | Lightweight, tree-shakeable |
| **@tauri-apps/api** | Tauri IPC (existing) | - | Already installed |
| **react-spring** | Overlay animations | ~25KB | Smooth physics-based animations |
| *(None)* | Audio visualization | - | Use native Web Audio API |

### 6.2 Web APIs (No Additional Libraries)

| API | Use Case | Browser Support |
|-----|----------|-----------------|
| `navigator.mediaDevices` | Camera, Microphone access | ✅ Chromium (Tauri WebView) |
| `MediaRecorder` | Audio recording | ✅ Chromium |
| `ImageCapture` | Photo capture | ✅ Chromium (with polyfill) |
| `Web Audio API` | Waveform visualization | ✅ Chromium |
| `Touch Events` | Swipe detection | ✅ All |
| `CSS Transitions` | Animations | ✅ All |

### 6.3 Rust Crates (Backend)

| Crate | Purpose | Already Installed |
|-------|---------|-------------------|
| `serde` | Serialization | ✅ Yes |
| `serde_json` | JSON handling | ✅ Yes |
| `tokio` | Async runtime | ✅ Yes |
| `base64` | Media encoding | ✅ Yes |
| `dirs` | Home directory | ✅ Yes |
| `chrono` | Timestamps | ❌ Add |

### 6.4 System Utilities (Linux)

| Utility | Package | Purpose |
|---------|---------|---------|
| `brightnessctl` | brightnessctl | Display brightness |
| `wpctl` | wireplumber | PipeWire volume |
| `pactl` | pulseaudio-utils | PulseAudio volume |
| `amixer` | alsa-utils | ALSA volume fallback |

---

## 7. Scalability Considerations

### 7.1 Adding New Mini Apps

**Steps to add a new app:**

1. Create folder: `src/components/apps/new-app/`
2. Create main component: `NewApp.tsx`
3. Add to app registry in `AppLauncher.tsx`
4. Add icon and metadata
5. (Optional) Add Rust commands if needed

**App Registry Pattern:**

```typescript
// utils/appRegistry.ts

export const miniApps = [
  {
    id: 'calendar',
    name: 'Calendar',
    icon: '📅',
    component: lazy(() => import('./apps/calendar/CalendarApp')),
  },
  {
    id: 'camera',
    name: 'Camera',
    icon: '📷',
    component: lazy(() => import('./apps/camera/CameraApp')),
    permissions: ['camera'],
  },
  // ... easy to extend
];
```

### 7.2 Maintaining Kiosk Stability

| Strategy | Implementation |
|----------|----------------|
| **Error Boundaries** | Wrap each mini app in React Error Boundary |
| **Lazy Loading** | Code-split mini apps with `React.lazy()` |
| **Resource Cleanup** | Stop camera/audio streams on app unmount |
| **Memory Limits** | Limit cached images in photo viewer |
| **Graceful Degradation** | Show error UI, allow return to home |
| **State Isolation** | Each app has isolated state container |

### 7.3 Component Isolation

```typescript
// Each mini app wrapped with error handling

<ErrorBoundary
  fallback={<AppErrorFallback onReturnHome={goHome} />}
  onError={(error) => logError('MiniApp', error)}
>
  <Suspense fallback={<AppLoader />}>
    <MiniAppComponent />
  </Suspense>
</ErrorBoundary>
```

---

## 8. Implementation Phases

### Phase 1: Refactoring (Foundation)
- [ ] Extract types from EyeTracker.tsx
- [ ] Create hook files (useWebSocket, etc.)
- [ ] Create services layer
- [ ] Split EyeTracker into smaller components
- [ ] Set up component folder structure

### Phase 2: System Overlay
- [ ] Implement swipe detection hook
- [ ] Create overlay component with animation
- [ ] Add Rust brightness command
- [ ] Add Rust volume command
- [ ] Integrate sliders with backend
- [ ] Test on target hardware

### Phase 3: Mini Apps Infrastructure
- [ ] Create AppContainer wrapper
- [ ] Build AppLauncher grid
- [ ] Implement app navigation
- [ ] Set up media service layer
- [ ] Add Rust media commands

### Phase 4: Mini Apps Implementation
- [ ] Calendar app (simplest first)
- [ ] Camera app
- [ ] Photo viewer app
- [ ] Audio recorder app
- [ ] Music player app

### Phase 5: Polish & Testing
- [ ] Error boundaries
- [ ] Touch optimization
- [ ] Performance testing
- [ ] Memory leak testing
- [ ] Edge case handling

---

## 9. Summary

This architecture provides:

✅ **Modularity**: Each feature is isolated in its own module  
✅ **JavaScript-First**: Maximum use of Web APIs  
✅ **Minimal Rust**: Only where system access is required  
✅ **Kiosk Safety**: No file system exposure, sandboxed storage  
✅ **Scalability**: Easy to add new mini apps  
✅ **Touch-Friendly**: Designed for kiosk interaction  
✅ **Stability**: Error boundaries, lazy loading, resource cleanup  

The implementation maintains the existing EyeTracker functionality while adding powerful new features in a structured, maintainable way.
