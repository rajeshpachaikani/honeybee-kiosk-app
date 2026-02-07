use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use chrono::Local;
use std::{
    fs,
    io::{Cursor, Write},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::{Duration, Instant},
};
use parking_lot::Mutex;
use tauri::{AppHandle, Emitter};

const RECORDINGS_DIR: &str = "honeybee-recordings";

static RECORDING: AtomicBool = AtomicBool::new(false);
static STOP_RECORDING: AtomicBool = AtomicBool::new(false);

lazy_static::lazy_static! {
    static ref RECORDING_SAMPLES: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
    static ref SAMPLE_RATE: Arc<Mutex<u32>> = Arc::new(Mutex::new(44100));
    static ref CHANNELS: Arc<Mutex<u16>> = Arc::new(Mutex::new(1));
}

#[derive(Clone, serde::Serialize)]
pub struct RecordingStatus {
    pub recording: bool,
    pub duration_ms: u64,
}

#[derive(Clone, serde::Serialize)]
pub struct RecordingSaved {
    pub path: String,
    pub filename: String,
    pub duration_ms: u64,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Clone, serde::Serialize)]
pub struct RecordingInfo {
    pub filename: String,
    pub path: String,
    pub size: u64,
    pub modified: u64,
}

/// Start recording audio
#[tauri::command]
pub async fn start_recording(app: AppHandle) -> Result<String, String> {
    if RECORDING.load(Ordering::SeqCst) {
        return Ok("Already recording".to_string());
    }

    STOP_RECORDING.store(false, Ordering::SeqCst);

    // Clear previous samples
    {
        let mut samples = RECORDING_SAMPLES.lock();
        samples.clear();
    }

    let app_handle = app.clone();
    thread::spawn(move || {
        run_recording(app_handle);
    });

    Ok("Recording started".to_string())
}

/// Stop recording and save
#[tauri::command]
pub async fn stop_recording(app: AppHandle) -> Result<RecordingSaved, String> {
    if !RECORDING.load(Ordering::SeqCst) {
        return Err("Not recording".to_string());
    }

    STOP_RECORDING.store(true, Ordering::SeqCst);

    // Wait for recording thread to finish
    let mut attempts = 0;
    while RECORDING.load(Ordering::SeqCst) && attempts < 100 {
        thread::sleep(Duration::from_millis(50));
        attempts += 1;
    }

    // Get recorded samples
    let samples = {
        let guard = RECORDING_SAMPLES.lock();
        guard.clone()
    };
    let rate = *SAMPLE_RATE.lock();
    let ch = *CHANNELS.lock();

    if samples.is_empty() {
        let result = RecordingSaved {
            path: String::new(),
            filename: String::new(),
            duration_ms: 0,
            success: false,
            error: Some("No audio data recorded".to_string()),
        };
        let _ = app.emit("recording-saved", result.clone());
        return Ok(result);
    }

    let duration_ms = (samples.len() as u64 * 1000) / (rate as u64 * ch as u64);

    // Save as WAV
    match save_wav(&samples, rate, ch) {
        Ok((path, filename)) => {
            let result = RecordingSaved {
                path,
                filename,
                duration_ms,
                success: true,
                error: None,
            };
            let _ = app.emit("recording-saved", result.clone());
            Ok(result)
        }
        Err(e) => {
            let result = RecordingSaved {
                path: String::new(),
                filename: String::new(),
                duration_ms,
                success: false,
                error: Some(e.clone()),
            };
            let _ = app.emit("recording-saved", result.clone());
            Err(e)
        }
    }
}

/// List all recordings
#[tauri::command]
pub async fn list_recordings() -> Result<Vec<RecordingInfo>, String> {
    let music_dir = dirs::audio_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join("Music")))
        .ok_or("Failed to get Music directory")?;
    let rec_dir = music_dir.join(RECORDINGS_DIR);

    if !rec_dir.exists() {
        return Ok(Vec::new());
    }

    let mut recordings: Vec<RecordingInfo> = Vec::new();

    let entries = fs::read_dir(&rec_dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if let Some(ext) = path.extension() {
            if ext.to_string_lossy().to_lowercase() == "wav" {
                if let Ok(metadata) = entry.metadata() {
                    let modified = metadata
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    recordings.push(RecordingInfo {
                        filename: entry.file_name().to_string_lossy().to_string(),
                        path: path.to_string_lossy().to_string(),
                        size: metadata.len(),
                        modified,
                    });
                }
            }
        }
    }

    recordings.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(recordings)
}

/// Read audio file as base64 data URL
#[tauri::command]
pub async fn read_audio_file(path: String) -> Result<String, String> {
    use base64::Engine;
    let data = fs::read(&path).map_err(|e| format!("Failed to read audio: {}", e))?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:audio/wav;base64,{}", b64))
}

/// Delete a recording
#[tauri::command]
pub async fn delete_recording(path: String) -> Result<bool, String> {
    let music_dir = dirs::audio_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join("Music")))
        .ok_or("Failed to get Music directory")?;
    let rec_dir = music_dir.join(RECORDINGS_DIR);
    let target = std::path::Path::new(&path);

    if !target.starts_with(&rec_dir) {
        return Err("Cannot delete files outside recordings directory".to_string());
    }

    fs::remove_file(&path).map_err(|e| format!("Failed to delete recording: {}", e))?;
    Ok(true)
}

