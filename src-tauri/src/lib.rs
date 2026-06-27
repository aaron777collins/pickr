mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::pick_folder,
            commands::scan_folder,
            commands::face_detect,
            commands::face_match,
            commands::export_renamed,
            commands::save_project,
            commands::load_project,
            commands::open_in_explorer,
            commands::blur_export,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
