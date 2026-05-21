UPDATE users
SET role = CASE
    WHEN role = 'admin' THEN 'admin'
    ELSE 'user'
END;