/// Check if currently recording
#[tauri::command]
pub async fn is_recording() -> Result<bool, String> {
    Ok(RECORDING.load(Ordering::SeqCst))
}

fn run_recording(app: AppHandle) {
    RECORDING.store(true, Ordering::SeqCst);

    let host = cpal::default_host();
    let device = match host.default_input_device() {
        Some(d) => d,
        None => {
            let _ = app.emit("recording-error", "No input device found");
            RECORDING.store(false, Ordering::SeqCst);
            return;
        }
    };

    let config = match device.default_input_config() {
        Ok(c) => c,
        Err(e) => {
            let _ = app.emit("recording-error", format!("Failed to get input config: {}", e));
            RECORDING.store(false, Ordering::SeqCst);
            return;
        }
    };

    // Store config for WAV saving
    {
        *SAMPLE_RATE.lock() = config.sample_rate().0;
        *CHANNELS.lock() = config.channels();
    }

    let samples = RECORDING_SAMPLES.clone();
    let start_time = Instant::now();
    let app_tick = app.clone();

    let stream = match device.build_input_stream(
        &config.into(),
        move |data: &[f32], _: &cpal::InputCallbackInfo| {
            let mut guard = samples.lock();
            guard.extend_from_slice(data);
        },
        move |err| {
            eprintln!("Recording stream error: {}", err);
        },
        None,
    ) {
        Ok(s) => s,
        Err(e) => {
            let _ = app.emit("recording-error", format!("Failed to build stream: {}", e));
            RECORDING.store(false, Ordering::SeqCst);
            return;
        }
    };

    if let Err(e) = stream.play() {
        let _ = app.emit("recording-error", format!("Failed to start stream: {}", e));
        RECORDING.store(false, Ordering::SeqCst);
        return;
    }

    // Send duration updates
    loop {
        if STOP_RECORDING.load(Ordering::SeqCst) {
            break;
        }
        let elapsed = start_time.elapsed().as_millis() as u64;
        let _ = app_tick.emit("recording-status", RecordingStatus {
            recording: true,
            duration_ms: elapsed,
        });
        thread::sleep(Duration::from_millis(200));
    }

    drop(stream);
    RECORDING.store(false, Ordering::SeqCst);
    STOP_RECORDING.store(false, Ordering::SeqCst);
}

fn save_wav(samples: &[f32], sample_rate: u32, channels: u16) -> Result<(String, String), String> {
    let music_dir = dirs::audio_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join("Music")))
        .ok_or("Failed to get Music directory")?;
    let rec_dir = music_dir.join(RECORDINGS_DIR);

    if !rec_dir.exists() {
        fs::create_dir_all(&rec_dir)
            .map_err(|e| format!("Failed to create recordings directory: {}", e))?;
    }

    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let filename = format!("REC_{}.wav", timestamp);
    let filepath = rec_dir.join(&filename);

    // Write WAV manually
    let num_samples = samples.len() as u32;
    let bits_per_sample: u16 = 16;
    let byte_rate = sample_rate * channels as u32 * (bits_per_sample as u32 / 8);
    let block_align = channels * (bits_per_sample / 8);
    let data_size = num_samples * (bits_per_sample as u32 / 8);

    let mut buf = Cursor::new(Vec::new());

    // RIFF header
    buf.write_all(b"RIFF").map_err(|e| e.to_string())?;
    buf.write_all(&(36 + data_size).to_le_bytes()).map_err(|e| e.to_string())?;
    buf.write_all(b"WAVE").map_err(|e| e.to_string())?;

    // fmt chunk
    buf.write_all(b"fmt ").map_err(|e| e.to_string())?;
    buf.write_all(&16u32.to_le_bytes()).map_err(|e| e.to_string())?;
    buf.write_all(&1u16.to_le_bytes()).map_err(|e| e.to_string())?; // PCM
    buf.write_all(&channels.to_le_bytes()).map_err(|e| e.to_string())?;
    buf.write_all(&sample_rate.to_le_bytes()).map_err(|e| e.to_string())?;
    buf.write_all(&byte_rate.to_le_bytes()).map_err(|e| e.to_string())?;
    buf.write_all(&block_align.to_le_bytes()).map_err(|e| e.to_string())?;
    buf.write_all(&bits_per_sample.to_le_bytes()).map_err(|e| e.to_string())?;

    // data chunk
    buf.write_all(b"data").map_err(|e| e.to_string())?;
    buf.write_all(&data_size.to_le_bytes()).map_err(|e| e.to_string())?;

    // Convert f32 samples to i16
    for &sample in samples {
        let clamped = sample.clamp(-1.0, 1.0);
        let val = (clamped * 32767.0) as i16;
        buf.write_all(&val.to_le_bytes()).map_err(|e| e.to_string())?;
    }

    fs::write(&filepath, buf.into_inner())
        .map_err(|e| format!("Failed to write WAV file: {}", e))?;

    Ok((filepath.to_string_lossy().to_string(), filename))
}
