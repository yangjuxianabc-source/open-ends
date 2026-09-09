use rusqlite::{params_from_iter, types::Value as SqlValue, Connection};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};
use tauri_plugin_window_state::{Builder as WindowStateBuilder, StateFlags};

mod credentials;
mod desktop;
mod transport;

pub(crate) const INITIAL_SCHEMA: &str = include_str!("../migrations/0001_v1_0.sql");
pub(crate) const SPARK_REVISIONS_SCHEMA: &str =
    include_str!("../migrations/0002_spark_revisions.sql");
pub(crate) const RATINGS_SCHEMA: &str = include_str!("../migrations/0003_ratings.sql");

pub(crate) fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join("open-ends.db"))
}

fn ensure_database(app: &tauri::AppHandle) -> Result<(), String> {
    let mut connection =
        Connection::open(database_path(app)?).map_err(|error| error.to_string())?;
    connection
        .execute_batch(INITIAL_SCHEMA)
        .map_err(|error| error.to_string())?;
    ensure_spark_revision_history(&mut connection)
}

fn ensure_spark_revision_history(connection: &mut Connection) -> Result<(), String> {
    let rows = {
        let mut statement = connection
            .prepare(
                "SELECT id, content, created_at FROM sparks
                 WHERE NOT EXISTS (
                   SELECT 1 FROM spark_revisions WHERE spark_revisions.spark_id = sparks.id
                 )",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        rows
    };
    let transaction = connection.transaction().map_err(|error| error.to_string())?;
    for (spark_id, content, created_at) in rows {
        let source_hash = format!("{:x}", Sha256::digest(content.trim().as_bytes()));
        transaction
            .execute(
                "INSERT INTO spark_revisions(id,spark_id,revision,content,source_hash,created_at)
                 VALUES (?1,?2,1,?3,?4,?5)",
                rusqlite::params![
                    format!("legacy-{spark_id}-r1"),
                    spark_id,
                    content,
                    source_hash,
                    created_at
                ],
            )
            .map_err(|error| error.to_string())?;
    }
    transaction.commit().map_err(|error| error.to_string())
}

pub(crate) fn read_app_setting(app: &tauri::AppHandle, key: &str) -> Option<String> {
    let connection = Connection::open(database_path(app).ok()?).ok()?;
    connection
        .query_row(
            "SELECT value_json FROM app_settings WHERE key=?1",
            [key],
            |row| row.get(0),
        )
        .ok()
}

pub(crate) fn write_app_setting(
    app: &tauri::AppHandle,
    key: &str,
    value_json: &str,
) -> Result<(), String> {
    let connection = Connection::open(database_path(app)?).map_err(|error| error.to_string())?;
    connection
        .execute_batch(INITIAL_SCHEMA)
        .map_err(|error| error.to_string())?;
    connection.execute(
        "INSERT INTO app_settings(key,value_json,updated_at) VALUES (?1,?2,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at",
        [key, value_json],
    ).map_err(|error| error.to_string())?;
    Ok(())
}

pub(crate) fn delete_app_setting(app: &tauri::AppHandle, key: &str) -> Result<(), String> {
    let connection = Connection::open(database_path(app)?).map_err(|error| error.to_string())?;
    connection
        .execute("DELETE FROM app_settings WHERE key=?1", [key])
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SqlStatement {
    sql: String,
    values: Vec<serde_json::Value>,
}

#[tauri::command]
fn execute_transaction(app: tauri::AppHandle, statements: Vec<SqlStatement>) -> Result<(), String> {
    let mut connection =
        Connection::open(database_path(&app)?).map_err(|error| error.to_string())?;
    connection
        .execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|error| error.to_string())?;
    execute_statements(&mut connection, statements)
}

fn execute_statements(
    connection: &mut Connection,
    statements: Vec<SqlStatement>,
) -> Result<(), String> {
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    for statement in statements {
        if !is_allowed_data_statement(&statement.sql) {
            return Err("SQL_STATEMENT_NOT_ALLOWED".into());
        }
        let values = statement
            .values
            .into_iter()
            .map(json_to_sql)
            .collect::<Vec<_>>();
        transaction
            .execute(&statement.sql, params_from_iter(values.iter()))
            .map_err(|error| error.to_string())?;
    }
    transaction.commit().map_err(|error| error.to_string())
}

fn is_allowed_data_statement(sql: &str) -> bool {
    if sql.contains(';') {
        return false;
    }
    const TABLES: [&str; 15] = [
        "tasks",
        "task_events",
        "daily_focus",
        "sparks",
        "spark_revisions",
        "spark_analysis",
        "spark_links",
        "reading_items",
        "reading_events",
        "media_items",
        "media_events",
        "period_snapshots",
        "ai_reviews",
        "profile_snapshots",
        "app_settings",
    ];
    if let Some(table) = sql.strip_prefix("DELETE FROM ") {
        return TABLES.contains(&table);
    }
    if let Some(rest) = sql.strip_prefix("INSERT INTO ") {
        if let Some((table, _)) = rest.split_once('(') {
            return TABLES.contains(&table);
        }
    }
    false
}

fn json_to_sql(value: serde_json::Value) -> SqlValue {
    match value {
        serde_json::Value::Null => SqlValue::Null,
        serde_json::Value::Bool(value) => SqlValue::Integer(i64::from(value)),
        serde_json::Value::Number(value) => value
            .as_i64()
            .map(SqlValue::Integer)
            .or_else(|| value.as_f64().map(SqlValue::Real))
            .unwrap_or(SqlValue::Null),
        serde_json::Value::String(value) => SqlValue::Text(value),
        other => SqlValue::Text(other.to_string()),
    }
}

#[tauri::command]
fn write_legacy_backup(
    app: tauri::AppHandle,
    contents: String,
    checksum: String,
) -> Result<String, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let target = write_legacy_backup_file(&directory, &contents, &checksum)?;
    Ok(target.to_string_lossy().into_owned())
}

