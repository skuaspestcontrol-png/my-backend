ALTER TABLE employees
ADD COLUMN profile_photo VARCHAR(255) NULL AFTER pincode,
ADD COLUMN present_address TEXT NULL AFTER profile_photo;