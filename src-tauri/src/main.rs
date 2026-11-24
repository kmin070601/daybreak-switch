// Daybreak Switch 데스크톱 앱.
// - 키보드 볼륨 키를 가로채서 Windows 기본 팝업 대신 유리 슬라이더(OSD 창)를 띄운다.
// - 시스템 마스터 볼륨을 읽고 쓴다. 다른 곳에서 볼륨이 바뀌면 화면에도 반영한다.
// - 배경 소리는 본 창(main)에서만 난다. OSD 창은 소리를 만들지 않는다.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::OnceLock;
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WindowEvent};

use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};
use windows::Win32::UI::Input::KeyboardAndMouse::{VK_VOLUME_DOWN, VK_VOLUME_MUTE, VK_VOLUME_UP};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, GetWindowLongPtrW, SetWindowLongPtrW, SetWindowsHookExW,
    ShowWindow, TranslateMessage, GWL_EXSTYLE, KBDLLHOOKSTRUCT, MSG, SW_HIDE, SW_SHOWNOACTIVATE, WH_KEYBOARD_LL,
    WM_KEYDOWN, WM_SYSKEYDOWN, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
};

const STEP: f32 = 0.02; // 볼륨 키 한 번에 2%
const OSD_MS: u64 = 1700; // OSD가 떠 있는 시간

#[derive(Clone, Serialize)]
struct Volume {
    value: u32, // 0~100
    muted: bool,
}

// 환경 변수 DAYBREAK_LOG에 파일 경로를 주면 볼륨을 바꾼 일을 한 줄씩 기록한다 (문제 추적용)
fn log(msg: &str) {
    if let Ok(path) = std::env::var("DAYBREAK_LOG") {
        use std::io::Write;
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
            let t = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() % 1_000_000).unwrap_or(0);
            let _ = writeln!(f, "{t} {msg}");
        }
    }
}

// ---------- 시스템 볼륨 (Core Audio) ----------
fn endpoint() -> Option<IAudioEndpointVolume> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let en: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
        let dev = en.GetDefaultAudioEndpoint(eRender, eMultimedia).ok()?;
        dev.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None).ok()
    }
}

fn read_volume() -> Option<Volume> {
    let ep = endpoint()?;
    unsafe {
        let v = ep.GetMasterVolumeLevelScalar().ok()?;
        let m = ep.GetMute().ok()?.as_bool();
        Some(Volume { value: (v * 100.0).round() as u32, muted: m })
    }
}

fn write_volume(v: f32) {
    if let Some(ep) = endpoint() {
        unsafe {
            let v = v.clamp(0.0, 1.0);
            let _ = ep.SetMasterVolumeLevelScalar(v, std::ptr::null());
            if v > 0.0 {
                let _ = ep.SetMute(false, std::ptr::null());
            }
        }
    }
}

fn toggle_mute() {
    if let Some(ep) = endpoint() {
        unsafe {
            if let Ok(m) = ep.GetMute() {
                let _ = ep.SetMute(!m.as_bool(), std::ptr::null());
            }
        }
    }
}

// ---------- 프런트엔드에서 부르는 명령 ----------
#[tauri::command]
fn get_volume() -> Volume {
    read_volume().unwrap_or(Volume { value: 0, muted: false })
}

#[tauri::command]
fn set_volume(app: AppHandle, value: f32, from_osd: bool) {
    log(&format!("set_volume value={value} from_osd={from_osd}"));
    write_volume(value / 100.0);
    if let Some(v) = read_volume() {
        let _ = app.emit("volume", v);
    }
    if from_osd {
        keep_osd(&app); // OSD에서 끌고 있는 동안에는 사라지지 않는다
    }
}

// ---------- OSD 창 ----------
static OSD_GEN: AtomicU64 = AtomicU64::new(0);

fn osd_hwnd(app: &AppHandle) -> Option<HWND> {
    let w = app.get_webview_window("osd")?;
    let h = w.hwnd().ok()?;
    Some(HWND(h.0 as _))
}

fn keep_osd(app: &AppHandle) {
    let gen = OSD_GEN.fetch_add(1, Ordering::SeqCst) + 1;
    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(OSD_MS));
        log(&format!("osd timer gen={gen} now={}", OSD_GEN.load(Ordering::SeqCst)));
        if OSD_GEN.load(Ordering::SeqCst) == gen {
            let a = app.clone();
            let _ = app.run_on_main_thread(move || {
                log("osd hide");
                if let Some(w) = a.get_webview_window("osd") {
                    let _ = w.hide();
                }
                if let Some(h) = osd_hwnd(&a) {
                    unsafe {
                        let _ = ShowWindow(h, SW_HIDE);
                    }
                }
            });
            let _ = app.emit("osd-hidden", ());
        }
    });
}

