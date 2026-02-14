#[cfg(unix)]
pub fn ensure_non_root(allow_root: bool) -> Result<(), String> {
    if allow_root {
        return Ok(());
    }

    let uid = unsafe { libc::geteuid() };
    if uid == 0 {
        return Err("running as root is disabled; use --allow-root to override".to_string());
    }
    Ok(())
}

#[cfg(not(unix))]
pub fn ensure_non_root(_allow_root: bool) -> Result<(), String> {
    Ok(())
}
