UPDATE collections
SET auth_type = 'none'
WHERE auth_type = 'noauth';

UPDATE collection_items
SET auth_type = 'none'
WHERE auth_type = 'noauth';
