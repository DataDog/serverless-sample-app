use lambda_http::http::StatusCode;
use lambda_http::{Body, Error, Response};
use serde::Serialize;

pub fn empty_response(status: &StatusCode) -> Result<Response<Body>, Error> {
    let response = Response::builder()
        .status(status)
        .body(Body::Empty)
        .map_err(Box::new)?;

    Ok(response)
}

pub fn json_response(status: &StatusCode, body: &impl Serialize) -> Result<Response<Body>, Error> {
    let response = Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .body(Body::Text(serde_json::to_string(&body).unwrap()))
        .map_err(Box::new)?;

    Ok(response)
}
