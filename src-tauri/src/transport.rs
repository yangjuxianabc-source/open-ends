use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

const DEEPSEEK_BASE_URL: &str = "https://api.deepseek.com";
pub const DEFAULT_DEEPSEEK_MODEL: &str = "deepseek-v4-flash";

fn apply_deepseek_defaults(payload: &mut Value) {
    if let Value::Object(object) = payload {
        object.insert("model".into(), Value::String(DEFAULT_DEEPSEEK_MODEL.into()));
        object.insert("thinking".into(), json!({"type": "disabled"}));
    }
}

pub async fn validate_deepseek_key(api_key: &str) -> Result<String, String> {
    let response = client(Duration::from_secs(12))?
        .get(format!("{DEEPSEEK_BASE_URL}/models"))
        .bearer_auth(api_key)
        .send()
        .await;
    match response {
        Ok(response) if response.status().as_u16() == 401 || response.status().as_u16() == 403 => {
            Err("INVALID_API_KEY".into())
        }
        Ok(response) if response.status().is_success() => Ok("verified".into()),
        Ok(response)
            if response.status().as_u16() == 429 || response.status().is_server_error() =>
        {
            Ok("unverified".into())
        }
        Ok(_) | Err(_) => Ok("unverified".into()),
    }
}

#[tauri::command]
pub async fn deepseek_request(payload: Value) -> Result<Value, String> {
    let api_key = crate::credentials::read_secret("deepseek")?;
    let mut payload = payload;
    apply_deepseek_defaults(&mut payload);
    let response = client(Duration::from_secs(45))?
        .post(format!("{DEEPSEEK_BASE_URL}/chat/completions"))
        .bearer_auth(api_key)
        .json(&payload)
        .send()
        .await
        .map_err(|_| "UPSTREAM_UNAVAILABLE".to_string())?;
    let status = response.status();
    let body = response
        .json::<Value>()
        .await
        .map_err(|_| "UPSTREAM_INVALID_RESPONSE".to_string())?;
    if status.is_success() {
        Ok(body)
    } else if status.as_u16() == 401 || status.as_u16() == 403 {
        Err("INVALID_API_KEY".into())
    } else if status.as_u16() == 429 {
        Err("UPSTREAM_RATE_LIMITED".into())
    } else {
        Err("UPSTREAM_REQUEST_FAILED".into())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaCandidate {
    tmdb_id: i64,
    media_type: &'static str,
    title: String,
    original_title: Option<String>,
    release_date: Option<String>,
    release_year: Option<i32>,
    poster_path: Option<String>,
    genre_ids: Vec<i64>,
    original_language: Option<String>,
}

#[derive(Deserialize)]
struct TmdbResponse {
    #[serde(default)]
    results: Vec<TmdbResult>,
}

#[derive(Deserialize)]
struct TmdbResult {
    id: i64,
    media_type: Option<String>,
    title: Option<String>,
    name: Option<String>,
    original_title: Option<String>,
    original_name: Option<String>,
    release_date: Option<String>,
    first_air_date: Option<String>,
    poster_path: Option<String>,
    #[serde(default)]
    genre_ids: Vec<i64>,
    original_language: Option<String>,
}

#[tauri::command]
pub async fn search_tmdb(
    query: String,
    media_type_hint: Option<String>,
) -> Result<Vec<MediaCandidate>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let token = crate::credentials::read_secret("tmdb")?;
    let response = client(Duration::from_secs(12))?
        .get("https://api.themoviedb.org/3/search/multi")
        .bearer_auth(token)
        .query(&[
            ("query", query),
            ("include_adult", "false"),
            ("language", "zh-CN"),
            ("page", "1"),
        ])
        .send()
        .await
        .map_err(|_| "UPSTREAM_UNAVAILABLE".to_string())?;
    let status = response.status();
    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Err("INVALID_API_KEY".into());
    }
    if status.as_u16() == 429 {
        return Err("UPSTREAM_RATE_LIMITED".into());
    }
    if !status.is_success() {
        return Err("UPSTREAM_REQUEST_FAILED".into());
    }
    let payload = response
        .json::<TmdbResponse>()
        .await
        .map_err(|_| "UPSTREAM_INVALID_RESPONSE".to_string())?;
    let hint = media_type_hint
        .as_deref()
        .filter(|value| *value == "movie" || *value == "tv");
    Ok(payload
        .results
        .into_iter()
        .filter_map(|item| map_tmdb_result(item, hint))
        .take(10)
        .collect())
}

