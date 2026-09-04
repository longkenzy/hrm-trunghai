const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'sheets.config.json');
const TMP_CONFIG_PATH = path.join(os.tmpdir(), 'sheets.config.json');
const TMP_KEY_PATH = path.join(os.tmpdir(), 'service-account.json');

let inMemoryConfig = null;
let inMemoryCredentials = null;

// Helper to set credentials directly in memory
function setCredentials(creds) {
    if (!creds) return;
    inMemoryCredentials = typeof creds === 'string' ? JSON.parse(creds) : creds;
    try {
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(inMemoryCredentials);
    } catch (e) {}
}

// Helper to get config
function getConfig() {
    let baseConfig = {
        keyFilePath: './make-472708-52c73f3ee34b.json',
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '',
        autoSyncOnSave: true
    };

    // 1. Read from static config file if exists
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const fileCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            baseConfig = { ...baseConfig, ...fileCfg };
        }
    } catch (e) {}

    // 2. Read from /tmp config (for Serverless / Vercel)
    try {
        if (fs.existsSync(TMP_CONFIG_PATH)) {
            const tmpCfg = JSON.parse(fs.readFileSync(TMP_CONFIG_PATH, 'utf-8'));
            baseConfig = { ...baseConfig, ...tmpCfg };
        }
    } catch (e) {}

    // 3. Merge in-memory updates
    if (inMemoryConfig) {
        baseConfig = { ...baseConfig, ...inMemoryConfig };
    }

    if (process.env.GOOGLE_SPREADSHEET_ID) {
        baseConfig.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    }

    return baseConfig;
}

// Helper to save config (Serverless-safe with /tmp and in-memory fallback)
function saveConfig(cfg) {
    const current = getConfig();
    const updated = { ...current, ...cfg };
    inMemoryConfig = updated;

    let savedOnDisk = false;
    // Try writing to normal config folder
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
        savedOnDisk = true;
    } catch (e) {
        // Fallback to /tmp in read-only / serverless environment (Vercel)
        try {
            fs.writeFileSync(TMP_CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
            savedOnDisk = true;
        } catch (tmpErr) {
            console.warn('⚠️ Không thể ghi cấu hình sheets vào ổ đĩa:', tmpErr.message);
        }
    }

    return true;
}

// Get Google Sheets API Client (Checks customCredentials, in-memory, env var, /tmp, then local disk)
function getSheetsClient(customCredentials) {
    // 0. Check customCredentials passed directly from request header / caller
    if (customCredentials) {
        try {
            const credentials = typeof customCredentials === 'string' ? JSON.parse(customCredentials) : customCredentials;
            const auth = new google.auth.GoogleAuth({
                credentials,
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive'
                ]
            });
            return google.sheets({ version: 'v4', auth });
        } catch (e) {
            console.error('Error parsing custom credentials:', e.message);
        }
    }

    // 1. Check for in-memory credentials first
    if (inMemoryCredentials) {
        const auth = new google.auth.GoogleAuth({
            credentials: inMemoryCredentials,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive'
            ]
        });
        return google.sheets({ version: 'v4', auth });
    }

    // 2. Check for Cloud / Vercel Environment Variable
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        try {
            const credentials = typeof process.env.GOOGLE_SERVICE_ACCOUNT_JSON === 'string'
                ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
                : process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

            const auth = new google.auth.GoogleAuth({
                credentials,
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive'
                ]
            });
            return google.sheets({ version: 'v4', auth });
        } catch (err) {
            console.error('Error parsing GOOGLE_SERVICE_ACCOUNT_JSON env var:', err.message);
        }
    }

    // 3. Check for /tmp/service-account.json
    if (fs.existsSync(TMP_KEY_PATH)) {
        const auth = new google.auth.GoogleAuth({
            keyFile: TMP_KEY_PATH,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive'
            ]
        });
        return google.sheets({ version: 'v4', auth });
    }

    // 4. Check for local key file on disk
    const cfg = getConfig();
    let keyFile = cfg.keyFilePath;
    if (!path.isAbsolute(keyFile)) {
        keyFile = path.join(__dirname, '..', keyFile);
    }

    if (!fs.existsSync(keyFile)) {
        throw new Error(`Khóa Service Account không tìm thấy trên hệ thống. Vui lòng thiết lập biến môi trường GOOGLE_SERVICE_ACCOUNT_JSON trên Vercel hoặc tải file key qua giao diện cài đặt.`);
    }

    const auth = new google.auth.GoogleAuth({
        keyFile,
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ]
    });

    return google.sheets({ version: 'v4', auth });
}

