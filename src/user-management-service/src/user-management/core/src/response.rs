use lambda_http::http::StatusCode;
use lambda_http::{Body, Error, Response};
use serde::Serialize;
use tracing::Span;
use tracing_opentelemetry::OpenTelemetrySpanExt;

#[derive(Serialize)]
struct ResponseWrapper<T>
where
    T: Serialize,
{
    data: T,
    message: String,
}

pub fn empty_response(status: &StatusCode) -> Result<Response<Body>, Error> {
    Span::current().set_attribute("http.status_code", status.as_u16().to_string());
    let response = Response::builder()
        .status(status)
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Headers", "Content-Type")
        .header("Access-Control-Allow-Methods", "POST,GET,PUT,DELETE")
        .body(Body::Empty)
        .map_err(Box::new)?;

    Ok(response)
}

pub fn json_response(status: &StatusCode, body: &impl Serialize) -> Result<Response<Body>, Error> {
    Span::current().set_attribute("http.status_code", status.as_u16().to_string());
    let wrapper = ResponseWrapper {
        data: body,
        message: "".to_string(),
    };

    let response = Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Headers", "Content-Type")
        .header("Access-Control-Allow-Methods", "POST,GET,PUT,DELETE")
        .body(Body::Text(
            serde_json::to_string(&wrapper).unwrap_or("".to_string()),
        ))
        .map_err(Box::new)?;

    Ok(response)
}
