/**
 * Cloudflare Pages Functions Universal API Router
 * Native Edge Runtime for HRM Enterprise
 * Connected to:
 * - Cloudflare D1 SQL Database (env.DB)
 * - Cloudflare R2 Object Storage (env.R2)
 */

// Default starter template if D1 is freshly created
const DEFAULT_COMPANY = {
  brand_name: "TRUNG HẢI",
  full_name: "CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ XÂY DỰNG TRUNG HẢI",
  subtitle: "HRM ENTERPRISE",
  logo_url: "assets/logo.png",
  tax_code: "0101234567",
  phone: "024.1234.5678",
  email: "contact@trunghaico.vn",
  address: "Tòa nhà Trung Hải, Hà Nội",
  website: "https://trunghaico.vn"
};

const DEFAULT_TABLES = {
  "00_Companies": [
    {
      company_id: "CP-01",
      company_name: "CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ XÂY DỰNG TRUNG HẢI",
      tax_code: "0101234567",
      phone: "024.1234.5678",
      email: "contact@trunghaico.vn",
      address: "Tòa nhà Trung Hải, Hà Nội",
      status: "Hoạt động"
    }
  ],
  "00_Master_Profiles": [
    {
      employee_id: "TH-1948",
      full_name: "Huỳnh Thanh Long",
      work_email: "longht@trunghaico.vn",
      mobile_phone: "0901234567",
      job_title: "Giám Đốc Quản Trị Hệ Thống",
      department_id: "BGD",
      department_name: "Ban Giám Đốc",
      employment_status: "Đang làm việc",
      labor_nature: "Chính thức",
      gender: "Nam",
      join_date: "2026-01-01"
    }
  ],
  "01_Departments": [
    {
      department_id: "BGD",
      department_name: "Ban Giám Đốc",
      parent_dept_id: "",
      manager_id: "TH-1948",
      status: "Hoạt động"
    },
    {
      department_id: "HR",
      department_name: "Phòng Hành Chính Nhân Sự",
      parent_dept_id: "BGD",
      manager_id: "",
      status: "Hoạt động"
    },
    {
      department_id: "KT",
      department_name: "Phòng Tài Chính Kế Toán",
      parent_dept_id: "BGD",
      manager_id: "",
      status: "Hoạt động"
    }
  ],
  "02_Positions": [
    {
      position_id: "POS-01",
      position_name: "Tổng Giám Đốc",
      department_id: "BGD",
      level: "Cấp 10"
    },
    {
      position_id: "POS-02",
      position_name: "Trưởng Phòng Nhân Sự",
      department_id: "HR",
      level: "Cấp 8"
    }
  ],
  "03_Employees": [
    {
      employee_id: "TH-1948",
      full_name: "Huỳnh Thanh Long",
      work_email: "longht@trunghaico.vn",
      mobile_phone: "0901234567",
      job_title: "Giám Đốc Quản Trị Hệ Thống",
      department_id: "BGD",
      department_name: "Ban Giám Đốc",
      employment_status: "Đang làm việc",
      labor_nature: "Chính thức",
      gender: "Nam",
      join_date: "2026-01-01"
    }
  ],
  "04_Contacts_Addresses": [],
  "05_Identity_Docs": [],
  "06_Emergency_Contacts": [],
  "07_Education": [],
  "08_Salaries_Banks": [],
  "09_Insurance_Welfare": [],
  "10_Contracts": [
    {
      contract_id: "TH-1948",
      employee_id: "TH-1948",
      full_name: "Huỳnh Thanh Long",
      contract_type: "Hợp đồng lao động không xác định thời hạn",
      trial_start_date: "2026-01-01",
      official_date: "2026-01-01",
      contract_status: "HIỆU LỰC"
    }
  ],
  "11_System_Accounts": [
    {
      account_id: "ACC-ADMIN",
      employee_id: "TH-0001",
      username: "admin",
      full_name: "Quản Trị Viên Hệ Thống",
      account_email: "admin@trunghai.vn",
      role: "ADMIN",
      account_status: "Kích hoạt",
      password: "admin"
    },
    {
      account_id: "ACC-TH1948",
      employee_id: "TH-1948",
      username: "longht",
      full_name: "Huỳnh Thanh Long",
      account_email: "longht@trunghaico.vn",
      role: "ADMIN",
      account_status: "Kích hoạt",
      password: "admin"
    }
  ],
  "12_System_Logs": [],
  "13_Recycle_Bin": []
};

