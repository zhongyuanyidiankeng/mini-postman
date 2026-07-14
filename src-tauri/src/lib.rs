use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

mod commands;

pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "normalize_auth_type",
            sql: include_str!("../migrations/002_normalize_auth_type.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:mini_postman.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::http::send_http_request,
            commands::curl::generate_curl,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
