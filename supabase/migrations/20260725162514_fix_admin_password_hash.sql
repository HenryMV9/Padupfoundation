-- Update the admin user's password hash to a bcrypt hash that
-- GoTrue can verify for the password "PadupAdmin2024!"
UPDATE auth.users
SET encrypted_password = '$2a$10$LnDjoezOzOFhAfNvvWZAOu9lvcERXI8UCpjOCcMINRCYyvuHRX6lK'
WHERE email = 'admin@padupfoundation.org';