fn write_legacy_backup_file(
    directory: &Path,
    contents: &str,
    checksum: &str,
) -> Result<PathBuf, String> {
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let target = directory.join("legacy-backup.json");

    if target.exists() {
        let existing = fs::read_to_string(&target).map_err(|error| error.to_string())?;
        if existing.contains(&checksum) {
            return Ok(target);
        }
        return Err("LEGACY_BACKUP_ALREADY_EXISTS".into());
    }

    let temporary = directory.join("legacy-backup.json.tmp");
    if temporary.exists() {
        fs::remove_file(&temporary).map_err(|error| error.to_string())?;
    }
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|error| error.to_string())?;
    file.write_all(contents.as_bytes())
        .and_then(|_| file.sync_all())
        .map_err(|error| error.to_string())?;
    fs::rename(&temporary, &target).map_err(|error| error.to_string())?;
    Ok(target)
}

#[tauri::command]
fn write_data_backup(
    app: tauri::AppHandle,
    contents: String,
    manual: bool,
) -> Result<String, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("backups");
    let target = write_data_backup_file(&directory, &contents, manual)?;
    Ok(target.to_string_lossy().into_owned())
}

fn write_data_backup_file(directory: &Path, contents: &str, manual: bool) -> Result<PathBuf, String> {
    fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    let now = chrono::Utc::now();
    let name = if manual {
        format!("open-ends-backup-manual-{}.json", now.format("%Y%m%d-%H%M%S"))
    } else {
        format!("open-ends-backup-{}.json", now.format("%Y-%m-%d"))
    };
    let target = directory.join(name);
    if !manual && target.exists() {
        return Ok(target);
    }
    let temporary = directory.join(format!("{}.tmp-{}", target.file_name().unwrap().to_string_lossy(), std::process::id()));
    if temporary.exists() {
        fs::remove_file(&temporary).map_err(|error| error.to_string())?;
    }
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|error| error.to_string())?;
    file.write_all(contents.as_bytes())
        .and_then(|_| file.sync_all())
        .map_err(|error| error.to_string())?;
    fs::rename(&temporary, &target).map_err(|error| error.to_string())?;
    if !manual {
        prune_daily_backups(directory)?;
    }
    Ok(target)
}

