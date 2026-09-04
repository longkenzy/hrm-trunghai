const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');

const DB_PATH = path.join(__dirname, '..', 'database_schema.json');
const SAMPLE_PATH = path.join(__dirname, '..', 'sample_database.json');
const EXCEL_PATH = path.join(__dirname, '..', 'HRM_Database_Normalized.xlsx');

// Ensure sample backup exists
if (!fs.existsSync(SAMPLE_PATH) && fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, SAMPLE_PATH);
    console.log('Backed up current database to sample_database.json');
}

const sample = fs.existsSync(SAMPLE_PATH) ? JSON.parse(fs.readFileSync(SAMPLE_PATH, 'utf-8')) : { tables: {} };
const adminHash = bcrypt.hashSync('123456', 10);

const cleanDb = {
    tables: {
        '00_Companies': [
            {
                company_id: 'CP-01',
                company_name: 'CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ XÂY DỰNG TRUNG HẢI',
                tax_code: '0101234567',
                phone: '024.1234.5678',
                email: 'contact@trunghaico.vn',
                address: 'Tòa nhà Trung Hải, Hà Nội',
                status: 'Hoạt động'
            }
        ],
        '00_Master_Profiles': [
            {
                employee_id: 'TH-1948',
                full_name: 'Huỳnh Thanh Long',
                work_email: 'longht@trunghaico.vn',
                mobile_phone: '0901234567',
                job_title: 'Giám Đốc Quản Trị Hệ Thống',
                department_id: 'BGD',
                department_name: 'Ban Giám Đốc',
                employment_status: 'Đang làm việc',
                labor_nature: 'Chính thức',
                gender: 'Nam',
                join_date: '2026-01-01'
            }
        ],
        '00_Data_Dictionary': sample.tables ? (sample.tables['00_Data_Dictionary'] || []) : [],
        '01_Departments': [
            { department_id: 'BGD', department_name: 'Ban Giám Đốc', parent_dept_id: '', manager_id: 'TH-1948', status: 'Hoạt động' },
            { department_id: 'HR', department_name: 'Phòng Hành Chính Nhân Sự', parent_dept_id: 'BGD', manager_id: '', status: 'Hoạt động' },
            { department_id: 'KT', department_name: 'Phòng Tài Chính Kế Toán', parent_dept_id: 'BGD', manager_id: '', status: 'Hoạt động' }
        ],
        '02_Positions': [
            { position_id: 'POS-01', position_name: 'Tổng Giám Đốc', department_id: 'BGD', level: 'Cấp 10' },
            { position_id: 'POS-02', position_name: 'Trưởng Phòng Nhân Sự', department_id: 'HR', level: 'Cấp 8' }
        ],
        '03_Employees': [
            {
                employee_id: 'TH-1948',
                full_name: 'Huỳnh Thanh Long',
                work_email: 'longht@trunghaico.vn',
                mobile_phone: '0901234567',
                job_title: 'Giám Đốc Quản Trị Hệ Thống',
                department_id: 'BGD',
                department_name: 'Ban Giám Đốc',
                employment_status: 'Đang làm việc',
                labor_nature: 'Chính thức',
                gender: 'Nam',
                join_date: '2026-01-01'
            }
        ],
        '04_Contacts_Addresses': [],
        '05_Identity_Docs': [],
        '06_Emergency_Contacts': [],
        '07_Education': [],
        '08_Salaries_Banks': [],
        '09_Insurance_Welfare': [],
        '10_Contracts': [
            {
                contract_id: 'TH-1948',
                employee_id: 'TH-1948',
                full_name: 'Huỳnh Thanh Long',
                contract_type: 'Hợp đồng lao động không xác định thời hạn',
                trial_start_date: '2026-01-01',
                official_date: '2026-01-01',
                contract_status: 'HIỆU LỰC'
            }
        ],
        '11_System_Accounts': [
            {
                account_id: 'ACC-TH1948',
                employee_id: 'TH-1948',
                username: 'longht',
                full_name: 'Huỳnh Thanh Long',
                account_email: 'longht@trunghaico.vn',
                role: 'ADMIN',
                account_status: 'Kích hoạt',
                password: adminHash,
                created_at: new Date().toISOString()
            },
            {
                account_id: 'ACC-ADMIN',
                employee_id: 'TH-0001',
                username: 'admin',
                full_name: 'Quản Trị Viên',
                account_email: 'admin@trunghai.vn',
                role: 'ADMIN',
                account_status: 'Kích hoạt',
                password: adminHash,
                created_at: new Date().toISOString()
            }
        ],
        '12_System_Logs': [],
        '13_Recycle_Bin': []
    },
    company_info: {
        brand_name: "TRUNG HẢI",
        full_name: "CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ XÂY DỰNG TRUNG HẢI",
        subtitle: "HRM ENTERPRISE",
        logo_url: "assets/logo.png",
        tax_code: "0101234567",
        phone: "024.1234.5678",
        email: "contact@trunghaico.vn",
        address: "Tòa nhà Trung Hải, Hà Nội",
        website: "https://trunghaico.vn"
    }
};

fs.writeFileSync(DB_PATH, JSON.stringify(cleanDb, null, 2), 'utf-8');
console.log('✅ Reset database_schema.json to Clean Starter Template.');

// Sync Excel
try {
    const wb = XLSX.utils.book_new();
    for (const [sheetName, rows] of Object.entries(cleanDb.tables || {})) {
        const safeSheetName = sheetName.substring(0, 31);
        const ws = XLSX.utils.json_to_sheet(rows || []);
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
    }
    XLSX.writeFile(wb, EXCEL_PATH);
    console.log('✅ Synced clean database to HRM_Database_Normalized.xlsx');
} catch (e) {
    console.warn('Excel sync warning:', e.message);
}
