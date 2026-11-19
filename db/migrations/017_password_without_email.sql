-- Password signup no longer collects an email. Existing emails stay unique.
alter table users drop constraint users_password_needs_email;
