use crate::session::session::{Session, SessionState};
use chrono::Utc;
use std::collections::HashMap;
use std::path::Path;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct CreateSessionInput {
    pub shell: String,
    pub working_dir: String,
    pub env: HashMap<String, String>,
    pub name: Option<String>,
    pub timeout_s: u64,
}

#[derive(Debug)]
pub struct SessionPool {
    sessions: HashMap<String, Session>,
    max_sessions: usize,
}

impl SessionPool {
    pub fn new(max_sessions: usize) -> Self {
        Self {
            sessions: HashMap::new(),
            max_sessions,
        }
    }

    pub fn create_session(
        &mut self,
        input: CreateSessionInput,
    ) -> Result<Session, SessionPoolError> {
        if self.sessions.len() >= self.max_sessions {
            return Err(SessionPoolError::MaxSessionsReached);
        }

        if !Path::new(&input.shell).exists() {
            return Err(SessionPoolError::InvalidShell(input.shell));
        }

        if !Path::new(&input.working_dir).exists() {
            return Err(SessionPoolError::InvalidWorkingDir(input.working_dir));
        }

        let now = Utc::now();
        let session_id = format!("s-{}", &Uuid::new_v4().simple().to_string()[..8]);
        let session = Session {
            session_id: session_id.clone(),
            name: input.name,
            shell: input.shell,
            working_dir: input.working_dir,
            env: input.env,
            state: SessionState::Idle,
            created_at: now,
            last_activity: now,
            command_count: 0,
            timeout_s: input.timeout_s,
        };

        self.sessions.insert(session_id, session.clone());
        Ok(session)
    }

    pub fn list_sessions(&self) -> Vec<Session> {
        self.sessions.values().cloned().collect()
    }

    pub fn get_session(&self, session_id: &str) -> Option<Session> {
        self.sessions.get(session_id).cloned()
    }

    pub fn destroy_session(
        &mut self,
        session_id: &str,
        force: bool,
    ) -> Result<(), SessionPoolError> {
        match self.sessions.get(session_id) {
            Some(session) if session.state == SessionState::Running && !force => {
                return Err(SessionPoolError::SessionBusy);
            }
            Some(_) => {}
            None => return Err(SessionPoolError::SessionNotFound),
        }

        let _ = self.sessions.remove(session_id);
        Ok(())
    }

    pub fn mark_running(&mut self, session_id: &str) -> Result<(), SessionPoolError> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or(SessionPoolError::SessionNotFound)?;
        if session.state == SessionState::Running {
            return Err(SessionPoolError::SessionBusy);
        }
        session.state = SessionState::Running;
        session.last_activity = Utc::now();
        Ok(())
    }

    pub fn mark_idle(&mut self, session_id: &str) -> Result<(), SessionPoolError> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or(SessionPoolError::SessionNotFound)?;
        session.state = SessionState::Idle;
        session.last_activity = Utc::now();
        session.command_count += 1;
        Ok(())
    }

    pub fn cleanup_idle_sessions(&mut self, max_idle_sec: u64) -> usize {
        let now = Utc::now();
        let stale_ids: Vec<String> = self
            .sessions
            .iter()
            .filter_map(|(id, sess)| {
                if sess.is_idle_too_long(max_idle_sec, now) {
                    Some(id.clone())
                } else {
                    None
                }
            })
            .collect();

        let count = stale_ids.len();
        for id in stale_ids {
            let _ = self.sessions.remove(&id);
        }
        count
    }

    pub fn cleanup_expired_sessions(&mut self, ttl_sec: u64) -> usize {
        let now = Utc::now();
        let expired_ids: Vec<String> = self
            .sessions
            .iter()
            .filter_map(|(id, sess)| {
                if sess.has_exceeded_ttl(ttl_sec, now) && sess.state != SessionState::Running {
                    Some(id.clone())
                } else {
                    None
                }
            })
            .collect();

        let count = expired_ids.len();
        for id in expired_ids {
            let _ = self.sessions.remove(&id);
        }
        count
    }

    pub fn cleanup_oldest_idle(&mut self, count: usize) -> usize {
        if self.sessions.is_empty() || count == 0 {
            return 0;
        }
        let mut idle: Vec<_> = self
            .sessions
            .iter()
            .filter(|(_, s)| s.state == SessionState::Idle)
            .map(|(id, s)| (id.clone(), s.last_activity))
            .collect();
        idle.sort_by_key(|(_, last)| *last);
        let to_remove: Vec<_> = idle.iter().take(count).map(|(id, _)| id.clone()).collect();
        for id in &to_remove {
            self.sessions.remove(id);
        }
        to_remove.len()
    }

    pub fn active_sessions(&self) -> usize {
        self.sessions.len()
    }

    pub fn is_running(&self, session_id: &str) -> Result<bool, SessionPoolError> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or(SessionPoolError::SessionNotFound)?;
        Ok(session.state == SessionState::Running)
    }

    pub fn destroy_all(&mut self) -> usize {
        let count = self.sessions.len();
        self.sessions.clear();
        count
    }
}

#[derive(Debug)]
pub enum SessionPoolError {
    MaxSessionsReached,
    SessionNotFound,
    SessionBusy,
    InvalidShell(String),
    InvalidWorkingDir(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn enforces_max_sessions() {
        let mut pool = SessionPool::new(1);
        let first = pool.create_session(CreateSessionInput {
            shell: "/bin/sh".to_string(),
            working_dir: "/tmp".to_string(),
            env: HashMap::new(),
            name: None,
            timeout_s: 10,
        });
        assert!(first.is_ok());

        let second = pool.create_session(CreateSessionInput {
            shell: "/bin/sh".to_string(),
            working_dir: "/tmp".to_string(),
            env: HashMap::new(),
            name: None,
            timeout_s: 10,
        });
        assert!(matches!(second, Err(SessionPoolError::MaxSessionsReached)));
    }

    #[test]
    fn destroy_running_requires_force() {
        let mut pool = SessionPool::new(2);
        let created = pool
            .create_session(CreateSessionInput {
                shell: "/bin/sh".to_string(),
                working_dir: "/tmp".to_string(),
                env: HashMap::new(),
                name: None,
                timeout_s: 10,
            })
            .expect("session should be created");
        pool.mark_running(&created.session_id)
            .expect("session should move to running");

        let no_force = pool.destroy_session(&created.session_id, false);
        assert!(matches!(no_force, Err(SessionPoolError::SessionBusy)));

        let with_force = pool.destroy_session(&created.session_id, true);
        assert!(with_force.is_ok());
    }
}
