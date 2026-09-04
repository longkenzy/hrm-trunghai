CREATE TABLE IF NOT EXISTS companies (
    company_id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    tax_code TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    representative TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
    department_id TEXT PRIMARY KEY,
    company_id TEXT REFERENCES companies(company_id),
    department_name TEXT NOT NULL,
    manager_id TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS positions (
    position_id TEXT PRIMARY KEY,
    position_name TEXT NOT NULL,
    department_id TEXT REFERENCES departments(department_id),
    level TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
    employee_id TEXT PRIMARY KEY,
    time_attendance_code TEXT,
    full_name TEXT NOT NULL,
    gender TEXT,
    date_of_birth TEXT,
    birth_place TEXT,
    native_place TEXT,
    ethnicity TEXT,
    religion TEXT,
    nationality TEXT DEFAULT 'Việt Nam',
    marital_status TEXT,
    tax_code TEXT,
    company_id TEXT REFERENCES companies(company_id),
    department_id TEXT REFERENCES departments(department_id),
    position_id TEXT REFERENCES positions(position_id),
    job_title TEXT,
    direct_manager_id TEXT,
    direct_manager_name TEXT,
    work_location TEXT,
    employment_status TEXT DEFAULT 'Đang làm việc',
    probation_start_date TEXT,
    official_date TEXT,
    resignation_date TEXT,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_contacts (
    employee_id TEXT PRIMARY KEY REFERENCES employees(employee_id) ON DELETE CASCADE,
    mobile_phone TEXT,
    work_email TEXT,
    personal_email TEXT,
    permanent_address TEXT,
    current_address TEXT
);

CREATE TABLE IF NOT EXISTS employee_identity_docs (
    employee_id TEXT PRIMARY KEY REFERENCES employees(employee_id) ON DELETE CASCADE,
    doc_type TEXT DEFAULT 'CCCD',
    id_number TEXT,
    id_issue_date TEXT,
    id_issue_place TEXT,
    id_expiry_date TEXT
);

CREATE TABLE IF NOT EXISTS employee_bank_accounts (
    employee_id TEXT PRIMARY KEY REFERENCES employees(employee_id) ON DELETE CASCADE,
    bank_name TEXT,
    account_number TEXT,
    account_holder TEXT,
    bank_branch TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'USER',
    employee_id TEXT REFERENCES employees(employee_id),
    status TEXT DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role, status)
VALUES ('USER-001', 'admin', 'admin123', 'Quản trị viên Hệ thống', 'SUPER_ADMIN', 'ACTIVE');
