pub fn parse_name_from_arn(arn: &str) -> String {
    let arn_parts: Vec<&str> = arn.split(":").collect();

    if arn_parts.len() < 5 {
        return "".to_string();
    }

    arn_parts[5].to_string()
}