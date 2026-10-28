use tauri::Manager;

pub fn run() {
    let builder = tauri::Builder::default();

    // Keep a second launch from opening another writer against the same album store.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }));

    builder
        .run(tauri::generate_context!())
        .expect("kaampi Comic could not start");
}
