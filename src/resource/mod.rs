use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

#[derive(Debug)]
pub struct RuntimeStats {
    started_at: Instant,
    total_commands: AtomicU64,
}

impl RuntimeStats {
    pub fn new() -> Self {
        Self {
            started_at: Instant::now(),
            total_commands: AtomicU64::new(0),
        }
    }

    pub fn inc_commands(&self) {
        self.total_commands.fetch_add(1, Ordering::Relaxed);
    }

    pub fn uptime_s(&self) -> u64 {
        self.started_at.elapsed().as_secs()
    }

    pub fn total_commands(&self) -> u64 {
        self.total_commands.load(Ordering::Relaxed)
    }

    pub fn memory_rss_bytes(&self) -> u64 {
        current_rss_bytes()
    }

    pub fn open_fds(&self) -> u64 {
        count_open_fds()
    }
}

fn current_rss_bytes() -> u64 {
    #[cfg(unix)]
    unsafe {
        let mut usage: libc::rusage = std::mem::zeroed();
        if libc::getrusage(libc::RUSAGE_SELF, &mut usage) != 0 {
            return 0;
        }
        #[cfg(target_os = "linux")]
        {
            return (usage.ru_maxrss as u64) * 1024;
        }
        #[cfg(not(target_os = "linux"))]
        {
            return usage.ru_maxrss as u64;
        }
    }

    #[allow(unreachable_code)]
    0
}

fn count_open_fds() -> u64 {
    #[cfg(target_os = "linux")]
    {
        if let Ok(entries) = std::fs::read_dir("/proc/self/fd") {
            return entries.count() as u64;
        }
    }

    #[cfg(target_os = "macos")]
    {
        // On macOS, use /dev/fd or count via libproc (not in std; fallback to 0)
        if let Ok(entries) = std::fs::read_dir("/dev/fd") {
            return entries.count() as u64;
        }
    }

    0
}
