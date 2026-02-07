use base64::{engine::general_purpose::STANDARD, Engine};
use std::fs;

const CAMERA_DIR: &str = "honeybee-camera";

#[derive(Clone, serde::Serialize)]
pub struct GalleryImage {
    pub filename: String,
    pub path: String,
    pub size: u64,
    pub modified: u64, // unix timestamp
}

/// List all images in ~/Pictures/honeybee-camera/
#[tauri::command]
pub async fn list_gallery_images() -> Result<Vec<GalleryImage>, String> {
    let pictures_dir = dirs::picture_dir().ok_or("Failed to get Pictures directory")?;
    let camera_dir = pictures_dir.join(CAMERA_DIR);

    if !camera_dir.exists() {
        return Ok(Vec::new());
    }

    let mut images: Vec<GalleryImage> = Vec::new();

    let entries = fs::read_dir(&camera_dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if let Some(ext) = path.extension() {
            let ext_lower = ext.to_string_lossy().to_lowercase();
            if ext_lower == "jpg" || ext_lower == "jpeg" || ext_lower == "png" {
                if let Ok(metadata) = entry.metadata() {
                    let modified = metadata
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    images.push(GalleryImage {
                        filename: entry.file_name().to_string_lossy().to_string(),
                        path: path.to_string_lossy().to_string(),
                        size: metadata.len(),
                        modified,
                    });
                }
            }
        }
    }

    // Sort newest first
    images.sort_by(|a, b| b.modified.cmp(&a.modified));

    Ok(images)
}

/// Read an image as base64 data URL
#[tauri::command]
pub async fn read_gallery_image(path: String) -> Result<String, String> {
    let data = fs::read(&path).map_err(|e| format!("Failed to read image: {}", e))?;
    let base64_data = STANDARD.encode(&data);
    Ok(format!("data:image/jpeg;base64,{}", base64_data))
}

/// Delete an image
#[tauri::command]
pub async fn delete_gallery_image(path: String) -> Result<bool, String> {
    // Safety: only allow deleting from the camera directory
    let pictures_dir = dirs::picture_dir().ok_or("Failed to get Pictures directory")?;
    let camera_dir = pictures_dir.join(CAMERA_DIR);
    let target = std::path::Path::new(&path);

    if !target.starts_with(&camera_dir) {
        return Err("Cannot delete files outside camera directory".to_string());
    }

    fs::remove_file(&path).map_err(|e| format!("Failed to delete image: {}", e))?;
    Ok(true)
}
