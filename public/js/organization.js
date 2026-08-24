// ==========================================================================
// DEPARTMENTS, POSITIONS & CONTRACTS MODULE
// ==========================================================================

const appOrganization = {
  deptSearchQuery: '',
  posSearchQuery: '',
  contractSearchQuery: '',

  init() {
    this.attachEventListeners();
    this.renderDepartmentsTable();
    this.renderPositionsTable();
    this.renderContractsTable();
  },

  attachEventListeners() {
    const deptSearch = document.getElementById('dept-search-input');
    if (deptSearch) {
      deptSearch.addEventListener('input', (e) => {
        this.deptSearchQuery = e.target.value.trim().toLowerCase();
        this.renderDepartmentsTable();
      });
    }

    const posSearch = document.getElementById('pos-search-input');
    if (posSearch) {
      posSearch.addEventListener('input', (e) => {
        this.posSearchQuery = e.target.value.trim().toLowerCase();
        this.renderPositionsTable();
      });
    }

    const contractSearch = document.getElementById('contract-search-input');
    if (contractSearch) {
      contractSearch.addEventListener('input', (e) => {
        this.contractSearchQuery = e.target.value.trim().toLowerCase();
        this.renderContractsTable();
      });
    }
  },

  // ========================================================================
  // 1. DEPARTMENTS TABLE
  // ========================================================================
  renderDepartmentsTable() {
    const tbody = document.getElementById('departments-tbody');
    if (!tbody) return;

    const deptCounts = {};
    const activeCounts = {};

    (appData.employees || []).forEach(e => {
      deptCounts[e.department_id] = (deptCounts[e.department_id] || 0) + 1;
      if (e.employment_status === 'Đang làm việc') {
        activeCounts[e.department_id] = (activeCounts[e.department_id] || 0) + 1;
      }
    });

    const filtered = (appData.departments || []).filter(d => {
      if (!this.deptSearchQuery) return true;
      const id = (d.department_id || '').toLowerCase();
      const name = (d.department_name || '').toLowerCase();
      return id.includes(this.deptSearchQuery) || name.includes(this.deptSearchQuery);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">
            <i class="fa-solid fa-building-circle-xmark" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
            Không tìm thấy phòng ban phù hợp
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(d => {
      const count = deptCounts[d.department_id] || 0;
      const active = activeCounts[d.department_id] || 0;
      return `
        <tr>
          <td><strong style="color: var(--primary-navy); font-family: monospace; font-size: 13px;">${d.department_id}</strong></td>
          <td><strong style="color: var(--text-primary); font-size: 13px;">${d.department_name}</strong></td>
          <td style="text-align: center;">
            <span class="badge badge-navy" style="font-size: 11.5px; font-weight: 700;">
              <i class="fa-solid fa-users"></i> ${count} nhân sự
            </span>
          </td>
          <td style="text-align: center;">
            <span class="badge badge-active" style="font-size: 11.5px; font-weight: 700;">
              <i class="fa-solid fa-circle-check"></i> ${active} đang làm
            </span>
          </td>
          <td><span class="badge badge-active">${d.status || 'ACTIVE'}</span></td>
          <td style="text-align: center;">
            <button class="btn btn-sm btn-outline-navy" onclick="appOrganization.filterEmployeesByDept('${d.department_id}')" title="Xem danh sách nhân viên thuộc đơn vị này">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Xem Nhân Sự
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ========================================================================
  // 2. POSITIONS TABLE
  // ========================================================================
  renderPositionsTable() {
    const tbody = document.getElementById('positions-tbody');
    if (!tbody) return;

    const posCounts = {};
    (appData.employees || []).forEach(e => {
      posCounts[e.position_id] = (posCounts[e.position_id] || 0) + 1;
    });

    const filtered = (appData.positions || []).filter(p => {
      if (!this.posSearchQuery) return true;
      const id = (p.position_id || '').toLowerCase();
      const name = (p.position_name || '').toLowerCase();
      return id.includes(this.posSearchQuery) || name.includes(this.posSearchQuery);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted);">
            <i class="fa-solid fa-briefcase" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
            Không tìm thấy vị trí / chức danh phù hợp
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const count = posCounts[p.position_id] || 0;
      return `
        <tr>
          <td><strong style="color: var(--primary-navy); font-family: monospace; font-size: 13px;">${p.position_id}</strong></td>
          <td><strong style="color: var(--text-primary); font-size: 13px;">${p.position_name}</strong></td>
          <td style="text-align: center;">
            <span class="badge badge-navy" style="font-size: 11.5px; font-weight: 700;">
              <i class="fa-solid fa-user-tag"></i> ${count} nhân sự
            </span>
          </td>
          <td><span class="badge badge-active">${p.status || 'ACTIVE'}</span></td>
          <td style="text-align: center;">
            <button class="btn btn-sm btn-outline-navy" onclick="appOrganization.filterEmployeesByPosition('${p.position_id}')" title="Xem danh sách nhân sự giữ chức danh này">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Xem Nhân Sự
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ========================================================================
  // 3. CONTRACTS TABLE
  // ========================================================================
  renderContractsTable() {
    const tbody = document.getElementById('contracts-tbody');
    if (!tbody) return;

    const filtered = (appData.contracts || []).filter(c => {
      if (!this.contractSearchQuery) return true;
      const cid = (c.contract_id || '').toLowerCase();
      const eid = (c.employee_id || '').toLowerCase();
      const name = (c.full_name || '').toLowerCase();
      const type = (c.contract_type || '').toLowerCase();
      return cid.includes(this.contractSearchQuery) || 
             eid.includes(this.contractSearchQuery) || 
             name.includes(this.contractSearchQuery) ||
             type.includes(this.contractSearchQuery);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">
            <i class="fa-solid fa-file-excel" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
            Không tìm thấy hợp đồng phù hợp
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.slice(0, 100).map(c => {
      const isOfficial = c.contract_type && c.contract_type.includes('KXD');
      const badgeType = isOfficial ? 'badge-active' : 'badge-navy';
      const statusBadge = c.contract_status === 'HIỆU LỰC' 
        ? '<span class="badge badge-active"><i class="fa-solid fa-circle-check"></i> HIỆU LỰC</span>'
        : '<span class="badge badge-resigned"><i class="fa-solid fa-ban"></i> HẾT HẠN</span>';

      return `
        <tr>
          <td><strong style="color: var(--primary-navy); font-family: monospace;">${c.contract_id}</strong></td>
          <td>
            <span class="badge badge-navy" style="cursor: pointer;" onclick="appEmployees.openDetailModal('${c.employee_id}')" title="Xem chi tiết nhân viên">
              ${c.employee_id}
            </span>
          </td>
          <td><strong style="color: var(--text-primary); cursor: pointer;" onclick="appEmployees.openDetailModal('${c.employee_id}')">${c.full_name}</strong></td>
          <td><span class="badge ${badgeType}">${c.contract_type}</span></td>
          <td>${utils.formatDate(c.trial_start_date)}</td>
          <td>${utils.formatDate(c.official_date)}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');
  },

  // ========================================================================
  // NAVIGATION HELPERS
  // ========================================================================
  filterEmployeesByDept(deptId) {
    const navEmp = document.querySelector('.nav-item[data-view="employees"]');
    if (navEmp) navEmp.click();
    
    setTimeout(() => {
      const select = document.getElementById('emp-filter-dept');
      if (select) {
        select.value = deptId;
        appEmployees.applyFilters();
      }
    }, 50);
  },

  filterEmployeesByPosition(posId) {
    const navEmp = document.querySelector('.nav-item[data-view="employees"]');
    if (navEmp) navEmp.click();

    setTimeout(() => {
      const search = document.getElementById('emp-search-input');
      if (search) {
        search.value = posId;
        appEmployees.applyFilters();
      }
    }, 50);
  }
};
