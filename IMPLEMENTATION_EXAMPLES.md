# Implementation Guide - Code Examples

This guide provides detailed code examples for implementing the architecture defined in `ARCHITECTURE_PLAN.md`.

---

## 1. System Overlay Implementation

### 1.1 Swipe Gesture Hook

```typescript
// src/hooks/useSwipeGesture.ts

import { useState, useRef, useCallback, useEffect } from 'react';

interface SwipeGestureOptions {
  edgeThreshold?: number;      // Distance from top edge to trigger (default: 30px)
  activationDistance?: number; // Min swipe distance to activate (default: 50px)
  onActivate?: () => void;
  onDeactivate?: () => void;
}

interface SwipeGestureState {
  isActive: boolean;
  progress: number;  // 0-1 representing overlay visibility
  isDragging: boolean;
}

export function useSwipeGesture(options: SwipeGestureOptions = {}) {
  const {
    edgeThreshold = 30,
    activationDistance = 50,
    onActivate,
    onDeactivate,
  } = options;

  const [state, setState] = useState<SwipeGestureState>({
    isActive: false,
    progress: 0,
    isDragging: false,
  });

  const touchStartY = useRef<number>(0);
  const touchStartedInEdge = useRef<boolean>(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    if (touch.clientY <= edgeThreshold) {
      touchStartY.current = touch.clientY;
      touchStartedInEdge.current = true;
      setState(prev => ({ ...prev, isDragging: true }));
    }
  }, [edgeThreshold]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchStartedInEdge.current) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStartY.current;
    
    if (deltaY > 0) {
      const maxDistance = 200; // Full overlay height
      const progress = Math.min(deltaY / maxDistance, 1);
      setState(prev => ({ ...prev, progress }));

      if (deltaY >= activationDistance && !state.isActive) {
        setState(prev => ({ ...prev, isActive: true }));
        onActivate?.();
      }
    }
  }, [activationDistance, state.isActive, onActivate]);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartedInEdge.current) return;

    touchStartedInEdge.current = false;
    setState(prev => ({
      ...prev,
      isDragging: false,
      progress: prev.isActive ? 1 : 0,
    }));
  }, []);

  const dismiss = useCallback(() => {
    setState({ isActive: false, progress: 0, isDragging: false });
    onDeactivate?.();
  }, [onDeactivate]);

  useEffect(() => {
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { ...state, dismiss };
}
```

### 1.2 System Overlay Component

```typescript
// src/components/overlay/SystemOverlay.tsx

import { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import './SystemOverlay.css';

interface SystemOverlayProps {
  children?: React.ReactNode;
}

export function SystemOverlay({ children }: SystemOverlayProps) {
  const [brightness, setBrightness] = useState(50);
  const [volume, setVolume] = useState(50);
  const [isInitialized, setIsInitialized] = useState(false);

  const { isActive, progress, isDragging, dismiss } = useSwipeGesture({
    onActivate: () => loadCurrentValues(),
  });

  // Auto-dismiss after 5 seconds of inactivity
  useEffect(() => {
    if (!isActive) return;
    
    const timeout = setTimeout(dismiss, 5000);
    return () => clearTimeout(timeout);
  }, [isActive, brightness, volume, dismiss]);

  const loadCurrentValues = async () => {
    try {
      const [currentBrightness, currentVolume] = await Promise.all([
        invoke<number>('get_brightness'),
        invoke<number>('get_volume'),
      ]);
      setBrightness(currentBrightness);
      setVolume(currentVolume);
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to load system values:', error);
    }
  };

  const handleBrightnessChange = useCallback(async (value: number) => {
    setBrightness(value);
    try {
      await invoke('set_brightness', { level: value });
    } catch (error) {
      console.error('Failed to set brightness:', error);
    }
  }, []);

  const handleVolumeChange = useCallback(async (value: number) => {
    setVolume(value);
    try {
      await invoke('set_volume', { level: value });
    } catch (error) {
      console.error('Failed to set volume:', error);
    }
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      dismiss();
    }
  };

  return (
    <>
      {children}
      
      {/* Overlay Backdrop */}
      {isActive && (
        <div 
          className="system-overlay-backdrop"
          onClick={handleBackdropClick}
        />
      )}

      {/* Overlay Panel */}
      <div
        className={`system-overlay-panel ${isActive ? 'active' : ''}`}
        style={{
          transform: `translateY(${isDragging ? (progress * 100) - 100 : isActive ? 0 : -100}%)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="overlay-content">
          {/* Brightness Control */}
          <div className="control-row">
            <span className="control-icon">☀️</span>
            <span className="control-label">Brightness</span>
            <input
              type="range"
              min="5"
              max="100"
              value={brightness}
              onChange={(e) => handleBrightnessChange(Number(e.target.value))}
              className="control-slider"
            />
            <span className="control-value">{brightness}%</span>
          </div>

          {/* Volume Control */}
          <div className="control-row">
            <span className="control-icon">🔊</span>
            <span className="control-label">Volume</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="control-slider"
            />
            <span className="control-value">{volume}%</span>
          </div>

          {/* Drag Handle */}
          <div className="drag-handle" />
        </div>
      </div>
    </>
  );
}
```

### 1.3 System Overlay Styles

```css
/* src/components/overlay/SystemOverlay.css */

