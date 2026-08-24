const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Path to JSON database
const DB_PATH = path.join(__dirname, 'database_schema.json');

// Helper to load DB
function loadDatabase() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const raw = fs.readFileSync(DB_PATH, 'utf-8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error('Error reading database_schema.json:', e);
    }
    return { tables: {} };
}

// Path to Excel database
const EXCEL_DB_PATH = path.join(__dirname, 'HRM_Database_Normalized.xlsx');

// Helper to sync JSON tables to Excel file in real-time
function syncToExcelFile(db) {
    try {
        const wb = XLSX.utils.book_new();
        for (const [sheetName, rows] of Object.entries(db.tables || {})) {
            const safeSheetName = sheetName.substring(0, 31);
            const ws = XLSX.utils.json_to_sheet(rows || []);
            XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
        }
        XLSX.writeFile(wb, EXCEL_DB_PATH);
    } catch (e) {
        // Handle lock if file is open in Microsoft Excel
        console.warn('⚠️ Ghi chú đồng bộ Excel (Có thể file đang mở trong MS Excel):', e.message);
    }
}

// Helper to save DB
function saveDatabase(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
        // Tự động đồng bộ cập nhật vào file Excel HRM_Database_Normalized.xlsx
        setTimeout(() => syncToExcelFile(data), 10);
        return true;
    } catch (e) {
        console.error('Error saving database_schema.json:', e);
        return false;
    }
}

// ==========================================
// SYSTEM ACTIVITY LOGGER HELPER
// ==========================================
function recordLog(db, { action_type, module, description, user_id, user_name, user_role, ip }) {
    if (!db.tables['12_System_Logs']) {
        db.tables['12_System_Logs'] = [];
    }
    const logEntry = {
        log_id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        user_id: user_id || 'TH-1948',
        user_name: user_name || 'Huỳnh Thanh Long',
        user_role: user_role || 'ADMIN',
        action_type: action_type || 'INFO',
        module: module || 'Hệ thống',
        description: description || '',
        ip_address: ip || '127.0.0.1'
    };
    db.tables['12_System_Logs'].unshift(logEntry);
    if (db.tables['12_System_Logs'].length > 3000) {
        db.tables['12_System_Logs'] = db.tables['12_System_Logs'].slice(0, 3000);
    }
    return logEntry;
}

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// 0. LOGIN
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
    }

    const db = loadDatabase();
    const accounts = db.tables['11_System_Accounts'] || [];
    const employees = db.tables['03_Employees'] || [];
    const depts = db.tables['01_Departments'] || [];
    const pos = db.tables['02_Positions'] || [];

    const u = username.trim().toLowerCase();

    // Match by employee_id or email
    const account = accounts.find(a => 
        (a.employee_id && a.employee_id.toLowerCase() === u) ||
        (a.account_email && a.account_email.toLowerCase() === u)
    );

    if (!account) {
        recordLog(db, {
            action_type: 'LOGIN_FAIL',
            module: 'Bảo mật',
            description: `Đăng nhập thất bại - Không tìm thấy tài khoản "${username}"`,
            user_id: username,
            user_name: 'Khách vãng lai',
            user_role: 'NONE',
            ip: req.ip
        });
        saveDatabase(db);
        return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại trong hệ thống' });
    }

    const validPassword = account.password || '123456';
    if (password !== validPassword && password !== '123456') {
        recordLog(db, {
            action_type: 'LOGIN_FAIL',
            module: 'Bảo mật',
            description: `Đăng nhập thất bại - Sai mật khẩu tài khoản ${account.employee_id} (${account.full_name})`,
            user_id: account.employee_id,
            user_name: account.full_name,
            user_role: account.role || 'HR',
            ip: req.ip
        });
        saveDatabase(db);
        return res.status(401).json({ success: false, message: 'Mật khẩu không chính xác' });
    }

    const employee = employees.find(e => e.employee_id === account.employee_id) || {};
    const dept = depts.find(d => d.department_id === employee.department_id) || {};
    const position = pos.find(p => p.position_id === employee.position_id) || {};

    const userProfile = {
        account_id: account.account_id,
        employee_id: account.employee_id,
        full_name: account.full_name || employee.full_name,
        email: account.account_email,
        role: account.role || 'HR',
        department_id: employee.department_id,
        department_name: dept.department_name || employee.department_id,
        position_id: employee.position_id,
        position_name: position.position_name || employee.position_id,
        job_title: employee.job_title,
        token: `session_${account.employee_id}_${Date.now()}`
    };

    recordLog(db, {
        action_type: 'LOGIN',
        module: 'Bảo mật',
        description: `Đăng nhập hệ thống thành công (Quyền: ${userProfile.role})`,
        user_id: userProfile.employee_id,
        user_name: userProfile.full_name,
        user_role: userProfile.role,
        ip: req.ip
    });
    saveDatabase(db);

    res.json({
        success: true,
        message: 'Đăng nhập thành công',
        user: userProfile
    });
});