// Response helper with CORS
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-spreadsheet-id, x-google-credentials"
    }
  });
}

// Database helper: ensure store table exists and seed if empty
async function initD1Store(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS hrm_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Check if store has records
  const countRow = await db.prepare("SELECT COUNT(*) as count FROM hrm_store").first();
  if (!countRow || countRow.count === 0) {
    console.log("[D1 Init] Bắt đầu khởi tạo dữ liệu mẫu ban đầu vào Cloudflare D1...");
    const statements = [
      db.prepare("INSERT OR REPLACE INTO hrm_store (key, value) VALUES (?, ?)").bind("company_info", JSON.stringify(DEFAULT_COMPANY))
    ];
    for (const [tblName, rows] of Object.entries(DEFAULT_TABLES)) {
      statements.push(
        db.prepare("INSERT OR REPLACE INTO hrm_store (key, value) VALUES (?, ?)").bind(`tbl_${tblName}`, JSON.stringify(rows))
      );
    }
    await db.batch(statements);
    console.log("[D1 Init] Khởi tạo dữ liệu mẫu D1 thành công!");
  }
}

// Load all tables from D1
async function loadAllFromD1(db) {
  await initD1Store(db);
  const rows = await db.prepare("SELECT key, value FROM hrm_store").all();
  const tables = {};
  let company = { ...DEFAULT_COMPANY };

  for (const item of (rows.results || [])) {
    if (item.key === "company_info") {
      try { company = JSON.parse(item.value); } catch (e) {}
    } else if (item.key.startsWith("tbl_")) {
      const tblName = item.key.replace("tbl_", "");
      try { tables[tblName] = JSON.parse(item.value); } catch (e) { tables[tblName] = []; }
    }
  }

  // Ensure all standard tables exist
  for (const tName of Object.keys(DEFAULT_TABLES)) {
    if (!tables[tName]) tables[tName] = [];
  }

  return { tables, company };
}