// Test connection to Google Spreadsheet
async function testConnection(customSpreadsheetId) {
    const cfg = getConfig();
    const spreadsheetId = (customSpreadsheetId !== undefined ? customSpreadsheetId : cfg.spreadsheetId) || '';
    if (!spreadsheetId.trim()) {
        return { success: false, message: 'Chưa cấu hình Google Spreadsheet ID' };
    }

    try {
        const sheets = getSheetsClient();
        const res = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetList = (res.data.sheets || []).map(s => s.properties.title);
        return {
            success: true,
            title: res.data.properties.title,
            spreadsheetId,
            sheets: sheetList,
            message: `Đã kết nối thành công tới "${res.data.properties.title}" (${sheetList.length} tabs)`
        };
    } catch (e) {
        return {
            success: false,
            spreadsheetId,
            error: e.message,
            message: e.message.includes('not supported for this document')
                ? 'File hiện tại là định dạng Excel (.xlsx). Vui lòng vào Tệp > "Lưu dưới dạng Google Trang tính" trên Google Drive và dùng ID của file Google Trang tính mới.'
                : e.message.includes('The caller does not have permission') || e.message.includes('not found')
                ? 'Không tìm thấy file hoặc chưa cấp quyền chia sẻ (Editor) cho Service Account email.'
                : e.message
        };
    }
}

// Test connection to Google Spreadsheet with custom credentials
async function testConnectionWithCredentials(credentials, spreadsheetId) {
    if (!spreadsheetId || !spreadsheetId.trim()) {
        return { success: false, message: 'Chưa cung cấp Google Spreadsheet ID' };
    }
    if (!credentials) {
        return { success: false, message: 'Chưa cung cấp Service Account JSON' };
    }

    try {
        const parsedCreds = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
        const auth = new google.auth.GoogleAuth({
            credentials: parsedCreds,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive'
            ]
        });
        const sheets = google.sheets({ version: 'v4', auth });
        const res = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId.trim() });
        const sheetList = (res.data.sheets || []).map(s => s.properties.title);
        return {
            success: true,
            title: res.data.properties.title,
            spreadsheetId: spreadsheetId.trim(),
            sheets: sheetList,
            clientEmail: parsedCreds.client_email,
            projectId: parsedCreds.project_id,
            message: `Kết nối thành công tới trang tính "${res.data.properties.title}" (${sheetList.length} tabs)`
        };
    } catch (e) {
        return {
            success: false,
            spreadsheetId,
            error: e.message,
            message: e.message.includes('not supported for this document')
                ? 'File hiện tại là định dạng Excel (.xlsx). Vui lòng vào Tệp > "Lưu dưới dạng Google Trang tính" trên Google Drive và dùng ID của file Google Trang tính mới.'
                : e.message.includes('The caller does not have permission') || e.message.includes('not found')
                ? 'Không tìm thấy file hoặc chưa cấp quyền chia sẻ (Editor) cho Service Account email.'
                : e.message
        };
    }
}

// Ensure all required sheets exist in spreadsheet
async function ensureSheets(sheets, spreadsheetId, requiredNames) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingTitles = (meta.data.sheets || []).map(s => s.properties.title);
    
    const missing = requiredNames.filter(name => !existingTitles.includes(name));
    if (missing.length > 0) {
        const requests = missing.map(title => ({
            addSheet: {
                properties: { title: title.substring(0, 50) }
            }
        }));
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests }
        });
        console.log(`[Google Sheets] Đã tạo mới ${missing.length} tab thiếu:`, missing);
    }
}

// Export a single table to Google Sheet
async function exportTableToGoogleSheets(tableName, rows, customSpreadsheetId, customCredentials = null) {
    const cfg = getConfig();
    const spreadsheetId = customSpreadsheetId || cfg.spreadsheetId;
    if (!spreadsheetId) return false;

    const sheets = getSheetsClient(customCredentials);
    await ensureSheets(sheets, spreadsheetId, [tableName]);

    let headers = [];
    if (rows && rows.length > 0) {
        headers = Object.keys(rows[0]);
    } else {
        headers = ['id', 'status', 'note'];
    }

    const values = [
        headers,
        ...rows.map(row => headers.map(h => {
            const val = row[h];
            if (val === undefined || val === null) return '';
            if (typeof val === 'object') return JSON.stringify(val);
            return val;
        }))
    ];

    // Clear old data
    try {
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `'${tableName}'!A1:ZZ50000`
        });
    } catch (e) {}

    // Write new data
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${tableName}'!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values }
    });

    return true;
}

