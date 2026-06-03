#[tauri::command]
pub fn kill_process(pid: u32) -> Result<String, String> {
    match process_kill(pid) {
        Ok(name) => Ok(name),
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub fn kill_process_tree(pid: u32) -> Result<String, String> {
    let children = get_child_pids(pid);
    let mut killed = 0u32;
    for child_pid in &children {
        if process_kill(*child_pid).is_ok() {
            killed += 1;
        }
    }
    match process_kill(pid) {
        Ok(name) => Ok(format!("{} (and {} children)", name, killed)),
        Err(e) => Err(format!("{} (killed {} children before error)", e, killed)),
    }
}

/// Terminate a process (and its tree) with administrator rights by launching
/// `taskkill` through the "runas" verb. This triggers a Windows UAC consent
/// prompt — the user is asked to grant admin rights at that moment.
#[tauri::command]
pub fn kill_process_elevated(pid: u32) -> Result<String, String> {
    let name = get_process_name(pid).unwrap_or_else(|| "unknown".into());

    unsafe {
        use windows::core::PCWSTR;
        use windows::Win32::Foundation::CloseHandle;
        use windows::Win32::System::Threading::WaitForSingleObject;
        use windows::Win32::UI::Shell::{
            ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
        };
        use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;

        let verb = wide_str("runas");
        let file = wide_str("taskkill.exe");
        let params = wide_str(&format!("/F /T /PID {}", pid));

        let mut info = SHELLEXECUTEINFOW {
            cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
            fMask: SEE_MASK_NOCLOSEPROCESS,
            lpVerb: PCWSTR(verb.as_ptr()),
            lpFile: PCWSTR(file.as_ptr()),
            lpParameters: PCWSTR(params.as_ptr()),
            nShow: SW_HIDE.0,
            ..Default::default()
        };

        // ERROR_CANCELLED here means the user dismissed the UAC prompt.
        ShellExecuteExW(&mut info)
            .map_err(|e| format!("提权失败或已取消: {:?}", e))?;

        // For UAC-elevated launches the process is created by a broker, so the
        // returned handle is often missing. Wait on it when present, otherwise
        // give taskkill a moment to do its work.
        if !info.hProcess.is_invalid() {
            WaitForSingleObject(info.hProcess, 15000);
            let _ = CloseHandle(info.hProcess);
        } else {
            std::thread::sleep(std::time::Duration::from_millis(1200));
        }
    }

    // Don't trust taskkill's exit code (the elevated handle is unreliable) —
    // verify the process is actually gone, polling for a short while since the
    // elevated taskkill runs asynchronously.
    for _ in 0..10 {
        if !process_is_alive(pid) {
            return Ok(name);
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
    Err(format!(
        "仍未能结束 {} (#{})，该进程可能受系统保护或会自动重启",
        name, pid
    ))
}

/// Whether a PID still exists. Uses a process snapshot, so it works regardless
/// of our own privilege level (unlike OpenProcess).
fn process_is_alive(pid: u32) -> bool {
    unsafe {
        use windows::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
        use windows::Win32::System::Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32First, Process32Next, PROCESSENTRY32,
            TH32CS_SNAPPROCESS,
        };

        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).unwrap_or(INVALID_HANDLE_VALUE);
        if snapshot == INVALID_HANDLE_VALUE {
            return false;
        }
        let mut entry = PROCESSENTRY32 {
            dwSize: std::mem::size_of::<PROCESSENTRY32>() as u32,
            ..Default::default()
        };
        let mut found = false;
        if Process32First(snapshot, &mut entry).is_ok() {
            loop {
                if entry.th32ProcessID == pid {
                    found = true;
                    break;
                }
                if Process32Next(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snapshot);
        found
    }
}

#[tauri::command]
pub fn get_process_icon(pid: u32) -> Result<String, String> {
    // Prefer the live Win32 path; fall back to sysinfo's cached path when we
    // can't open the process (e.g. elevated / protected processes).
    let exe_path = get_process_exe_path(pid)
        .or_else(|| get_process_exe_path_sysinfo(pid))
        .ok_or_else(|| format!("Cannot get exe path for PID {}", pid))?;

    unsafe {
        use windows::Win32::UI::Shell::{SHGetFileInfoW, SHGFI_ICON, SHGFI_SMALLICON, SHFILEINFOW};
        use windows::Win32::Graphics::Gdi::{
            CreateCompatibleDC, DeleteDC, CreateCompatibleBitmap,
            SelectObject, DeleteObject, GetDIBits, GetDC, ReleaseDC,
            BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS, BI_RGB,
        };
        use windows::Win32::UI::WindowsAndMessaging::DrawIconEx;
        use base64::Engine;

        let wide_path: Vec<u16> = exe_path
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();

        let mut info = SHFILEINFOW::default();
        use windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES;
        let result = SHGetFileInfoW(
            windows::core::PCWSTR::from_raw(wide_path.as_ptr()),
            FILE_FLAGS_AND_ATTRIBUTES(0),
            Some(&mut info),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_SMALLICON,
        );

        if result == 0 || info.hIcon.is_invalid() {
            return Err("Cannot get icon".into());
        }

        let size = 16i32;
        let screen_dc = GetDC(None);
        let mem_dc = CreateCompatibleDC(Some(screen_dc));
        let bitmap = CreateCompatibleBitmap(screen_dc, size, size);
        let old_bmp = SelectObject(mem_dc, bitmap.into());

        use windows::Win32::UI::WindowsAndMessaging::DI_FLAGS;
        let _ = DrawIconEx(mem_dc, 0, 0, info.hIcon, size, size, 0, None, DI_FLAGS(3));

        let mut bmp_info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: size,
                biHeight: -size,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [std::mem::zeroed(); 1],
        };

        let data_size = (size * size * 4) as usize;
        let mut pixels: Vec<u8> = vec![0u8; data_size];

        GetDIBits(
            mem_dc,
            bitmap,
            0,
            size as u32,
            Some(pixels.as_mut_ptr() as *mut _),
            &mut bmp_info,
            DIB_RGB_COLORS,
        );

        SelectObject(mem_dc, old_bmp);
        let _ = DeleteObject(bitmap.into());
        let _ = DeleteDC(mem_dc);
        let _ = ReleaseDC(None, screen_dc);
        use windows::Win32::UI::WindowsAndMessaging::DestroyIcon;
        let _ = DestroyIcon(info.hIcon);

        let bmp_data = encode_bmp(size, size, &pixels);
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bmp_data);
        Ok(format!("data:image/bmp;base64,{}", b64))
    }
}

fn encode_bmp(w: i32, h: i32, pixels: &[u8]) -> Vec<u8> {
    let row_size = ((w * 32 + 31) / 32) * 4;
    let pixel_array_size = (row_size * h) as u32;
    let file_size = 14 + 40 + pixel_array_size;
    let mut buf = Vec::with_capacity(file_size as usize);

    buf.extend_from_slice(b"BM");
    buf.extend_from_slice(&file_size.to_le_bytes());
    buf.extend_from_slice(&0u32.to_le_bytes());
    buf.extend_from_slice(&54u32.to_le_bytes());
    buf.extend_from_slice(&40u32.to_le_bytes());
    buf.extend_from_slice(&(w as i32).to_le_bytes());
    buf.extend_from_slice(&(h as i32).to_le_bytes());
    buf.extend_from_slice(&1u16.to_le_bytes());
    buf.extend_from_slice(&32u16.to_le_bytes());
    buf.extend_from_slice(&0u32.to_le_bytes());
    buf.extend_from_slice(&pixel_array_size.to_le_bytes());
    buf.extend_from_slice(&0i32.to_le_bytes());
    buf.extend_from_slice(&0i32.to_le_bytes());
    buf.extend_from_slice(&0u32.to_le_bytes());
    buf.extend_from_slice(&0u32.to_le_bytes());

    let row_bytes = (w * 4) as usize;
    let stride = row_size as usize;
    for y in 0..h as usize {
        let src_row = y * row_bytes;
        for x in 0..w as usize {
            let src = src_row + x * 4;
            buf.push(pixels[src]);
            buf.push(pixels[src + 1]);
            buf.push(pixels[src + 2]);
            buf.push(255);
        }
        for _ in row_bytes..stride {
            buf.push(0);
        }
    }
    buf
}

fn get_process_exe_path(pid: u32) -> Option<String> {
    unsafe {
        use windows::Win32::System::Threading::{
            OpenProcess, QueryFullProcessImageNameW,
            PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_NAME_WIN32,
        };
        use windows::Win32::Foundation::CloseHandle;
        use windows::core::PWSTR;

        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;

        let mut buffer = vec![0u16; 520];
        let mut len = buffer.len() as u32;
        let result = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_WIN32,
            PWSTR::from_raw(buffer.as_mut_ptr()),
            &mut len,
        );

        let _ = CloseHandle(handle);

        if result.is_ok() {
            Some(String::from_utf16_lossy(&buffer[..len as usize]))
        } else {
            None
        }
    }
}

/// Enable SeDebugPrivilege for our own process so we can open/terminate
/// processes owned by other users (only effective when running elevated).
/// Best-effort: failures are ignored.
pub fn enable_debug_privilege() {
    unsafe {
        use windows::core::PCWSTR;
        use windows::Win32::Foundation::{CloseHandle, HANDLE, LUID};
        use windows::Win32::Security::{
            AdjustTokenPrivileges, LookupPrivilegeValueW, LUID_AND_ATTRIBUTES, SE_PRIVILEGE_ENABLED,
            TOKEN_ADJUST_PRIVILEGES, TOKEN_PRIVILEGES, TOKEN_QUERY,
        };
        use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

        let mut token = HANDLE::default();
        if OpenProcessToken(
            GetCurrentProcess(),
            TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY,
            &mut token,
        )
        .is_err()
        {
            return;
        }

        let name: Vec<u16> = "SeDebugPrivilege"
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        let mut luid = LUID::default();
        if LookupPrivilegeValueW(PCWSTR::null(), PCWSTR(name.as_ptr()), &mut luid).is_ok() {
            let tp = TOKEN_PRIVILEGES {
                PrivilegeCount: 1,
                Privileges: [LUID_AND_ATTRIBUTES {
                    Luid: luid,
                    Attributes: SE_PRIVILEGE_ENABLED,
                }],
            };
            let _ = AdjustTokenPrivileges(
                token,
                false,
                Some(&tp as *const TOKEN_PRIVILEGES),
                0,
                None,
                None,
            );
        }
        let _ = CloseHandle(token);
    }
}

fn process_kill(pid: u32) -> Result<String, String> {
    let name = get_process_name(pid).unwrap_or_else(|| "unknown".into());

    unsafe {
        use windows::Win32::System::Threading::{
            OpenProcess, TerminateProcess, PROCESS_TERMINATE, PROCESS_QUERY_LIMITED_INFORMATION,
            PROCESS_QUERY_INFORMATION,
        };
        use windows::Win32::Foundation::{CloseHandle, HANDLE};

        let handle: HANDLE = OpenProcess(
            PROCESS_TERMINATE | PROCESS_QUERY_INFORMATION | PROCESS_QUERY_LIMITED_INFORMATION,
            false,
            pid,
        )
        .map_err(|e| format!("Failed to open process {}: {:?}", pid, e))?;

        let result = TerminateProcess(handle, 1);
        let _ = CloseHandle(handle);

        result.map_err(|e| format!("Failed to terminate process {}: {:?}", pid, e))?;
    }

    Ok(name)
}

fn wide_str(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Fallback exe path via sysinfo (works for some processes we can't OpenProcess).
fn get_process_exe_path_sysinfo(pid: u32) -> Option<String> {
    use sysinfo::{Pid, System};
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::Some(&[Pid::from_u32(pid)]), true);
    sys.process(Pid::from_u32(pid))
        .and_then(|p| p.exe())
        .map(|path| path.to_string_lossy().to_string())
}

fn get_process_name(pid: u32) -> Option<String> {
    use sysinfo::System;
    let sys = System::new_all();
    for (spid, proc) in sys.processes() {
        if spid.as_u32() == pid {
            return Some(proc.name().to_string_lossy().to_string());
        }
    }
    None
}

fn get_child_pids(parent_pid: u32) -> Vec<u32> {
    unsafe {
        use windows::Win32::System::Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32First, Process32Next, PROCESSENTRY32,
            TH32CS_SNAPPROCESS,
        };
        use windows::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};

        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).unwrap_or(INVALID_HANDLE_VALUE);
        if snapshot == INVALID_HANDLE_VALUE {
            return vec![];
        }

        let mut children = Vec::new();
        let mut entry = PROCESSENTRY32 {
            dwSize: std::mem::size_of::<PROCESSENTRY32>() as u32,
            ..Default::default()
        };

        if Process32First(snapshot, &mut entry).is_ok() {
            loop {
                if entry.th32ParentProcessID == parent_pid {
                    children.push(entry.th32ProcessID);
                    // Recurse for grandchildren
                    children.extend(get_child_pids(entry.th32ProcessID));
                }
                if Process32Next(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }

        let _ = CloseHandle(snapshot);
        children
    }
}