fn show_osd(app: &AppHandle) {
    // 창을 다루는 일은 창을 만든 주 스레드에서 해야 실제로 보인다
    let a = app.clone();
    let _ = app.run_on_main_thread(move || show_osd_now(&a));
    let _ = app.emit("osd-shown", ());
    keep_osd(app);
}

fn show_osd_now(app: &AppHandle) {
    let Some(w) = app.get_webview_window("osd") else { return };
    // 주 모니터 아래쪽 가운데에 둔다
    if let (Ok(Some(mon)), Ok(size)) = (w.primary_monitor(), w.outer_size()) {
        let ms = mon.size();
        let mp = mon.position();
        let x = mp.x + (ms.width as i32 - size.width as i32) / 2;
        let y = mp.y + ms.height as i32 - size.height as i32 - (ms.height as f64 * 0.11) as i32;
        let _ = w.set_position(PhysicalPosition::new(x, y));
    }
    if let Some(h) = osd_hwnd(app) {
        unsafe {
            let _ = ShowWindow(h, SW_SHOWNOACTIVATE); // 포커스를 빼앗지 않고 보여 준다
        }
    }
    if !w.is_visible().unwrap_or(false) {
        let _ = w.show();
    }
}

// ---------- 볼륨 키 가로채기 ----------
static KEYS: OnceLock<Sender<u32>> = OnceLock::new();

unsafe extern "system" fn key_hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 {
        let k = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
        let vk = k.vkCode;
        if vk == VK_VOLUME_UP.0 as u32 || vk == VK_VOLUME_DOWN.0 as u32 || vk == VK_VOLUME_MUTE.0 as u32 {
            let msg = wparam.0 as u32;
            if msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN {
                if let Some(tx) = KEYS.get() {
                    let _ = tx.send(vk);
                }
            }
            return LRESULT(1); // 키를 삼킨다. 그래서 Windows 기본 볼륨 팝업이 뜨지 않는다
        }
    }
    CallNextHookEx(None, code, wparam, lparam)
}

fn start_key_hook(app: AppHandle) {
    let (tx, rx) = channel::<u32>();
    let _ = KEYS.set(tx);

    // 훅은 메시지 루프가 도는 스레드에 걸려야 한다. 훅 안에서는 바로 돌아오고 실제 일은 아래 스레드가 한다
    thread::spawn(|| unsafe {
        let _hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(key_hook), None, 0);
        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    });

    thread::spawn(move || {
        for vk in rx {
            log(&format!("key vk={vk:#x}"));
            if vk == VK_VOLUME_MUTE.0 as u32 {
                toggle_mute();
            } else if let Some(cur) = read_volume() {
                let dir = if vk == VK_VOLUME_UP.0 as u32 { 1.0 } else { -1.0 };
                write_volume(cur.value as f32 / 100.0 + dir * STEP);
            }
            if let Some(v) = read_volume() {
                let _ = app.emit("volume", v);
            }
            show_osd(&app);
        }
    });
}

// 다른 앱이나 Windows 설정에서 볼륨을 바꿔도 화면이 따라가게 한다
fn start_volume_watch(app: AppHandle) {
    thread::spawn(move || {
        let mut last: Option<(u32, bool)> = None;
        loop {
            thread::sleep(Duration::from_millis(400));
            if let Some(v) = read_volume() {
                let now = (v.value, v.muted);
                if last.is_some() && last != Some(now) {
                    let _ = app.emit("volume", v);
                }
                last = Some(now);
            }
        }
    });
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        let _ = app.emit("main-shown", ());
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_volume, set_volume])
        .setup(|app| {
            let handle = app.handle().clone();

            // OSD 창은 클릭해도 포커스를 가져가지 않고, Alt+Tab에도 나오지 않는다
            if let Some(h) = osd_hwnd(&handle) {
                unsafe {
                    let ex = GetWindowLongPtrW(h, GWL_EXSTYLE);
                    SetWindowLongPtrW(h, GWL_EXSTYLE, ex | (WS_EX_NOACTIVATE.0 | WS_EX_TOOLWINDOW.0) as isize);
                }
            }

            let open = MenuItem::with_id(app, "open", "Daybreak Switch 열기", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Daybreak Switch")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;

            start_key_hook(handle.clone());
            start_volume_watch(handle);
            Ok(())
        })
        .on_window_event(|window, event| {
            // 본 창을 닫아도 앱은 트레이에 남아 볼륨 키를 계속 받는다. 배경 소리는 이때 멈춘다
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                    let _ = window.app_handle().emit("main-hidden", ());
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run Daybreak Switch");
}