fn prune_daily_backups(directory: &Path) -> Result<(), String> {
    let mut files = fs::read_dir(directory)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
                return false;
            };
            name.starts_with("open-ends-backup-20") && name.len() == "open-ends-backup-2026-08-24.json".len() && name.ends_with(".json")
        })
        .collect::<Vec<_>>();
    files.sort_by(|a, b| b.file_name().cmp(&a.file_name()));
    for path in files.into_iter().skip(7) {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "open_ends_v1_0_schema",
            sql: INITIAL_SCHEMA,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "spark_revisions",
            sql: SPARK_REVISIONS_SCHEMA,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "ratings",
            sql: RATINGS_SCHEMA,
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            desktop::activate_main(app);
        }))
        .manage(desktop::ExitState::default())
        .manage(desktop::ShortcutStateStore::default())
        .manage(desktop::TodoDockStateStore::default())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            WindowStateBuilder::default()
                // Decorations are part of the release window contract. Older
                // state files may contain `decorated: true`; restoring that
                // field would bring the native titlebar back over MainWindow.
                .with_state_flags(StateFlags::all() & !StateFlags::DECORATIONS)
                .build(),
        )
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name("Open Ends")
                .build(),
        )
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:open-ends.db", migrations)
                .build(),
        )
        .setup(|app| {
            ensure_database(app.handle()).map_err(std::io::Error::other)?;
            desktop::setup(app.handle())?;
            Ok(())
        })
        .on_window_event(desktop::handle_window_event)
        .invoke_handler(tauri::generate_handler![
            write_legacy_backup,
            write_data_backup,
            execute_transaction,
            desktop::show_desktop_window,
            desktop::hide_current_window,
            desktop::minimize_current_window,
            desktop::toggle_maximize_current_window,
            desktop::is_current_window_maximized,
            desktop::start_current_window_dragging,
            desktop::set_todo_panel_interaction,
            desktop::get_todo_panel_pinned,
            desktop::set_todo_panel_pinned,
            desktop::get_shortcut_settings,
            desktop::update_shortcut_settings,
            desktop::get_autostart_enabled,
            desktop::set_autostart_enabled,
            credentials::credential_status,
            credentials::save_credential,
            credentials::delete_credential,
            transport::deepseek_request,
            transport::search_book_covers,
            transport::search_tmdb
        ])
        .run(tauri::generate_context!())
        .expect("error while running Open Ends");
}

#[cfg(test)]
mod tests {
    use super::{
        ensure_spark_revision_history, execute_statements, write_data_backup_file,
        write_legacy_backup_file, SqlStatement, INITIAL_SCHEMA, RATINGS_SCHEMA,
        SPARK_REVISIONS_SCHEMA,
    };
    use rusqlite::Connection;
    use sha2::{Digest, Sha256};
    use tauri_plugin_window_state::StateFlags;

