create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists books (
  id serial primary key,
  title text not null,
  subject text not null,
  publisher text not null default '',
  year int,
  status text not null default 'pending' check (status in ('pending','approved')),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists sections (
  id serial primary key,
  book_id int not null references books(id) on delete cascade,
  name text not null,
  ord int not null
);
create index if not exists sections_book on sections(book_id);

create table if not exists questions (
  id serial primary key,
  section_id int not null references sections(id) on delete cascade,
  label text not null,
  ord int not null,
  kind text not null check (kind in ('choice','short')),
  answer text not null
);
create index if not exists questions_section on questions(section_id);

create table if not exists attempts (
  id serial primary key,
  user_id uuid not null references users(id) on delete cascade,
  section_id int not null references sections(id) on delete cascade,
  total int not null,
  correct int not null,
  seconds int not null default 0,
  is_retry boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists attempts_user on attempts(user_id);

create table if not exists attempt_items (
  attempt_id int not null references attempts(id) on delete cascade,
  question_id int not null references questions(id) on delete cascade,
  response text not null,
  is_correct boolean not null,
  primary key (attempt_id, question_id)
);
create index if not exists attempt_items_question on attempt_items(question_id);

create table if not exists feedback (
  id serial primary key,
  user_id uuid,
  body text not null,
  page text not null default '',
  created_at timestamptz not null default now()
);

-- v0.2: 자가채점 문항, 단원 메모, 미확인 채점
alter table questions drop constraint if exists questions_kind_check;
alter table questions add constraint questions_kind_check check (kind in ('choice','short','self'));
alter table attempt_items alter column is_correct drop not null;
alter table sections add column if not exists note text not null default '';
