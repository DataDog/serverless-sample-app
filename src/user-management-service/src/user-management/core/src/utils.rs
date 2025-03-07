use std::hash::{DefaultHasher, Hash, Hasher};

pub (crate) struct StringHasher {
    
}

impl StringHasher {
    pub(crate) fn hash_string(input_string: String) -> String {
        let mut hasher = DefaultHasher::new();
        input_string.hash(&mut hasher);
        hasher.finish().to_string()
    }
}