fn map_tmdb_result(item: TmdbResult, hint: Option<&str>) -> Option<MediaCandidate> {
    let media_type = item.media_type.as_deref()?;
    if media_type != "movie" && media_type != "tv" || hint.is_some_and(|value| value != media_type)
    {
        return None;
    }
    let title = item.title.or(item.name)?;
    let release_date = item
        .release_date
        .or(item.first_air_date)
        .filter(|value| !value.is_empty());
    Some(MediaCandidate {
        tmdb_id: item.id,
        media_type: if media_type == "movie" { "movie" } else { "tv" },
        title,
        original_title: item.original_title.or(item.original_name),
        release_year: release_date
            .as_deref()
            .and_then(|value| value.get(0..4))
            .and_then(|value| value.parse().ok()),
        release_date,
        poster_path: item.poster_path,
        genre_ids: item.genre_ids,
        original_language: item.original_language,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverCandidate {
    provider: &'static str,
    external_id: String,
    title: String,
    authors: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    publisher: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    published_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    isbn10: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    isbn13: Option<String>,
}

#[derive(Deserialize)]
struct GoogleBooksResponse {
    #[serde(default)]
    items: Vec<GoogleBookItem>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoogleBookItem {
    id: String,
    #[serde(default)]
    volume_info: GoogleVolumeInfo,
}

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoogleVolumeInfo {
    title: Option<String>,
    #[serde(default)]
    authors: Vec<String>,
    publisher: Option<String>,
    published_date: Option<String>,
    #[serde(default)]
    industry_identifiers: Vec<GoogleIndustryIdentifier>,
    image_links: Option<GoogleImageLinks>,
}

#[derive(Deserialize)]
struct GoogleIndustryIdentifier {
    identifier: String,
    #[serde(rename = "type")]
    identifier_type: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoogleImageLinks {
    thumbnail: Option<String>,
    small_thumbnail: Option<String>,
}

#[tauri::command]
pub async fn search_book_covers(
    title: String,
    author: Option<String>,
) -> Result<Vec<CoverCandidate>, String> {
    let title = title.trim();
    if title.is_empty() {
        return Ok(Vec::new());
    }
    search_google_books(title, author.as_deref()).await
}

async fn search_google_books(
    title: &str,
    author: Option<&str>,
) -> Result<Vec<CoverCandidate>, String> {
    let api_key = crate::credentials::read_builtin_google_books_key();
    let query = build_google_books_query(title, author);
    let candidates = search_google_books_query(&query, api_key.as_deref()).await?;
    if candidates.is_empty() && author.is_some_and(|value| !value.trim().is_empty()) {
        return search_google_books_query(
            &build_google_books_query(title, None),
            api_key.as_deref(),
        )
        .await;
    }
    Ok(candidates)
}

fn build_google_books_query(title: &str, author: Option<&str>) -> String {
    let mut query = format!("intitle:{title}");
    if let Some(author) = author.filter(|value| !value.trim().is_empty()) {
        query.push_str(" inauthor:");
        query.push_str(author);
    }
    query
}

async fn search_google_books_query(
    query: &str,
    api_key: Option<&str>,
) -> Result<Vec<CoverCandidate>, String> {
    let mut request = client(Duration::from_secs(8))?
        .get("https://www.googleapis.com/books/v1/volumes")
        .query(&[
            ("q", query),
            ("maxResults", "10"),
            ("printType", "books"),
            ("orderBy", "relevance"),
        ]);
    if let Some(api_key) = api_key {
        request = request.query(&[("key", api_key)]);
    }
    let response = request
        .send()
        .await
        .map_err(|_| "SOURCE_UNAVAILABLE".to_string())?;
    if !response.status().is_success() {
        return Err("SOURCE_UNAVAILABLE".into());
    }
    let payload = response
        .json::<GoogleBooksResponse>()
        .await
        .map_err(|_| "SOURCE_UNAVAILABLE".to_string())?;
    Ok(payload
        .items
        .into_iter()
        .filter_map(map_google_result)
        .take(10)
        .collect())
}

fn map_google_result(item: GoogleBookItem) -> Option<CoverCandidate> {
    let GoogleBookItem { id, volume_info } = item;
    let title = volume_info.title?;
    let isbn10 = volume_info
        .industry_identifiers
        .iter()
        .find(|item| item.identifier_type == "ISBN_10")
        .map(|item| item.identifier.clone());
    let isbn13 = volume_info
        .industry_identifiers
        .iter()
        .find(|item| item.identifier_type == "ISBN_13")
        .map(|item| item.identifier.clone());
    let url = volume_info
        .image_links
        .and_then(|links| links.thumbnail.or(links.small_thumbnail))
        .map(|value| value.replace("http://", "https://"));
    Some(CoverCandidate {
        provider: "google",
        external_id: id,
        title,
        authors: volume_info.authors,
        url,
        publisher: volume_info.publisher,
        published_date: volume_info.published_date,
        isbn10,
        isbn13,
    })
}

fn client(timeout: Duration) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        apply_deepseek_defaults, build_google_books_query, map_google_result, map_tmdb_result,
        GoogleBooksResponse, TmdbResult, DEFAULT_DEEPSEEK_MODEL,
    };

    #[test]
    fn google_books_query_uses_title_and_author_fields() {
        assert_eq!(
            build_google_books_query("了不起的盖茨比", Some("（美）菲茨杰拉德")),
            "intitle:了不起的盖茨比 inauthor:（美）菲茨杰拉德"
        );
        assert_eq!(
            build_google_books_query("三体", Some("  ")),
            "intitle:三体"
        );
    }

    #[test]
    fn deepseek_request_enforces_current_model_and_disabled_thinking() {
        let mut payload = serde_json::json!({
            "model": "legacy-model",
            "thinking": {"type": "enabled"},
            "messages": []
        });
        apply_deepseek_defaults(&mut payload);
        assert_eq!(payload["model"], DEFAULT_DEEPSEEK_MODEL);
        assert_eq!(payload["thinking"]["type"], "disabled");
    }

    #[test]
    fn google_books_payload_maps_candidate_metadata_and_https_cover() {
        let payload: GoogleBooksResponse = serde_json::from_str(
            r#"{"items":[{"id":"google-1","volumeInfo":{"title":"A","authors":["Author"],"publisher":"Press","publishedDate":"2021","industryIdentifiers":[{"type":"ISBN_13","identifier":"9781234567890"}],"imageLinks":{"thumbnail":"http://books.example/cover.jpg"}}}]}"#,
        )
        .unwrap();
        let candidate = map_google_result(payload.items.into_iter().next().unwrap()).unwrap();
        assert_eq!(candidate.provider, "google");
        assert_eq!(candidate.title, "A");
        assert_eq!(candidate.publisher.as_deref(), Some("Press"));
        assert_eq!(candidate.isbn13.as_deref(), Some("9781234567890"));
        assert_eq!(
            candidate.url.as_deref(),
            Some("https://books.example/cover.jpg")
        );
    }

    #[test]
    fn tmdb_candidate_uses_movie_title_and_release_year() {
        let candidate = map_tmdb_result(
            TmdbResult {
                id: 42,
                media_type: Some("movie".into()),
                title: Some("电影标题".into()),
                name: None,
                original_title: Some("Original".into()),
                original_name: None,
                release_date: Some("2024-05-06".into()),
                first_air_date: None,
                poster_path: Some("/poster.jpg".into()),
                genre_ids: vec![18],
                original_language: Some("zh".into()),
            },
            Some("movie"),
        )
        .unwrap();
        assert_eq!(candidate.tmdb_id, 42);
        assert_eq!(candidate.title, "电影标题");
        assert_eq!(candidate.release_year, Some(2024));
    }
}