    #[test]
    fn schema_persists_and_enforces_daily_focus_uniqueness() {
        let path = std::env::temp_dir().join(format!("open-ends-{}.sqlite", std::process::id()));
        {
            let connection = Connection::open(&path).unwrap();
            connection.execute_batch(INITIAL_SCHEMA).unwrap();
            connection.execute("INSERT INTO tasks (id,title,context_points_json,status,domain,created_at,updated_at) VALUES ('t','x','[]','open','work','now','now')", []).unwrap();
            connection.execute("INSERT INTO daily_focus (date,task_id,assigned_at) VALUES ('2026-08-24','t','now')", []).unwrap();
            assert!(connection.execute("INSERT INTO daily_focus (date,task_id,assigned_at) VALUES ('2026-08-24','t','later')", []).is_err());
        }
        let reopened = Connection::open(&path).unwrap();
        let title: String = reopened
            .query_row("SELECT title FROM tasks WHERE id='t'", [], |row| row.get(0))
            .unwrap();
        assert_eq!(title, "x");
        drop(reopened);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn spark_revision_migration_backfills_existing_sparks_and_analysis() {
        let mut connection = Connection::open_in_memory().unwrap();
        connection.execute_batch(INITIAL_SCHEMA).unwrap();
        connection.execute(
            "INSERT INTO sparks (id,content,status,created_at) VALUES ('s','  first thought  ','organized','2026-08-20T00:00:00Z')",
            [],
        ).unwrap();
        connection.execute(
            "INSERT INTO spark_analysis (id,spark_id,provider,model,source_hash,result_json,created_at) VALUES ('a','s','deepseek','deepseek-v4-flash','old','{}','2026-08-20T00:01:00Z')",
            [],
        ).unwrap();

        connection.execute_batch(SPARK_REVISIONS_SCHEMA).unwrap();
        ensure_spark_revision_history(&mut connection).unwrap();

        let revision: (i64, String, String) = connection.query_row(
            "SELECT revision,content,source_hash FROM spark_revisions WHERE spark_id='s'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ).unwrap();
        assert_eq!(revision.0, 1);
        assert_eq!(revision.1, "  first thought  ");
        assert_eq!(revision.2, format!("{:x}", Sha256::digest(b"first thought")));
        let analysis_revision: i64 = connection.query_row(
            "SELECT spark_revision FROM spark_analysis WHERE id='a'",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(analysis_revision, 1);
    }

    #[test]
    fn ratings_migration_preserves_v2_rows_and_enforces_rating_semantics() {
        let connection = Connection::open_in_memory().unwrap();
        connection.execute_batch(INITIAL_SCHEMA).unwrap();
        connection.execute_batch(SPARK_REVISIONS_SCHEMA).unwrap();
        connection.execute("INSERT INTO reading_items (id,title,type,status,preference,created_at,updated_at) VALUES ('r','Book','book','want','like','now','now')", []).unwrap();
        connection.execute("INSERT INTO reading_events (id,reading_item_id,type,preference,occurred_at,local_date,timezone) VALUES ('re','r','added',NULL,'now','2026-08-30','Asia/Shanghai')", []).unwrap();
        connection.execute("INSERT INTO media_items (id,tmdb_id,media_type,title,genre_ids_json,status,created_at,updated_at) VALUES ('m',42,'movie','Film','[]','want','now','now')", []).unwrap();
        connection.execute("INSERT INTO media_events (id,media_item_id,type,preference,occurred_at,local_date,timezone) VALUES ('me','m','added',NULL,'now','2026-08-30','Asia/Shanghai')", []).unwrap();

        connection.execute_batch(RATINGS_SCHEMA).unwrap();

        let preference: String = connection.query_row("SELECT preference FROM reading_items WHERE id='r'", [], |row| row.get(0)).unwrap();
        assert_eq!(preference, "like");
        let rating_column: String = connection.query_row("SELECT name FROM pragma_table_info('reading_items') WHERE name='rating'", [], |row| row.get(0)).unwrap();
        assert_eq!(rating_column, "rating");
        connection.execute("INSERT INTO reading_events (id,reading_item_id,type,rating,occurred_at,local_date,timezone) VALUES ('re-rating','r','rating_changed',4.5,'now','2026-08-30','Asia/Shanghai')", []).unwrap();
        assert!(connection.execute("INSERT INTO media_items (id,tmdb_id,media_type,title,genre_ids_json,status,rating,created_at,updated_at) VALUES ('bad',43,'movie','Bad','[]','want',3.3,'now','now')", []).is_err());
        assert!(connection.execute("INSERT INTO media_events (id,media_item_id,type,rating,occurred_at,local_date,timezone) VALUES ('me-bad','m','rating_changed',5.5,'now','2026-08-30','Asia/Shanghai')", []).is_err());
        let event_type: String = connection.query_row("SELECT type FROM reading_events WHERE id='re-rating'", [], |row| row.get(0)).unwrap();
        assert_eq!(event_type, "rating_changed");
    }

    #[test]
    fn failed_replace_transaction_rolls_back_all_changes() {
        let mut connection = Connection::open_in_memory().unwrap();
        connection.execute_batch(INITIAL_SCHEMA).unwrap();
        connection.execute("INSERT INTO tasks (id,title,context_points_json,status,domain,created_at,updated_at) VALUES ('original','kept','[]','open','work','now','now')", []).unwrap();
        let statements = vec![
            SqlStatement { sql: "DELETE FROM tasks".into(), values: vec![] },
            SqlStatement { sql: "INSERT INTO tasks (id,title,context_points_json,status,domain,created_at,updated_at) VALUES (?,?,?,?,?,?,?)".into(), values: vec!["broken".into(),"broken".into(),"[]".into(),"invalid-status".into(),"work".into(),"now".into(),"now".into()] },
        ];
        assert!(execute_statements(&mut connection, statements).is_err());
        let title: String = connection
            .query_row("SELECT title FROM tasks WHERE id='original'", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(title, "kept");
    }

    #[test]
    fn replace_transaction_allows_spark_revision_rows() {
        let mut connection = Connection::open_in_memory().unwrap();
        connection.execute_batch(INITIAL_SCHEMA).unwrap();
        connection.execute_batch(SPARK_REVISIONS_SCHEMA).unwrap();
        let statements = vec![
            SqlStatement { sql: "DELETE FROM spark_revisions".into(), values: vec![] },
            SqlStatement {
                sql: "INSERT INTO spark_revisions(id,spark_id,revision,content,source_hash,created_at) VALUES (?,?,?,?,?,?)".into(),
                values: vec![
                    "revision-1".into(),
                    "spark-1".into(),
                    1.into(),
                    "a thought".into(),
                    "hash".into(),
                    "now".into(),
                ],
            },
        ];

        connection.execute(
            "INSERT INTO sparks (id,content,status,created_at) VALUES ('spark-1','a thought','inbox','now')",
            [],
        ).unwrap();
        execute_statements(&mut connection, statements).unwrap();

        let content: String = connection
            .query_row("SELECT content FROM spark_revisions WHERE id='revision-1'", [], |row| row.get(0))
            .unwrap();
        assert_eq!(content, "a thought");
    }

    #[test]
    fn window_state_does_not_restore_decorations() {
        let flags = StateFlags::all() & !StateFlags::DECORATIONS;
        assert!(flags.contains(StateFlags::SIZE));
        assert!(flags.contains(StateFlags::POSITION));
        assert!(!flags.contains(StateFlags::DECORATIONS));
    }

    #[test]
    fn legacy_backup_recovers_from_a_stale_temporary_file() {
        let directory = std::env::temp_dir().join(format!(
            "open-ends-backup-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&directory).unwrap();
        std::fs::write(directory.join("legacy-backup.json.tmp"), "partial").unwrap();

        let target = write_legacy_backup_file(
            &directory,
            r#"{"checksum":"expected","store":{}}"#,
            "expected",
        )
        .unwrap();

        assert_eq!(
            std::fs::read_to_string(&target).unwrap(),
            r#"{"checksum":"expected","store":{}}"#
        );
        assert!(!directory.join("legacy-backup.json.tmp").exists());
        let _ = std::fs::remove_dir_all(directory);
    }

    #[test]
    fn data_backup_writes_a_daily_file_and_is_idempotent() {
        let directory = std::env::temp_dir().join(format!(
            "open-ends-data-backup-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let first = write_data_backup_file(&directory, "{\"data\":1}", false).unwrap();
        let second = write_data_backup_file(&directory, "{\"data\":2}", false).unwrap();
        assert_eq!(first, second);
        assert_eq!(std::fs::read_to_string(first).unwrap(), "{\"data\":1}");
        let _ = std::fs::remove_dir_all(directory);
    }
}