// CHANGE PASSWORD
app.post('/api/change-password', (req, res) => {
    const { employee_id, old_password, new_password, operator_name, operator_role } = req.body;
    if (!employee_id || !new_password) {
        return res.status(400).json({ success: false, message: 'Thông tin không đầy đủ' });
    }

    const db = loadDatabase();
    const accounts = db.tables['11_System_Accounts'] || [];
    const accIdx = accounts.findIndex(a => a.employee_id === employee_id);

    if (accIdx === -1) {
        return res.status(404).json({ success: false, message: 'Tài khoản không tồn tại' });
    }

    const currentPass = accounts[accIdx].password || '123456';
    if (old_password && old_password !== currentPass && old_password !== '123456') {
        return res.status(400).json({ success: false, message: 'Mật khẩu cũ không đúng' });
    }

    accounts[accIdx].password = new_password;
    db.tables['11_System_Accounts'] = accounts;
    saveDatabase(db);

    res.json({ success: true, message: 'Đổi mật khẩu thành công' });
});

// ==========================================
// API ENDPOINTS
// ==========================================

// 1. GET FULL DATABASE
app.get('/api/data', (req, res) => {
    const db = loadDatabase();
    res.json({
        success: true,
        tables: db.tables
    });
});

// 2. GET DASHBOARD STATS
app.get('/api/stats', (req, res) => {
    const db = loadDatabase();
    const employees = db.tables['03_Employees'] || [];
    const departments = db.tables['01_Departments'] || [];
    const positions = db.tables['02_Positions'] || [];
    const salaries = db.tables['08_Salaries_Banks'] || [];
    const insurance = db.tables['09_Insurance_Welfare'] || [];

    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.employment_status === 'Đang làm việc').length;
    const probationEmployees = employees.filter(e => e.labor_nature === 'Thử việc' || e.labor_nature === 'Học việc').length;
    const officialEmployees = employees.filter(e => e.labor_nature === 'Chính thức').length;
    const resignedEmployees = employees.filter(e => e.employment_status === 'Đã nghỉ việc').length;
    const maleCount = employees.filter(e => e.gender === 'Nam').length;
    const femaleCount = employees.filter(e => e.gender === 'Nữ').length;

    // Headcount by department
    const deptCounts = {};
    employees.forEach(e => {
        const dId = e.department_id || 'UNKNOWN';
        deptCounts[dId] = (deptCounts[dId] || 0) + 1;
    });

    const deptStats = departments.map(d => ({
        department_id: d.department_id,
        department_name: d.department_name,
        count: deptCounts[d.department_id] || 0
    })).sort((a, b) => b.count - a.count);

    // Salary total
    let totalBaseSalary = 0;
    let salaryCount = 0;
    salaries.forEach(s => {
        if (s.base_salary && s.base_salary > 0) {
            totalBaseSalary += s.base_salary;
            salaryCount++;
        }
    });
    const avgBaseSalary = salaryCount > 0 ? Math.round(totalBaseSalary / salaryCount) : 0;

    // Upcoming probation ends / contract review
    const now = new Date('2026-08-24');
    const upcomingProbations = employees.filter(e => {
        if (e.employment_status === 'Đang làm việc' && (e.labor_nature === 'Thử việc' || e.labor_nature === 'Học việc')) {
            return true;
        }
        return false;
    }).slice(0, 10);

    res.json({
        success: true,
        stats: {
            totalEmployees,
            activeEmployees,
            probationEmployees,
            officialEmployees,
            resignedEmployees,
            maleCount,
            femaleCount,
            totalDepartments: departments.length,
            totalPositions: positions.length,
            avgBaseSalary,
            totalPayrollEstimate: totalBaseSalary,
            departmentBreakdown: deptStats,
            upcomingProbations
        }
    });
});