// Export ALL tables from local DB to Google Sheets using atomic batchUpdate (super fast & reliable)
async function exportAllToGoogleSheets(db, customSpreadsheetId, customCredentials) {
    const cfg = getConfig();
    const spreadsheetId = customSpreadsheetId || cfg.spreadsheetId;
    if (!spreadsheetId) {
        throw new Error('Chưa cấu hình Spreadsheet ID');
    }

    const sheets = getSheetsClient(customCredentials);
    const tableNames = Object.keys(db.tables || {});
    if (tableNames.length === 0) return { success: true };

    await ensureSheets(sheets, spreadsheetId, tableNames);

    console.log(`[Google Sheets] Bắt đầu đồng bộ batch ${tableNames.length} bảng lên Google Sheets...`);

    // 1. Batch clear all table ranges in single HTTP request
    try {
        await sheets.spreadsheets.values.batchClear({
            spreadsheetId,
            requestBody: {
                ranges: tableNames.map(name => `'${name}'!A1:ZZ50000`)
            }
        });
    } catch (clearErr) {
        console.warn('[Google Sheets] Batch clear warning:', clearErr.message);
    }

    // 2. Prepare batch data for all tables
    const batchData = [];
    for (const tableName of tableNames) {
        const rows = db.tables[tableName] || [];
        let headers = [];
        if (rows && rows.length > 0) {
            headers = Object.keys(rows[0]);
        } else {
            headers = ['id', 'status', 'note'];
        }

        const values = [
            headers,
            ...rows.map(row => headers.map(h => {
                const val = row[h];
                if (val === undefined || val === null) return '';
                if (typeof val === 'object') return JSON.stringify(val);
                return val;
            }))
        ];

        batchData.push({
            range: `'${tableName}'!A1`,
            values
        });
    }

    // 3. Batch write all tables in single HTTP request
    await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: batchData
        }
    });

    console.log(`[Google Sheets] Đồng bộ batch thành công toàn bộ ${tableNames.length} bảng lên Google Sheets.`);
    return { success: true, count: tableNames.length };
}

// Import ALL tables from Google Sheets into local format (Optimized with batchGet)
async function importAllFromGoogleSheets(customSpreadsheetId, customCredentials) {
    const cfg = getConfig();
    const spreadsheetId = customSpreadsheetId || cfg.spreadsheetId;
    if (!spreadsheetId) {
        throw new Error('Chưa cấu hình Spreadsheet ID');
    }

    const sheets = getSheetsClient(customCredentials);
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetTitles = (meta.data.sheets || []).map(s => s.properties.title);
    if (sheetTitles.length === 0) {
        return { tables: {} };
    }

    const tables = {};

    try {
        // Fast single batchGet request for all sheets
        const batchRes = await sheets.spreadsheets.values.batchGet({
            spreadsheetId,
            ranges: sheetTitles.map(title => `'${title}'!A1:ZZ50000`),
            valueRenderOption: 'UNFORMATTED_VALUE'
        });

        const valueRanges = batchRes.data.valueRanges || [];
        sheetTitles.forEach((title, idx) => {
            const vr = valueRanges[idx];
            const rows = (vr && vr.values) ? vr.values : [];
            if (rows.length === 0) {
                tables[title] = [];
                return;
            }

            const headers = rows[0];
            const dataRows = rows.slice(1).map(r => {
                const obj = {};
                headers.forEach((h, hIdx) => {
                    if (h) {
                        obj[h] = r[hIdx] !== undefined ? r[hIdx] : null;
                    }
                });
                return obj;
            });
            tables[title] = dataRows;
        });
    } catch (batchErr) {
        console.warn('batchGet failed, falling back to sequential get:', batchErr.message);
        for (const title of sheetTitles) {
            try {
                const res = await sheets.spreadsheets.values.get({
                    spreadsheetId,
                    range: `'${title}'!A1:ZZ50000`,
                    valueRenderOption: 'UNFORMATTED_VALUE'
                });
                const rows = res.data.values || [];
                if (rows.length === 0) {
                    tables[title] = [];
                    continue;
                }

                const headers = rows[0];
                const dataRows = rows.slice(1).map(r => {
                    const obj = {};
                    headers.forEach((h, idx) => {
                        if (h) {
                            obj[h] = r[idx] !== undefined ? r[idx] : null;
                        }
                    });
                    return obj;
                });
                tables[title] = dataRows;
            } catch (e) {
                console.error(`Lỗi đọc sheet ${title}:`, e.message);
            }
        }
    }

    return { tables };
}

// Debounced background sync for efficient performance
let syncTimer = null;
let lastDbSnapshot = null;

function triggerBackgroundSync(db, customSpreadsheetId = null, customCredentials = null) {
    lastDbSnapshot = db;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
        const cfg = getConfig();
        const activeSheetId = customSpreadsheetId || cfg.spreadsheetId;
        if (!activeSheetId || cfg.autoSyncOnSave === false) return;

        try {
            console.log(`[Google Sheets] Đang đồng bộ nền lên Google Sheet (${activeSheetId.slice(0, 8)}...)...`);
            if (lastDbSnapshot) {
                await exportAllToGoogleSheets(lastDbSnapshot, activeSheetId, customCredentials);
                console.log('[Google Sheets] Đồng bộ nền hoàn tất.');
            }
        } catch (e) {
            console.warn('[Google Sheets Sync Warning]:', e.message);
        }
    }, 2500); // 2.5s debounce
}

module.exports = {
    setCredentials,
    getConfig,
    saveConfig,
    testConnection,
    testConnectionWithCredentials,
    exportTableToGoogleSheets,
    exportAllToGoogleSheets,
    importAllFromGoogleSheets,
    triggerBackgroundSync
};
