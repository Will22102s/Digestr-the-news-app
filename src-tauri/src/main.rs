#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    net::{SocketAddr, TcpListener, TcpStream},
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, Instant},
};

use tauri::{
    path::BaseDirectory,
    webview::{NewWindowResponse, WebviewWindowBuilder},
    Manager, RunEvent, WebviewUrl,
};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};
use url::Url;

/// Keeps the Node sidecar alive for the lifetime of the app and lets the exit
/// handler stop it cleanly.
struct ServerState(Mutex<Option<CommandChild>>);

fn main() {
    let app = tauri::Builder::default()
        // Must be registered first: a second launch focuses the existing window
        // instead of starting a second Node server and a second SQLite writer.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let handle = app.handle().clone();

            let data_dir = handle
                .path()
                .app_data_dir()
                .map_err(|error| format!("Could not resolve the app data directory: {error}"))?;

            std::fs::create_dir_all(&data_dir).map_err(|error| {
                format!(
                    "Could not create the data directory {}: {error}",
                    data_dir.display()
                )
            })?;
            restrict_permissions(&data_dir);

            let standalone_dir = resolve_standalone(&handle)?;
            let port = reserve_port()?;

            let window = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::App("index.html".into()),
            )
            .title("Digestr")
            .inner_size(1280.0, 820.0)
            .min_inner_size(960.0, 640.0)
            .background_color(tauri::window::Color(17, 18, 21, 255))
            .theme(Some(tauri::Theme::Dark))
            .visible(false)
            .center()
            .on_navigation(|url| {
                if is_internal(url) {
                    true
                } else {
                    // Story links should open in the user's browser, not inside
                    // a bare webview with no address bar.
                    let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
                    false
                }
            })
            .on_new_window(|url, _features| {
                let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
                NewWindowResponse::Deny
            })
            .build()
            .map_err(|error| format!("Could not create the reader window: {error}"))?;

            let command = handle
                .shell()
                .sidecar("digest-node")
                .map_err(|error| format!("The bundled Node runtime is unavailable: {error}"))?
                .arg("server.js")
                .current_dir(&standalone_dir)
                .env("PORT", port.to_string())
                .env("HOSTNAME", "127.0.0.1")
                .env("NODE_ENV", "production")
                .env("DIGEST_DATA_DIR", data_dir.to_string_lossy().to_string());

            let (mut receiver, child) = match command.spawn() {
                Ok(pair) => pair,
                Err(error) => {
                    let message =
                        format!("Could not start the bundled Node runtime: {error}");
                    eprintln!("[digest] {message}");
                    show_startup_error(&window, &message);
                    let _ = window.show();
                    return Ok(());
                }
            };

            app.manage(ServerState(Mutex::new(Some(child))));

            tauri::async_runtime::spawn(async move {
                while let Some(event) = receiver.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            println!("[digest] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[digest] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Error(error) => {
                            eprintln!("[digest] sidecar error: {error}");
                        }
                        CommandEvent::Terminated(payload) => {
                            eprintln!("[digest] sidecar exited: {payload:?}");
                            break;
                        }
                        _ => {}
                    }
                }
            });

            let server_url = format!("http://127.0.0.1:{port}");

            std::thread::spawn(move || {
                if wait_for_server(port, Duration::from_secs(45)) {
                    match server_url.parse::<Url>() {
                        Ok(url) => {
                            if let Err(error) = window.navigate(url) {
                                eprintln!("[digest] could not open the reader: {error}");
                            }
                        }
                        Err(error) => {
                            eprintln!("[digest] invalid server URL: {error}");
                        }
                    }

                    let _ = window.show();
                    let _ = window.set_focus();
                } else {
                    show_startup_error(
                        &window,
                        "The local reader server did not become ready in time.\n\
                         Try launching the app again. If it keeps failing, check that \
                         the app data directory is writable.",
                    );
                    let _ = window.show();
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Digestr");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            if let Some(state) = app_handle.try_state::<ServerState>() {
                if let Ok(mut guard) = state.0.lock() {
                    if let Some(child) = guard.take() {
                        let _ = child.kill();
                    }
                }
            }
        }
    });
}

fn reserve_port() -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|error| format!("Could not reserve a local port: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("Could not read the reserved port: {error}"))?
        .port();
    drop(listener);
    Ok(port)
}

fn wait_for_server(port: u16, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;

    while Instant::now() < deadline {
        if server_ready(port) {
            return true;
        }
        std::thread::sleep(Duration::from_millis(250));
    }

    false
}

fn server_ready(port: u16) -> bool {
    use std::io::{Read, Write};

    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let Ok(mut stream) = TcpStream::connect_timeout(&address, Duration::from_millis(400)) else {
        return false;
    };

    let _ = stream.set_read_timeout(Some(Duration::from_millis(900)));
    let request = b"GET /api/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n";

    if stream.write_all(request).is_err() {
        return false;
    }

    let mut response = String::new();
    if stream.read_to_string(&mut response).is_err() {
        return false;
    }

    response
        .lines()
        .next()
        .map(|line| line.contains(" 200 "))
        .unwrap_or(false)
}

fn is_internal(url: &Url) -> bool {
    match url.scheme() {
        "tauri" | "about" | "data" => true,
        "http" | "https" => matches!(
            url.host_str(),
            Some("127.0.0.1") | Some("localhost") | Some("tauri.localhost")
        ),
        _ => false,
    }
}

fn resolve_standalone(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(directory) = app.path().resolve("standalone", BaseDirectory::Resource) {
        if directory.join("server.js").is_file() {
            return Ok(directory);
        }
    }

    // `tauri dev` runs from target/debug, so fall back to the project build.
    let development = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join(".next")
        .join("standalone");

    if development.join("server.js").is_file() {
        return Ok(development.canonicalize().unwrap_or(development));
    }

    Err(
        "The bundled Next.js server was not found. Run `npm run desktop:prepare` first."
            .to_string(),
    )
}

fn show_startup_error(window: &tauri::WebviewWindow, message: &str) {
    let encoded =
        serde_json::to_string(message).unwrap_or_else(|_| "\"Unknown startup error\"".to_string());

    let script = concat!(
        "document.body.style.background = '#111215';",
        "document.body.style.color = '#f5f5f7';",
        "document.body.style.fontFamily = '-apple-system, BlinkMacSystemFont, sans-serif';",
        "document.body.style.padding = '48px';",
        "document.body.innerHTML = '<h1 style=\"font-size:20px;margin:0 0 14px\">",
        "Digestr could not start</h1><pre style=\"white-space:pre-wrap;",
        "color:#a1a1a6;font-size:12px;line-height:1.6;margin:0\"></pre>';",
        "document.querySelector('pre').textContent = ",
    )
    .to_string()
        + &encoded
        + ";";

    let _ = window.eval(&script);
}

#[cfg(unix)]
fn restrict_permissions(path: &Path) {
    use std::os::unix::fs::PermissionsExt;
    let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700));
}

#[cfg(not(unix))]
fn restrict_permissions(_path: &Path) {}