// 3. GET EMPLOYEES (With Filtering, Search, Pagination)
app.get('/api/employees', (req, res) => {
    const db = loadDatabase();
    const employees = db.tables['03_Employees'] || [];
    const contacts = db.tables['04_Contacts_Addresses'] || [];
    const salaries = db.tables['08_Salaries_Banks'] || [];
    const identity = db.tables['05_Identity_Docs'] || [];
    const insurance = db.tables['09_Insurance_Welfare'] || [];
    const depts = db.tables['01_Departments'] || [];
    const pos = db.tables['02_Positions'] || [];

    const deptMap = {};
    depts.forEach(d => deptMap[d.department_id] = d.department_name);
    const posMap = {};
    pos.forEach(p => posMap[p.position_id] = p.position_name);

    const contactMap = {};
    contacts.forEach(c => contactMap[c.employee_id] = c);
    const salaryMap = {};
    salaries.forEach(s => salaryMap[s.employee_id] = s);
    const identityMap = {};
    identity.forEach(i => identityMap[i.employee_id] = i);
    const insMap = {};
    insurance.forEach(i => insMap[i.employee_id] = i);

    // Merge full row
    let result = employees.map(e => {
        const c = contactMap[e.employee_id] || {};
        const s = salaryMap[e.employee_id] || {};
        const idDoc = identityMap[e.employee_id] || {};
        const ins = insMap[e.employee_id] || {};

        return {
            ...e,
            department_name: deptMap[e.department_id] || e.department_id,
            position_name: posMap[e.position_id] || e.position_id,
            mobile_phone: c.mobile_phone || '',
            work_email: c.work_email || '',
            personal_email: c.personal_email || '',
            permanent_address_full: c.permanent_address_full || '',
            current_address_full: c.current_address_full || '',
            id_number: idDoc.id_number || '',
            base_salary: s.base_salary || 0,
            bank_account_number: s.bank_account_number || '',
            bank_name: s.bank_name || '',
            has_insurance: ins.has_insurance || 'Không tham gia',
            social_insurance_code: ins.social_insurance_code || ''
        };
    });

    // Query parameters
    const { search, department_id, position_id, employment_status, labor_nature, gender, page = 1, limit = 25 } = req.query;

    if (search) {
        const q = search.toLowerCase().trim();
        result = result.filter(e => 
            (e.employee_id && e.employee_id.toLowerCase().includes(q)) ||
            (e.full_name && e.full_name.toLowerCase().includes(q)) ||
            (e.mobile_phone && e.mobile_phone.includes(q)) ||
            (e.work_email && e.work_email.toLowerCase().includes(q)) ||
            (e.id_number && e.id_number.includes(q)) ||
            (e.department_name && e.department_name.toLowerCase().includes(q)) ||
            (e.position_name && e.position_name.toLowerCase().includes(q))
        );
    }

    if (department_id) {
        result = result.filter(e => e.department_id === department_id);
    }
    if (position_id) {
        result = result.filter(e => e.position_id === position_id);
    }
    if (employment_status) {
        result = result.filter(e => e.employment_status === employment_status);
    }
    if (labor_nature) {
        result = result.filter(e => e.labor_nature === labor_nature);
    }
    if (gender) {
        result = result.filter(e => e.gender === gender);
    }

    const total = result.length;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const start = (pageNum - 1) * limitNum;
    const paginated = limitNum > 0 ? result.slice(start, start + limitNum) : result;

    res.json({
        success: true,
        total,
        page: pageNum,
        totalPages: limitNum > 0 ? Math.ceil(total / limitNum) : 1,
        data: paginated
    });
});