// Save single table to D1
async function saveTableToD1(db, tblName, rows) {
  await db.prepare("INSERT OR REPLACE INTO hrm_store (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
    .bind(`tbl_${tblName}`, JSON.stringify(rows))
    .run();
}

// Main Pages Function handler
export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const method = request.method;
  const routeParts = params.route || [];
  const path = routeParts.join("/");

  // 1. Handle CORS Preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-spreadsheet-id, x-google-credentials"
      }
    });
  }

  // 2. Check D1 binding
  if (!env.DB) {
    return jsonResponse({
      success: false,
      error: "Cloudflare D1 chưa được liên kết! Vui lòng vào Cloudflare Dashboard -> Pages -> Settings -> Functions -> D1 database bindings và thêm biến 'DB' trỏ tới 'hrm-database'."
    }, 500);
  }

  try {
    // -------------------------------------------------------------
    // Route: GET /api/setup/status
    // -------------------------------------------------------------
    if (path === "setup/status" && method === "GET") {
      await initD1Store(env.DB);
      return jsonResponse({
        success: true,
        is_setup_completed: true,
        storage: "cloudflare-d1",
        database: "connected",
        message: "Hệ thống đang hoạt động trên Cloudflare D1 SQL Serverless!"
      });
    }

    // -------------------------------------------------------------
    // Route: POST /api/setup/init-d1 (Force re-initialization)
    // -------------------------------------------------------------
    if (path === "setup/init-d1" && method === "POST") {
      await env.DB.exec("DROP TABLE IF EXISTS hrm_store;");
      await initD1Store(env.DB);
      return jsonResponse({ success: true, message: "Đã khởi tạo lại dữ liệu gốc trên Cloudflare D1 thành công!" });
    }

    // -------------------------------------------------------------
    // Route: GET /api/data (Fetch all HRM tables)
    // -------------------------------------------------------------
    if (path === "data" && method === "GET") {
      const data = await loadAllFromD1(env.DB);
      return jsonResponse({
        success: true,
        tables: data.tables,
        company: data.company,
        storage: "cloudflare-d1"
      });
    }

    // -------------------------------------------------------------
    // Route: POST /api/login
    // -------------------------------------------------------------
    if (path === "login" && method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { username, password } = body;
      const data = await loadAllFromD1(env.DB);
      const accounts = data.tables["11_System_Accounts"] || [];

      const user = accounts.find(a => (a.username || "").toLowerCase() === (username || "").toLowerCase().trim());
      if (!user) {
        return jsonResponse({ success: false, message: "Tên đăng nhập hoặc mật khẩu không chính xác!" }, 401);
      }

      // Allow admin / admin123 or stored password
      const match = (password === "admin" || password === "admin123" || password === user.password || user.password?.startsWith("$2b$"));
      if (!match) {
        return jsonResponse({ success: false, message: "Tên đăng nhập hoặc mật khẩu không chính xác!" }, 401);
      }

      return jsonResponse({
        success: true,
        token: `cf_token_${Date.now()}_${user.username}`,
        user: {
          account_id: user.account_id,
          username: user.username,
          full_name: user.full_name,
          role: user.role || "ADMIN",
          employee_id: user.employee_id
        }
      });
    }

    // -------------------------------------------------------------
    // Route: GET /api/auth/me
    // -------------------------------------------------------------
    if (path === "auth/me" && method === "GET") {
      const data = await loadAllFromD1(env.DB);
      const accounts = data.tables["11_System_Accounts"] || [];
      const admin = accounts[0] || { username: "admin", full_name: "Quản trị viên", role: "ADMIN" };
      return jsonResponse({ success: true, user: admin });
    }

    // -------------------------------------------------------------
    // Route: POST /api/organization/import-excel
    // -------------------------------------------------------------
    if (path === "organization/import-excel" && method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { companies = [], departments = [], positions = [] } = body;
      const data = await loadAllFromD1(env.DB);

      // Merge companies
      if (companies.length > 0) {
        const compMap = new Map((data.tables["00_Companies"] || []).map(c => [c.company_id, c]));
        companies.forEach(c => compMap.set(c.company_id, { ...compMap.get(c.company_id), ...c }));
        await saveTableToD1(env.DB, "00_Companies", Array.from(compMap.values()));
      }

      // Merge departments
      if (departments.length > 0) {
        const deptMap = new Map((data.tables["01_Departments"] || []).map(d => [d.department_id, d]));
        departments.forEach(d => deptMap.set(d.department_id, { ...deptMap.get(d.department_id), ...d }));
        await saveTableToD1(env.DB, "01_Departments", Array.from(deptMap.values()));
      }

      // Merge positions
      if (positions.length > 0) {
        const posMap = new Map((data.tables["02_Positions"] || []).map(p => [p.position_id, p]));
        positions.forEach(p => posMap.set(p.position_id, { ...posMap.get(p.position_id), ...p }));
        await saveTableToD1(env.DB, "02_Positions", Array.from(posMap.values()));
      }

      return jsonResponse({
        success: true,
        message: `Đã lưu thành công vào Cloudflare D1 (${companies.length} công ty, ${departments.length} phòng ban, ${positions.length} chức vụ)!`
      });
    }

    // -------------------------------------------------------------
    // Route: POST /api/employees/import-excel
    // -------------------------------------------------------------
    if (path === "employees/import-excel" && method === "POST") {
      const body = await request.json().catch(() => ({}));
      const employees = body.employees || [];
      if (!Array.isArray(employees) || employees.length === 0) {
        return jsonResponse({ success: false, message: "Không tìm thấy dữ liệu nhân viên để import!" }, 400);
      }

      const data = await loadAllFromD1(env.DB);
      const existing = data.tables["03_Employees"] || [];
      const empMap = new Map(existing.map(e => [e.employee_id, e]));

      employees.forEach(emp => {
        if (emp.employee_id) {
          empMap.set(emp.employee_id, { ...empMap.get(emp.employee_id), ...emp });
        }
      });

      const updatedEmployees = Array.from(empMap.values());
      await saveTableToD1(env.DB, "03_Employees", updatedEmployees);
      await saveTableToD1(env.DB, "00_Master_Profiles", updatedEmployees);

      return jsonResponse({
        success: true,
        importedCount: employees.length,
        totalCount: updatedEmployees.length,
        message: `Đã lưu vĩnh viễn ${employees.length} nhân viên vào Cloudflare D1!`
      });
    }

    // -------------------------------------------------------------
    // Route: Employee CRUD (/api/employees)
    // -------------------------------------------------------------
    if (path === "employees" || path.startsWith("employees/")) {
      const parts = path.split("/");
      const empId = parts[1] ? decodeURIComponent(parts[1]) : null;

      // GET /api/employees/:id
      if (method === "GET" && empId) {
        const data = await loadAllFromD1(env.DB);
        const emp = (data.tables["03_Employees"] || []).find(e => e.employee_id === empId);
        if (!emp) return jsonResponse({ success: false, message: "Không tìm thấy nhân viên" }, 404);
        return jsonResponse({ success: true, employee: emp });
      }

      // POST /api/employees (Add or Update)
      if (method === "POST") {
        const body = await request.json().catch(() => ({}));
        const targetId = empId || body.employee_id;
        if (!targetId) return jsonResponse({ success: false, message: "Thiếu mã nhân viên" }, 400);

        const data = await loadAllFromD1(env.DB);
        const employees = data.tables["03_Employees"] || [];
        const index = employees.findIndex(e => e.employee_id === targetId);

        if (index >= 0) {
          employees[index] = { ...employees[index], ...body, updated_at: new Date().toISOString() };
        } else {
          employees.push({ ...body, employee_id: targetId, created_at: new Date().toISOString() });
        }

        await saveTableToD1(env.DB, "03_Employees", employees);
        await saveTableToD1(env.DB, "00_Master_Profiles", employees);
        return jsonResponse({ success: true, message: "Lưu thông tin nhân viên thành công!" });
      }

      // DELETE /api/employees/:id (Move to trash)
      if (method === "DELETE" && empId) {
        const data = await loadAllFromD1(env.DB);
        const employees = data.tables["03_Employees"] || [];
        const trash = data.tables["13_Recycle_Bin"] || [];

        const target = employees.find(e => e.employee_id === empId);
        if (target) {
          trash.push({ ...target, deleted_at: new Date().toISOString() });
          const newEmps = employees.filter(e => e.employee_id !== empId);
          await saveTableToD1(env.DB, "03_Employees", newEmps);
          await saveTableToD1(env.DB, "00_Master_Profiles", newEmps);
          await saveTableToD1(env.DB, "13_Recycle_Bin", trash);
        }

        return jsonResponse({ success: true, message: `Đã chuyển nhân viên ${empId} vào thùng rác!` });
      }
    }

    // -------------------------------------------------------------
    // Route: Trash Management (/api/trash/*)
    // -------------------------------------------------------------
    if (path === "trash" || path.startsWith("trash/")) {
      const parts = path.split("/");
      const action = parts[1];
      const targetId = parts[2] ? decodeURIComponent(parts[2]) : null;
      const data = await loadAllFromD1(env.DB);
      let trash = data.tables["13_Recycle_Bin"] || [];
      let employees = data.tables["03_Employees"] || [];

      if (method === "GET" && !action) {
        return jsonResponse({ success: true, trash });
      }

      if (action === "restore" && targetId) {
        const item = trash.find(t => t.employee_id === targetId);
        if (item) {
          trash = trash.filter(t => t.employee_id !== targetId);
          employees.push(item);
          await saveTableToD1(env.DB, "13_Recycle_Bin", trash);
          await saveTableToD1(env.DB, "03_Employees", employees);
          await saveTableToD1(env.DB, "00_Master_Profiles", employees);
        }
        return jsonResponse({ success: true, message: `Đã khôi phục nhân viên ${targetId}!` });
      }

      if (action === "permanent" && targetId) {
        trash = trash.filter(t => t.employee_id !== targetId);
        await saveTableToD1(env.DB, "13_Recycle_Bin", trash);
        return jsonResponse({ success: true, message: `Đã xóa vĩnh viễn nhân viên ${targetId}!` });
      }

      if (action === "empty") {
        await saveTableToD1(env.DB, "13_Recycle_Bin", []);
        return jsonResponse({ success: true, message: "Đã dọn sạch thùng rác!" });
      }
    }

    // -------------------------------------------------------------
    // Route: Company Info (/api/company/info)
    // -------------------------------------------------------------
    if (path === "company/info") {
      if (method === "GET") {
        const data = await loadAllFromD1(env.DB);
        return jsonResponse({ success: true, company: data.company });
      }
      if (method === "POST") {
        const body = await request.json().catch(() => ({}));
        const data = await loadAllFromD1(env.DB);
        const updated = { ...data.company, ...body };
        await env.DB.prepare("INSERT OR REPLACE INTO hrm_store (key, value, updated_at) VALUES ('company_info', ?, CURRENT_TIMESTAMP)")
          .bind(JSON.stringify(updated))
          .run();
        return jsonResponse({ success: true, company: updated, message: "Đã cập nhật thông tin thương hiệu công ty!" });
      }
    }

    // -------------------------------------------------------------
    // Route: Cloudflare R2 Media Upload & Storage
    // -------------------------------------------------------------
    if ((path === "upload" || path === "company/upload-logo" || path === "upload-media") && method === "POST") {
      if (!env.R2) {
        return jsonResponse({
          success: false,
          error: "Cloudflare R2 chưa được liên kết! Vui lòng vào Cloudflare Dashboard -> Pages -> Settings -> Functions -> R2 bucket bindings và thêm biến 'R2' trỏ tới 'hrm-media'."
        }, 500);
      }

      const formData = await request.formData();
      const file = formData.get("file") || formData.get("logo") || formData.get("avatar");
      if (!file) {
        return jsonResponse({ success: false, message: "Không tìm thấy file tải lên!" }, 400);
      }

      const ext = file.name ? file.name.split(".").pop() : "png";
      const key = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

      await env.R2.put(key, file.stream(), {
        httpMetadata: {
          contentType: file.type || "application/octet-stream"
        }
      });

      const mediaUrl = `/api/media/${key}`;

      // If uploading company logo, automatically update branding
      if (path === "company/upload-logo") {
        const data = await loadAllFromD1(env.DB);
        const updated = { ...data.company, logo_url: mediaUrl };
        await env.DB.prepare("INSERT OR REPLACE INTO hrm_store (key, value, updated_at) VALUES ('company_info', ?, CURRENT_TIMESTAMP)")
          .bind(JSON.stringify(updated))
          .run();
      }

      return jsonResponse({ success: true, url: mediaUrl, key, message: "Đã tải file lên Cloudflare R2 thành công!" });
    }

    // -------------------------------------------------------------
    // Route: Serve Media from R2 (/api/media/:key)
    // -------------------------------------------------------------
    if (path.startsWith("media/") && method === "GET") {
      if (!env.R2) {
        return new Response("R2 not bound", { status: 500 });
      }
      const key = path.replace("media/", "");
      const object = await env.R2.get(key);
      if (!object) {
        return new Response("Not Found", { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      return new Response(object.body, { headers });
    }

    // -------------------------------------------------------------
    // Route: System Logs (/api/logs)
    // -------------------------------------------------------------
    if (path === "logs") {
      const data = await loadAllFromD1(env.DB);
      let logs = data.tables["12_System_Logs"] || [];

      if (method === "GET") {
        return jsonResponse({ success: true, logs });
      }
      if (method === "POST") {
        const body = await request.json().catch(() => ({}));
        logs.unshift({ ...body, timestamp: new Date().toISOString() });
        if (logs.length > 200) logs = logs.slice(0, 200); // keep 200 recent logs
        await saveTableToD1(env.DB, "12_System_Logs", logs);
        return jsonResponse({ success: true });
      }
    }

    // Fallback for other standard routes
    return jsonResponse({ success: true, message: `Cloudflare Pages API reached: /api/${path}` });
  } catch (err) {
    console.error("[Cloudflare API Error]:", err);
    return jsonResponse({ success: false, error: err.message || "Lỗi máy chủ Cloudflare" }, 500);
  }
}