.system-overlay-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  z-index: 999;
  animation: fadeIn 0.2s ease-out;
}

.system-overlay-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: linear-gradient(180deg, rgba(30, 30, 30, 0.98) 0%, rgba(20, 20, 20, 0.95) 100%);
  border-bottom-left-radius: 24px;
  border-bottom-right-radius: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  padding: 20px 24px 16px;
}

.overlay-content {
  max-width: 500px;
  margin: 0 auto;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
}

.control-icon {
  font-size: 24px;
  width: 40px;
  text-align: center;
}

.control-label {
  color: rgba(255, 255, 255, 0.9);
  font-size: 16px;
  width: 100px;
}

.control-slider {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.2);
  appearance: none;
  cursor: pointer;
}

.control-slider::-webkit-slider-thumb {
  appearance: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  cursor: grab;
}

.control-slider::-webkit-slider-thumb:active {
  cursor: grabbing;
  transform: scale(1.1);
}

.control-value {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  width: 50px;
  text-align: right;
}

.drag-handle {
  width: 40px;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  margin: 12px auto 0;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

---

## 2. Rust Backend Commands

### 2.1 System Control Commands

```rust
// src-tauri/src/commands/system.rs

use std::process::Command;

/// Detect available audio backend
#[derive(Debug, Clone, Copy)]
enum AudioBackend {
    PipeWire,
    PulseAudio,
    Alsa,
}

fn detect_audio_backend() -> AudioBackend {
    // Check for PipeWire first (modern systems)
    if Command::new("wpctl")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        return AudioBackend::PipeWire;
    }

    // Check for PulseAudio
    if Command::new("pactl")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        return AudioBackend::PulseAudio;
    }

    // Fallback to ALSA
    AudioBackend::Alsa
}

/// Get current display brightness (0-100)
#[tauri::command]
pub fn get_brightness() -> Result<u8, String> {
    // Get current brightness
    let current = Command::new("brightnessctl")
        .arg("get")
        .output()
        .map_err(|e| format!("Failed to get brightness: {}", e))?;

    let current_str = String::from_utf8_lossy(&current.stdout).trim().to_string();
    let current_val: f64 = current_str
        .parse()
        .map_err(|_| "Failed to parse current brightness")?;

    // Get max brightness
    let max = Command::new("brightnessctl")
        .arg("max")
        .output()
        .map_err(|e| format!("Failed to get max brightness: {}", e))?;

    let max_str = String::from_utf8_lossy(&max.stdout).trim().to_string();
    let max_val: f64 = max_str
        .parse()
        .map_err(|_| "Failed to parse max brightness")?;

    let percentage = ((current_val / max_val) * 100.0).round() as u8;
    Ok(percentage)
}

/// Set display brightness (0-100)
#[tauri::command]
pub fn set_brightness(level: u8) -> Result<(), String> {
    // Clamp to safe range (never fully black)
    let safe_level = level.clamp(5, 100);

    Command::new("brightnessctl")
        .args(["set", &format!("{}%", safe_level)])
        .output()
        .map_err(|e| format!("Failed to set brightness: {}", e))?;

    Ok(())
}

/// Get current speaker volume (0-100)
#[tauri::command]
pub fn get_volume() -> Result<u8, String> {
    match detect_audio_backend() {
        AudioBackend::PipeWire => get_volume_pipewire(),
        AudioBackend::PulseAudio => get_volume_pulseaudio(),
        AudioBackend::Alsa => get_volume_alsa(),
    }
}

fn get_volume_pipewire() -> Result<u8, String> {
    let output = Command::new("wpctl")
        .args(["get-volume", "@DEFAULT_AUDIO_SINK@"])
        .output()
        .map_err(|e| format!("wpctl error: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    // Output format: "Volume: 0.50" (0.50 = 50%)
    if let Some(vol_str) = stdout.split_whitespace().nth(1) {
        let vol: f64 = vol_str.parse().unwrap_or(0.5);
        return Ok((vol * 100.0).round() as u8);
    }
    Ok(50)
}

fn get_volume_pulseaudio() -> Result<u8, String> {
    let output = Command::new("pactl")
        .args(["get-sink-volume", "@DEFAULT_SINK@"])
        .output()
        .map_err(|e| format!("pactl error: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    // Output contains percentage like "50%"
    for word in stdout.split_whitespace() {
        if word.ends_with('%') {
            if let Ok(vol) = word.trim_end_matches('%').parse::<u8>() {
                return Ok(vol);
            }
        }
    }
    Ok(50)
}

fn get_volume_alsa() -> Result<u8, String> {
    let output = Command::new("amixer")
        .args(["get", "Master"])
        .output()
        .map_err(|e| format!("amixer error: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    // Output contains "[50%]"
    for line in stdout.lines() {
        if let Some(start) = line.find('[') {
            if let Some(end) = line[start..].find('%') {
                if let Ok(vol) = line[start + 1..start + end].parse::<u8>() {
                    return Ok(vol);
                }
            }
        }
    }
    Ok(50)
}

/// Set speaker volume (0-100) - OUTPUT ONLY, never touches microphone
#[tauri::command]
pub fn set_volume(level: u8) -> Result<(), String> {
    let safe_level = level.clamp(0, 100);

    match detect_audio_backend() {
        AudioBackend::PipeWire => set_volume_pipewire(safe_level),
        AudioBackend::PulseAudio => set_volume_pulseaudio(safe_level),
        AudioBackend::Alsa => set_volume_alsa(safe_level),
    }
}

fn set_volume_pipewire(level: u8) -> Result<(), String> {
    Command::new("wpctl")
        .args([
            "set-volume",
            "@DEFAULT_AUDIO_SINK@",  // Sink = output only
            &format!("{}%", level),
        ])
        .output()
        .map_err(|e| format!("wpctl error: {}", e))?;
    Ok(())
}

fn set_volume_pulseaudio(level: u8) -> Result<(), String> {
    Command::new("pactl")
        .args([
            "set-sink-volume",  // Sink = output only
            "@DEFAULT_SINK@",
            &format!("{}%", level),
        ])
        .output()
        .map_err(|e| format!("pactl error: {}", e))?;
    Ok(())
}

fn set_volume_alsa(level: u8) -> Result<(), String> {
    Command::new("amixer")
        .args(["set", "Master", &format!("{}%", level)])
        .output()
        .map_err(|e| format!("amixer error: {}", e))?;
    Ok(())
}
```

### 2.2 Media Storage Commands

```rust
// src-tauri/src/commands/media.rs

use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::Local;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;

const MEDIA_BASE: &str = ".config/honeybee/media";
const PHOTOS_DIR: &str = "photos";
const AUDIO_DIR: &str = "audio";

#[derive(Debug, Serialize, Clone)]
pub struct MediaFile {
    pub path: String,
    pub name: String,
    pub timestamp: i64,
    pub size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<f32>,
}

fn get_media_dir(subdir: &str) -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let dir = home.join(MEDIA_BASE).join(subdir);

    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    Ok(dir)
}

fn generate_filename(prefix: &str, extension: &str) -> String {
    let now = Local::now();
    format!("{}_{}.{}", prefix, now.format("%Y%m%d_%H%M%S"), extension)
}

/// Save captured photo from base64 data
#[tauri::command]
pub fn save_photo(data: String) -> Result<MediaFile, String> {
    let photos_dir = get_media_dir(PHOTOS_DIR)?;
    let filename = generate_filename("photo", "jpg");
    let filepath = photos_dir.join(&filename);

    // Decode base64 (strip data URL prefix if present)
    let base64_data = data
        .strip_prefix("data:image/jpeg;base64,")
        .or_else(|| data.strip_prefix("data:image/png;base64,"))
        .unwrap_or(&data);

    let bytes = STANDARD
        .decode(base64_data)
        .map_err(|e| format!("Invalid base64: {}", e))?;

    fs::write(&filepath, &bytes).map_err(|e| format!("Failed to save photo: {}", e))?;

    let metadata = fs::metadata(&filepath).map_err(|e| format!("Metadata error: {}", e))?;

    Ok(MediaFile {
        path: filepath.to_string_lossy().to_string(),
        name: filename,
        timestamp: Local::now().timestamp(),
        size: metadata.len(),
        duration: None,
    })
}

/// List all photos sorted by date (newest first)
#[tauri::command]
pub fn list_photos() -> Result<Vec<MediaFile>, String> {
    let photos_dir = get_media_dir(PHOTOS_DIR)?;
    let mut photos: Vec<MediaFile> = Vec::new();

    if let Ok(entries) = fs::read_dir(&photos_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path
                .extension()
                .map(|e| e == "jpg" || e == "jpeg" || e == "png")
                .unwrap_or(false)
            {
                if let Ok(metadata) = fs::metadata(&path) {
                    let timestamp = metadata
                        .modified()
                        .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64)
                        .unwrap_or(0);

                    photos.push(MediaFile {
                        path: path.to_string_lossy().to_string(),
                        name: path.file_name().unwrap().to_string_lossy().to_string(),
                        timestamp,
                        size: metadata.len(),
                        duration: None,
                    });
                }
            }
        }
    }

    photos.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(photos)
}

/// Save recorded audio from base64 data
#[tauri::command]
pub fn save_audio(data: String, duration: f32) -> Result<MediaFile, String> {
    let audio_dir = get_media_dir(AUDIO_DIR)?;
    let filename = generate_filename("recording", "webm");
    let filepath = audio_dir.join(&filename);

    // Decode base64 (strip data URL prefix if present)
    let base64_data = data
        .strip_prefix("data:audio/webm;base64,")
        .or_else(|| data.strip_prefix("data:audio/ogg;base64,"))
        .unwrap_or(&data);

    let bytes = STANDARD
        .decode(base64_data)
        .map_err(|e| format!("Invalid base64: {}", e))?;

    fs::write(&filepath, &bytes).map_err(|e| format!("Failed to save audio: {}", e))?;

    let metadata = fs::metadata(&filepath).map_err(|e| format!("Metadata error: {}", e))?;

    Ok(MediaFile {
        path: filepath.to_string_lossy().to_string(),
        name: filename,
        timestamp: Local::now().timestamp(),
        size: metadata.len(),
        duration: Some(duration),
    })
}

/// List all audio files sorted by date (newest first)
#[tauri::command]
pub fn list_audio() -> Result<Vec<MediaFile>, String> {
    let audio_dir = get_media_dir(AUDIO_DIR)?;
    let mut audio_files: Vec<MediaFile> = Vec::new();

    if let Ok(entries) = fs::read_dir(&audio_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path
                .extension()
                .map(|e| e == "webm" || e == "ogg" || e == "wav")
                .unwrap_or(false)
            {
                if let Ok(metadata) = fs::metadata(&path) {
                    let timestamp = metadata
                        .modified()
                        .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64)
                        .unwrap_or(0);

                    audio_files.push(MediaFile {
                        path: path.to_string_lossy().to_string(),
                        name: path.file_name().unwrap().to_string_lossy().to_string(),
                        timestamp,
                        size: metadata.len(),
                        duration: None, // Could be extracted with audio library
                    });
                }
            }
        }
    }

    audio_files.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(audio_files)
}

/// Delete media file (with path validation for security)
#[tauri::command]
pub fn delete_media(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    // Security: Validate path is within our media directory
    let media_base = dirs::home_dir()
        .ok_or("Cannot determine home directory")?
        .join(MEDIA_BASE);

    let canonical_path = file_path
        .canonicalize()
        .map_err(|_| "File not found")?;

    let canonical_base = media_base
        .canonicalize()
        .map_err(|_| "Media directory not found")?;

    if !canonical_path.starts_with(&canonical_base) {
        return Err("Access denied: path outside media directory".to_string());
    }

    fs::remove_file(&file_path).map_err(|e| format!("Failed to delete: {}", e))?;

    Ok(())
}
```

---

## 3. Mini App Examples

### 3.1 Camera App

```typescript
// src/components/apps/camera/CameraApp.tsx

import { useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './CameraApp.css';

interface CameraAppProps {
  onBack: () => void;
}

export function CameraApp({ onBack }: CameraAppProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Initialize camera
  useEffect(() => {
    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Prefer back camera
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsReady(true);
        }
      } catch (error) {
        console.error('Camera access failed:', error);
      }
    }

    initCamera();

    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;

    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0);

    // Convert to base64
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setLastCapture(dataUrl);

    try {
      // Save via Rust backend
      await invoke('save_photo', { data: dataUrl });
      // Show success feedback
    } catch (error) {
      console.error('Failed to save photo:', error);
    }

    setIsCapturing(false);
  }, [isCapturing]);

  return (
    <div className="camera-app">
      {/* Header */}
      <div className="camera-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <h1>Camera</h1>
      </div>

      {/* Viewfinder */}
      <div className="viewfinder">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-preview"
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* Controls */}
      <div className="camera-controls">
        {/* Last capture thumbnail */}
        {lastCapture && (
          <div className="last-capture">
            <img src={lastCapture} alt="Last capture" />
          </div>
        )}

        {/* Capture button */}
        <button
          className={`capture-button ${isCapturing ? 'capturing' : ''}`}
          onClick={capturePhoto}
          disabled={!isReady || isCapturing}
        >
          <div className="capture-inner" />
        </button>

        {/* Spacer for symmetry */}
        <div className="control-spacer" />
      </div>
    </div>
  );
}
```

### 3.2 Audio Recorder App

```typescript
// src/components/apps/recorder/RecorderApp.tsx

import { useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './RecorderApp.css';

interface RecorderAppProps {
  onBack: () => void;
}

export function RecorderApp({ onBack }: RecorderAppProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Recording timer
  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setRecordingTime(t => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording]);

  // Waveform visualization
  const drawWaveform = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#3b82f6';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Setup audio analyser for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start recording
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Convert to base64 and save
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          try {
            await invoke('save_audio', {
              data: base64,
              duration: recordingTime,
            });
          } catch (error) {
            console.error('Failed to save audio:', error);
          }
        };
        reader.readAsDataURL(audioBlob);

        // Cleanup
        stream.getTracks().forEach(track => track.stop());
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      drawWaveform();
    } catch (error) {
      console.error('Microphone access failed:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="recorder-app">
      <div className="recorder-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <h1>Recorder</h1>
      </div>

      <div className="recorder-content">
        {/* Waveform */}
        <canvas
          ref={canvasRef}
          className="waveform-canvas"
          width={600}
          height={200}
        />

        {/* Timer */}
        <div className="recording-time">
          {isRecording && <span className="recording-dot" />}
          {formatTime(recordingTime)}
        </div>

        {/* Controls */}
        <div className="recorder-controls">
          {!isRecording ? (
            <button className="record-button" onClick={startRecording}>
              🎤 Start Recording
            </button>
          ) : (
            <button className="stop-button" onClick={stopRecording}>
              ⬛ Stop
            </button>
          )}
        </div>

        {/* Playback */}
        {audioUrl && !isRecording && (
          <div className="playback-section">
            <h3>Last Recording</h3>
            <audio src={audioUrl} controls className="audio-player" />
          </div>
        )}
      </div>
    </div>
  );
}
```

### 3.3 App Launcher Grid

```typescript
// src/components/home/AppLauncher.tsx

import { lazy, Suspense, useState } from 'react';
import './AppLauncher.css';

// Lazy load mini apps
const CalendarApp = lazy(() => import('../apps/calendar/CalendarApp'));
const CameraApp = lazy(() => import('../apps/camera/CameraApp'));
const PhotosApp = lazy(() => import('../apps/photos/PhotosApp'));
const RecorderApp = lazy(() => import('../apps/recorder/RecorderApp'));
const MusicApp = lazy(() => import('../apps/music/MusicApp'));

interface AppDefinition {
  id: string;
  name: string;
  icon: string;
  component: React.LazyExoticComponent<any>;
  color: string;
}

const apps: AppDefinition[] = [
  {
    id: 'calendar',
    name: 'Calendar',
    icon: '📅',
    component: CalendarApp,
    color: '#3b82f6',
  },
  {
    id: 'camera',
    name: 'Camera',
    icon: '📷',
    component: CameraApp,
    color: '#10b981',
  },
  {
    id: 'photos',
    name: 'Photos',
    icon: '🖼️',
    component: PhotosApp,
    color: '#f59e0b',
  },
  {
    id: 'recorder',
    name: 'Recorder',
    icon: '🎤',
    component: RecorderApp,
    color: '#ef4444',
  },
  {
    id: 'music',
    name: 'Music',
    icon: '🎵',
    component: MusicApp,
    color: '#8b5cf6',
  },
];

export function AppLauncher() {
  const [activeApp, setActiveApp] = useState<AppDefinition | null>(null);

  if (activeApp) {
    const AppComponent = activeApp.component;
    return (
      <Suspense fallback={<div className="app-loading">Loading...</div>}>
        <AppComponent onBack={() => setActiveApp(null)} />
      </Suspense>
    );
  }

  return (
    <div className="app-launcher">
      <h2 className="launcher-title">Apps</h2>
      <div className="app-grid">
        {apps.map((app) => (
          <button
            key={app.id}
            className="app-tile"
            onClick={() => setActiveApp(app)}
            style={{ '--app-color': app.color } as React.CSSProperties}
          >
            <span className="app-icon">{app.icon}</span>
            <span className="app-name">{app.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## 4. Updated Rust lib.rs

```rust
// src-tauri/src/lib.rs

mod commands;
mod ipc;

#[cfg(debug_assertions)]
use tauri::Manager;

use commands::wifi::{check_wifi_status, get_qr_code_image, start_qr_file_watcher, trigger_provisioning_retry};
use commands::system::{get_brightness, set_brightness, get_volume, set_volume};
use commands::media::{save_photo, list_photos, save_audio, list_audio, delete_media};
use ipc::provisioning::{check_provisioning_socket, start_provisioning_ipc_listener};
use ipc::voice_agent::{check_voice_agent_socket, start_voice_agent_ipc_listener};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // WiFi & Provisioning
            check_wifi_status,
            get_qr_code_image,
            check_provisioning_socket,
            trigger_provisioning_retry,
            check_voice_agent_socket,
            // System controls
            get_brightness,
            set_brightness,
            get_volume,
            set_volume,
            // Media storage
            save_photo,
            list_photos,
            save_audio,
            list_audio,
            delete_media,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            let app_handle = app.handle().clone();
            start_qr_file_watcher(app_handle);

            let app_handle_ipc = app.handle().clone();
            start_provisioning_ipc_listener(app_handle_ipc);

            let app_handle_voice = app.handle().clone();
            start_voice_agent_ipc_listener(app_handle_voice);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 5. Tauri Configuration Update

```json
// src-tauri/tauri.conf.json - Add asset protocol scope

{
  "app": {
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": ["$HOME/.config/honeybee/media/**"]
      }
    }
  }
}
```

---

## 6. Package.json Updates

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.9.1",
    "date-fns": "^3.3.1",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "three": "^0.181.2"
  }
}
```

---

This implementation guide provides the core code examples needed to implement the architecture. Each component is designed to be modular, touch-friendly, and follows the JavaScript-first approach with Rust only where system access is required.