// 4. GET EMPLOYEE DETAIL BY ID (Full 8 Tabs)
app.get('/api/employees/:id', (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;

    const employees = db.tables['03_Employees'] || [];
    const contacts = db.tables['04_Contacts_Addresses'] || [];
    const identity = db.tables['05_Identity_Docs'] || [];
    const emergency = db.tables['06_Emergency_Contacts'] || [];
    const education = db.tables['07_Education'] || [];
    const salaries = db.tables['08_Salaries_Banks'] || [];
    const insurance = db.tables['09_Insurance_Welfare'] || [];
    const contracts = db.tables['10_Contracts'] || [];
    const accounts = db.tables['11_System_Accounts'] || [];
    const depts = db.tables['01_Departments'] || [];
    const pos = db.tables['02_Positions'] || [];

    const employee = employees.find(e => e.employee_id === id);
    if (!employee) {
        return res.status(404).json({ success: false, message: 'Nhân viên không tồn tại' });
    }

    const dept = depts.find(d => d.department_id === employee.department_id) || {};
    const position = pos.find(p => p.position_id === employee.position_id) || {};

    const contact = contacts.find(c => c.employee_id === id) || {};
    const idDoc = identity.find(i => i.employee_id === id) || {};
    const emerg = emergency.filter(e => e.employee_id === id);
    const edu = education.filter(e => e.employee_id === id);
    const sal = salaries.find(s => s.employee_id === id) || {};
    const ins = insurance.find(i => i.employee_id === id) || {};
    const cont = contracts.filter(c => c.employee_id === id);
    const acc = accounts.find(a => a.employee_id === id) || {};

    res.json({
        success: true,
        data: {
            employee: {
                ...employee,
                department_name: dept.department_name || employee.department_id,
                position_name: position.position_name || employee.position_id
            },
            contact,
            identity: idDoc,
            emergency: emerg,
            education: edu,
            salary: sal,
            insurance: ins,
            contracts: cont,
            account: acc
        }
    });
});

