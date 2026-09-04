pub mod commands;
pub mod pdf_engine;

// Retain simple greet command for initial smoke testing
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::pick_pdf_files,
            commands::inspect_pdf_files,
            commands::save_pdf_dialog,
            commands::merge_pdfs,
            commands::split_pdf,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
