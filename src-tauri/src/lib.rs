use nokhwa::{Camera, utils::{CameraIndex, RequestedFormat, RequestedFormatType}};
use std::sync::{Arc, Mutex};
use tauri::State;

// Wrapper to make Camera Send-safe
struct SendCamera {
    camera: Camera,
}

unsafe impl Send for SendCamera {}

struct CameraState {
    camera: Arc<Mutex<Option<SendCamera>>>,
}

#[derive(serde::Serialize)]
struct CameraFrame {
    data: Vec<u8>,
    width: u32,
    height: u32,
}

#[tauri::command]
fn init_camera(state: State<'_, CameraState>) -> Result<String, String> {
    let index = CameraIndex::Index(0);
    let requested = RequestedFormat::new::<nokhwa::pixel_format::RgbFormat>(
        RequestedFormatType::AbsoluteHighestResolution
    );
    
    match Camera::new(index, requested) {
        Ok(mut camera) => {
            if let Err(e) = camera.open_stream() {
                return Err(format!("Failed to open camera stream: {}", e));
            }
            *state.camera.lock().unwrap() = Some(SendCamera { camera });
            Ok("Camera initialized".to_string())
        }
        Err(e) => Err(format!("Failed to initialize camera: {}", e))
    }
}

#[tauri::command]
fn capture_frame(state: State<'_, CameraState>) -> Result<CameraFrame, String> {
    let mut camera_lock = state.camera.lock().unwrap();
    
    if let Some(send_camera) = camera_lock.as_mut() {
        match send_camera.camera.frame() {
            Ok(frame) => {
                let resolution = frame.resolution();
                let decoded = frame.decode_image::<nokhwa::pixel_format::RgbFormat>()
                    .map_err(|e| format!("Failed to decode frame: {}", e))?;
                Ok(CameraFrame {
                    data: decoded.to_vec(),
                    width: resolution.width(),
                    height: resolution.height(),
                })
            }
            Err(e) => Err(format!("Failed to capture frame: {}", e))
        }
    } else {
        Err("Camera not initialized".to_string())
    }
}

#[tauri::command]
fn release_camera(state: State<'_, CameraState>) -> Result<(), String> {
    let mut camera_lock = state.camera.lock().unwrap();
    *camera_lock = None;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(CameraState {
            camera: Arc::new(Mutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![init_camera, capture_frame, release_camera])
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