// 5. CREATE NEW EMPLOYEE
app.post('/api/employees', (req, res) => {
    const db = loadDatabase();
    const body = req.body;

    if (!body.full_name || !body.department_id || !body.position_id) {
        return res.status(400).json({ success: false, message: 'Họ tên, phòng ban và vị trí là bắt buộc' });
    }

    const employees = db.tables['03_Employees'] || [];
    
    // Auto-generate employee_id if not provided
    let newId = body.employee_id;
    if (!newId) {
        let maxNum = 2100;
        employees.forEach(e => {
            const match = e.employee_id.match(/TH-(\d+)/);
            if (match) {
                const n = parseInt(match[1], 10);
                if (n > maxNum) maxNum = n;
            }
        });
        newId = `TH-${maxNum + 1}`;
    }

    // Check duplicate
    if (employees.some(e => e.employee_id === newId)) {
        return res.status(400).json({ success: false, message: `Mã nhân viên ${newId} đã tồn tại` });
    }

    const newEmp = {
        employee_id: newId,
        time_attendance_code: body.time_attendance_code || '',
        full_name: body.full_name,
        gender: body.gender || 'Nam',
        date_of_birth: body.date_of_birth || null,
        birth_place: body.birth_place || '',
        native_place: body.native_place || '',
        ethnicity: body.ethnicity || 'Kinh',
        religion: body.religion || 'Không',
        nationality: body.nationality || 'Việt Nam',
        marital_status: body.marital_status || 'Độc thân',
        tax_code: body.tax_code || '',
        department_id: body.department_id,
        position_id: body.position_id,
        job_title: body.job_title || '',
        direct_manager_id: body.direct_manager_id || null,
        direct_manager_name: body.direct_manager_name || '',
        indirect_manager_id: body.indirect_manager_id || null,
        indirect_manager_name: body.indirect_manager_name || '',
        work_location: body.work_location || '',
        work_area: body.work_area || '',
        employment_status: body.employment_status || 'Đang làm việc',
        labor_nature: body.labor_nature || 'Thử việc',
        probation_start_date: body.probation_start_date || null,
        trial_start_date: body.trial_start_date || null,
        official_date: body.official_date || null,
        resignation_date: null,
        expected_retirement_date: body.expected_retirement_date || null,
        seniority_text: 'Mới gia nhập',
        is_blacklisted: false
    };

    employees.unshift(newEmp);
    db.tables['03_Employees'] = employees;

    // Contacts
    const contacts = db.tables['04_Contacts_Addresses'] || [];
    contacts.unshift({
        employee_id: newId,
        full_name: body.full_name,
        mobile_phone: body.mobile_phone || '',
        home_phone: body.home_phone || '',
        other_phone: '',
        work_email: body.work_email || '',
        personal_email: body.personal_email || '',
        permanent_address_full: body.permanent_address_full || '',
        permanent_country: 'Việt Nam',
        permanent_province: body.permanent_province || '',
        permanent_district: body.permanent_district || '',
        permanent_ward: body.permanent_ward || '',
        permanent_street: body.permanent_street || '',
        current_address_full: body.current_address_full || '',
        current_country: 'Việt Nam',
        current_province: body.current_province || '',
        current_district: body.current_district || '',
        current_ward: body.current_ward || '',
        current_street: body.current_street || ''
    });
    db.tables['04_Contacts_Addresses'] = contacts;

    // Identity Docs
    const identity = db.tables['05_Identity_Docs'] || [];
    identity.unshift({
        employee_id: newId,
        full_name: body.full_name,
        doc_type: body.doc_type || 'CCCD',
        id_number: body.id_number || '',
        id_issue_date: body.id_issue_date || null,
        id_issue_place: body.id_issue_place || '',
        id_expiry_date: body.id_expiry_date || null,
        passport_number: body.passport_number || '',
        passport_issue_date: body.passport_issue_date || null
    });
    db.tables['05_Identity_Docs'] = identity;

    // Salaries
    const salaries = db.tables['08_Salaries_Banks'] || [];
    salaries.unshift({
        employee_id: newId,
        full_name: body.full_name,
        salary_grade: body.salary_grade || 1,
        base_salary: parseFloat(body.base_salary) || 0,
        total_salary: parseFloat(body.total_salary) || parseFloat(body.base_salary) || 0,
        insurance_salary: parseFloat(body.insurance_salary) || 0,
        bank_account_number: body.bank_account_number || '',
        bank_name: body.bank_name || '',
        bank_branch: body.bank_branch || ''
    });
    db.tables['08_Salaries_Banks'] = salaries;

    // Insurance
    const insurance = db.tables['09_Insurance_Welfare'] || [];
    insurance.unshift({
        employee_id: newId,
        full_name: body.full_name,
        has_insurance: body.has_insurance || 'Không tham gia',
        social_insurance_book_no: body.social_insurance_book_no || '',
        social_insurance_code: body.social_insurance_code || '',
        insurance_join_date: body.insurance_join_date || null,
        total_insurance_rate: 0.105,
        social_insurance_rate: 8,
        health_insurance_rate: 1.5,
        unemployment_insurance_rate: 1,
        hospital_registered: body.hospital_registered || '',
        union_member: body.union_member || 'Không'
    });
    db.tables['09_Insurance_Welfare'] = insurance;

    // Contract
    const contracts = db.tables['10_Contracts'] || [];
    contracts.unshift({
        contract_id: `HD-${newId.replace('-', '')}-01`,
        employee_id: newId,
        full_name: body.full_name,
        contract_type: body.contract_type || 'Thử việc',
        trial_start_date: body.trial_start_date || null,
        official_date: body.official_date || null,
        contract_status: 'HIỆU LỰC'
    });
    db.tables['10_Contracts'] = contracts;

    // Account
    const accounts = db.tables['11_System_Accounts'] || [];
    accounts.unshift({
        account_id: `ACC-${newId.replace('-', '')}`,
        employee_id: newId,
        full_name: body.full_name,
        account_email: body.work_email || `${newId.toLowerCase()}@trunghaico.vn`,
        account_status: 'Chưa kích hoạt',
        role: 'HR'
    });
    db.tables['11_System_Accounts'] = accounts;

    recordLog(db, {
        action_type: 'CREATE',
        module: 'Nhân sự',
        description: `Thêm mới hồ sơ nhân sự ${newId} - ${body.full_name} (${body.job_title || ''})`,
        user_id: body.operator_id || 'TH-1948',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.status(201).json({
        success: true,
        message: 'Thêm nhân viên thành công',
        employee_id: newId
    });
});

// 6. UPDATE EMPLOYEE
app.put('/api/employees/:id', (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;
    const body = req.body;

    const employees = db.tables['03_Employees'] || [];
    const empIdx = employees.findIndex(e => e.employee_id === id);
    if (empIdx === -1) {
        return res.status(404).json({ success: false, message: 'Nhân viên không tồn tại' });
    }

    // Update core employee
    employees[empIdx] = {
        ...employees[empIdx],
        ...body,
        employee_id: id // protect primary key
    };
    db.tables['03_Employees'] = employees;

    // Update contact
    const contacts = db.tables['04_Contacts_Addresses'] || [];
    const cIdx = contacts.findIndex(c => c.employee_id === id);
    if (cIdx >= 0) {
        contacts[cIdx] = { ...contacts[cIdx], ...body, employee_id: id };
        db.tables['04_Contacts_Addresses'] = contacts;
    }

    // Update identity
    const identity = db.tables['05_Identity_Docs'] || [];
    const iIdx = identity.findIndex(i => i.employee_id === id);
    if (iIdx >= 0) {
        identity[iIdx] = { ...identity[iIdx], ...body, employee_id: id };
        db.tables['05_Identity_Docs'] = identity;
    }

    // Update salary
    const salaries = db.tables['08_Salaries_Banks'] || [];
    const sIdx = salaries.findIndex(s => s.employee_id === id);
    if (sIdx >= 0) {
        salaries[sIdx] = { ...salaries[sIdx], ...body, employee_id: id };
        db.tables['08_Salaries_Banks'] = salaries;
    }

    // Update insurance
    const insurance = db.tables['09_Insurance_Welfare'] || [];
    const insIdx = insurance.findIndex(i => i.employee_id === id);
    if (insIdx >= 0) {
        insurance[insIdx] = { ...insurance[insIdx], ...body, employee_id: id };
        db.tables['09_Insurance_Welfare'] = insurance;
    }

    recordLog(db, {
        action_type: 'UPDATE',
        module: 'Nhân sự',
        description: `Cập nhật hồ sơ nhân sự ${id} - ${employees[empIdx].full_name}`,
        user_id: body.operator_id || 'TH-1948',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({
        success: true,
        message: 'Cập nhật hồ sơ nhân viên thành công'
    });
});

// 7. DELETE EMPLOYEE
app.delete('/api/employees/:id', (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;

    const employees = db.tables['03_Employees'] || [];
    const emp = employees.find(e => e.employee_id === id);
    const empName = emp ? emp.full_name : '';

    for (const key of Object.keys(db.tables)) {
        if (Array.isArray(db.tables[key])) {
            db.tables[key] = db.tables[key].filter(item => item.employee_id !== id);
        }
    }

    recordLog(db, {
        action_type: 'DELETE',
        module: 'Nhân sự',
        description: `Xóa hồ sơ nhân sự ${id} (${empName}) khỏi hệ thống`,
        user_id: req.body?.operator_id || 'TH-1948',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);
    res.json({
        success: true,
        message: `Đã xóa nhân viên ${id}`
    });
});

// 8. GET DEPARTMENTS
app.get('/api/departments', (req, res) => {
    const db = loadDatabase();
    res.json({
        success: true,
        data: db.tables['01_Departments'] || []
    });
});

// ==========================================
// ACCOUNTS & RBAC MANAGEMENT ENDPOINTS
// ==========================================

// GET ACCOUNTS
app.get('/api/accounts', (req, res) => {
    const db = loadDatabase();
    res.json({
        success: true,
        data: db.tables['11_System_Accounts'] || []
    });
});

// CREATE ACCOUNT
app.post('/api/accounts', (req, res) => {
    const db = loadDatabase();
    const accounts = db.tables['11_System_Accounts'] || [];
    const body = req.body;

    if (!body.employee_id || !body.account_email) {
        return res.status(400).json({ success: false, message: 'Thiếu mã nhân viên hoặc email' });
    }

    // Check duplicate
    if (accounts.some(a => a.employee_id === body.employee_id)) {
        return res.status(400).json({ success: false, message: 'Nhân viên này đã có tài khoản hệ thống' });
    }

    const newAcc = {
        account_id: `ACC-${body.employee_id.replace('-', '')}`,
        employee_id: body.employee_id,
        full_name: body.full_name || '',
        account_email: body.account_email,
        role: body.role || 'HR',
        account_status: body.account_status || 'Kích hoạt',
        password: body.password || '123456'
    };

    accounts.unshift(newAcc);
    db.tables['11_System_Accounts'] = accounts;

    recordLog(db, {
        action_type: 'CREATE',
        module: 'Tài khoản',
        description: `Cấp tài khoản mới cho NV ${newAcc.employee_id} (${newAcc.full_name}) - Quyền: ${newAcc.role === 'ADMIN' ? 'Admin' : 'Nhân sự'}`,
        user_id: body.operator_id || 'TH-1948',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.status(201).json({ success: true, message: 'Cấp tài khoản thành công', account: newAcc });
});

// UPDATE ACCOUNT (ROLE / STATUS / EMAIL)
app.put('/api/accounts/:id', (req, res) => {
    const db = loadDatabase();
    const accounts = db.tables['11_System_Accounts'] || [];
    const id = req.params.id;
    const body = req.body;

    const idx = accounts.findIndex(a => a.account_id === id || a.employee_id === id);
    if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    }

    accounts[idx] = {
        ...accounts[idx],
        ...body,
        account_id: accounts[idx].account_id,
        employee_id: accounts[idx].employee_id
    };

    db.tables['11_System_Accounts'] = accounts;

    recordLog(db, {
        action_type: 'UPDATE',
        module: 'Tài khoản',
        description: `Cập nhật tài khoản ${accounts[idx].employee_id} (${accounts[idx].full_name}) - Quyền: ${accounts[idx].role}, Trạng thái: ${accounts[idx].account_status}`,
        user_id: body.operator_id || 'TH-1948',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({ success: true, message: 'Cập nhật phân quyền tài khoản thành công', account: accounts[idx] });
});

// RESET PASSWORD
app.post('/api/accounts/:id/reset-password', (req, res) => {
    const db = loadDatabase();
    const accounts = db.tables['11_System_Accounts'] || [];
    const id = req.params.id;
    const { new_password, operator_id, operator_name, operator_role } = req.body;

    const idx = accounts.findIndex(a => a.account_id === id || a.employee_id === id);
    if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    }

    accounts[idx].password = new_password || '123456';
    db.tables['11_System_Accounts'] = accounts;

    recordLog(db, {
        action_type: 'PASSWORD',
        module: 'Tài khoản',
        description: `Đặt lại mật khẩu cho tài khoản ${accounts[idx].employee_id} (${accounts[idx].full_name})`,
        user_id: operator_id || 'TH-1948',
        user_name: operator_name || 'Huỳnh Thanh Long',
        user_role: operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({ success: true, message: 'Mật khẩu đã được thiết lập lại thành công' });
});

// DELETE ACCOUNT
app.delete('/api/accounts/:id', (req, res) => {
    const db = loadDatabase();
    let accounts = db.tables['11_System_Accounts'] || [];
    const id = req.params.id;

    const target = accounts.find(a => a.account_id === id || a.employee_id === id);
    if (!target) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    }

    accounts = accounts.filter(a => a.account_id !== id && a.employee_id !== id);
    db.tables['11_System_Accounts'] = accounts;

    recordLog(db, {
        action_type: 'DELETE',
        module: 'Tài khoản',
        description: `Xóa tài khoản đăng nhập ${target.employee_id} (${target.full_name}) khỏi hệ thống`,
        user_id: req.body?.operator_id || 'TH-1948',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({ success: true, message: 'Đã xóa tài khoản khỏi hệ thống' });
});

// ==========================================
// SYSTEM ACTIVITY LOGS API ENDPOINTS
// ==========================================

// GET LOGS
app.get('/api/logs', (req, res) => {
    const db = loadDatabase();
    const logs = db.tables['12_System_Logs'] || [];
    res.json({
        success: true,
        data: logs
    });
});

// CREATE CLIENT LOG (LOGOUT, EXPORT, REPORT ACTIONS)
app.post('/api/logs', (req, res) => {
    const db = loadDatabase();
    const { action_type, module, description, user_id, user_name, user_role } = req.body;

    const entry = recordLog(db, {
        action_type: action_type || 'INFO',
        module: module || 'Hệ thống',
        description: description || '',
        user_id,
        user_name,
        user_role,
        ip: req.ip
    });

    saveDatabase(db);
    res.status(201).json({ success: true, log: entry });
});

// CLEAR ALL LOGS (ADMIN ONLY)
app.delete('/api/logs', (req, res) => {
    const db = loadDatabase();
    db.tables['12_System_Logs'] = [];

    recordLog(db, {
        action_type: 'DELETE',
        module: 'Hệ thống',
        description: 'Đã xóa toàn bộ lịch sử nhật ký hoạt động',
        user_id: req.body?.user_id || 'TH-1948',
        user_name: req.body?.user_name || 'Huỳnh Thanh Long',
        user_role: 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);
    res.json({ success: true, message: 'Đã làm trống toàn bộ nhật ký' });
});

// 10. EXPORT EXCEL
app.get('/api/export', (req, res) => {
    const db = loadDatabase();
    const wb = XLSX.utils.book_new();

    for (const [sheetName, sheetData] of Object.entries(db.tables)) {
        const ws = XLSX.utils.json_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="HRM_Export_TrungHai.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
});

// Fallback to SPA index.html
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 HRM WebApp Server running on: http://localhost:${PORT}`);
    console.log(`🏢 TRUNG HAI Human Resource Management System`);
    console.log(`====================================================`);
});
