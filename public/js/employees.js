// ==========================================================================
// EMPLOYEE MANAGEMENT MODULE
// ==========================================================================

const appEmployees = {
  currentPage: 1,
  pageSize: 25,
  filteredList: [],
  selectedEmployee: null,

  init() {
    this.populateFilterDropdowns();
    this.attachEventListeners();
    this.applyFilters();
  },

  populateFilterDropdowns() {
    // Dept filter
    const deptSelect = document.getElementById('emp-filter-dept');
    const formDeptSelect = document.getElementById('form-dept-id');
    if (deptSelect && formDeptSelect) {
      const opts = appData.departments.map(d => `<option value="${d.department_id}">${d.department_name}</option>`).join('');
      deptSelect.innerHTML = `<option value="">-- Tất cả Đơn vị / Phòng ban --</option>` + opts;
      formDeptSelect.innerHTML = `<option value="">-- Chọn Đơn vị / Phòng ban --</option>` + opts;
    }

    // Pos filter
    const posSelect = document.getElementById('emp-filter-pos');
    const formPosSelect = document.getElementById('form-pos-id');
    if (posSelect && formPosSelect) {
      const opts = appData.positions.map(p => `<option value="${p.position_id}">${p.position_name}</option>`).join('');
      posSelect.innerHTML = `<option value="">-- Tất cả Vị trí --</option>` + opts;
      formPosSelect.innerHTML = `<option value="">-- Chọn Vị trí Công việc --</option>` + opts;
    }

    // Direct manager dropdown for form
    const formMgrSelect = document.getElementById('form-direct-mgr');
    if (formMgrSelect) {
      const activeEmps = appData.employees.filter(e => e.employment_status === 'Đang làm việc');
      const opts = activeEmps.map(e => `<option value="${e.employee_id}">${e.full_name} (${e.employee_id})</option>`).join('');
      formMgrSelect.innerHTML = `<option value="">-- Không có / Tự quản lý --</option>` + opts;
    }
  },

  attachEventListeners() {
    // Search input
    const searchInput = document.getElementById('emp-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.currentPage = 1;
        this.applyFilters();
      });
    }

    // Filters
    ['emp-filter-dept', 'emp-filter-pos', 'emp-filter-status', 'emp-filter-nature'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          this.currentPage = 1;
          this.applyFilters();
        });
      }
    });

    // Reset filters
    const resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        document.getElementById('emp-search-input').value = '';
        document.getElementById('emp-filter-dept').value = '';
        document.getElementById('emp-filter-pos').value = '';
        document.getElementById('emp-filter-status').value = '';
        document.getElementById('emp-filter-nature').value = '';
        this.currentPage = 1;
        this.applyFilters();
      });
    }

    // Modal Tabs Navigation
    document.querySelectorAll('.modal-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = e.currentTarget.getAttribute('data-tab');
        document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        
        e.currentTarget.classList.add('active');
        const pane = document.getElementById(targetTab);
        if (pane) pane.classList.add('active');
      });
    });

    // Add Employee Button
    const addBtn = document.getElementById('btn-open-add-modal');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openAddModal());
    }

    // Form Submit
    const form = document.getElementById('employee-crud-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    // Edit from Detail
    const editFromDetBtn = document.getElementById('btn-edit-from-detail');
    if (editFromDetBtn) {
      editFromDetBtn.addEventListener('click', () => {
        if (this.selectedEmployee) {
          this.closeDetailModal();
          this.openEditModal(this.selectedEmployee.employee_id);
        }
      });
    }

    // Page size filter
    const pageSizeSelect = document.getElementById('emp-page-size');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        this.pageSize = parseInt(e.target.value, 10) || 25;
        this.currentPage = 1;
        this.renderTable();
        this.renderPagination();
      });
    }

    // Export Filtered
    const exportFilteredBtn = document.getElementById('btn-export-filtered-emp');
    if (exportFilteredBtn) {
      exportFilteredBtn.addEventListener('click', () => this.exportFilteredExcel());
    }
  },

  applyFilters() {
    const searchVal = (document.getElementById('emp-search-input')?.value || '').toLowerCase().trim();
    const deptVal = document.getElementById('emp-filter-dept')?.value || '';
    const posVal = document.getElementById('emp-filter-pos')?.value || '';
    const statusVal = document.getElementById('emp-filter-status')?.value || '';
    const natureVal = document.getElementById('emp-filter-nature')?.value || '';

    // Contact and ID card maps for full text search
    const contactMap = {};
    appData.contacts.forEach(c => contactMap[c.employee_id] = c);
    const idMap = {};
    appData.identity.forEach(i => idMap[i.employee_id] = i);

    this.filteredList = appData.employees.filter(e => {
      const c = contactMap[e.employee_id] || {};
      const idDoc = idMap[e.employee_id] || {};
      const deptName = (appData.deptMap[e.department_id] || '').toLowerCase();
      const posName = (appData.posMap[e.position_id] || '').toLowerCase();

      // Search match
      if (searchVal) {
        const matches = 
          (e.employee_id && e.employee_id.toLowerCase().includes(searchVal)) ||
          (e.full_name && e.full_name.toLowerCase().includes(searchVal)) ||
          (c.mobile_phone && c.mobile_phone.includes(searchVal)) ||
          (c.work_email && c.work_email.toLowerCase().includes(searchVal)) ||
          (idDoc.id_number && idDoc.id_number.includes(searchVal)) ||
          deptName.includes(searchVal) ||
          posName.includes(searchVal);
        if (!matches) return false;
      }

      if (deptVal && e.department_id !== deptVal) return false;
      if (posVal && e.position_id !== posVal) return false;
      if (statusVal && e.employment_status !== statusVal) return false;
      if (natureVal && e.labor_nature !== natureVal) return false;

      return true;
    });

    // Mặc định sắp xếp theo mã nhân viên (A-Z tự nhiên)
    this.filteredList.sort((a, b) => (a.employee_id || '').localeCompare(b.employee_id || '', undefined, { numeric: true, sensitivity: 'base' }));

    this.renderTable();
    this.renderPagination();
  },

  renderTable() {
    const tbody = document.getElementById('employees-tbody');
    if (!tbody) return;

    if (this.filteredList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 32px; color: var(--text-muted);">
        <i class="fa-solid fa-folder-open" style="font-size: 32px; margin-bottom: 8px; display: block;"></i>
        Không tìm thấy nhân sự phù hợp với điều kiện lọc.
      </td></tr>`;
      return;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    const paginated = this.filteredList.slice(start, start + this.pageSize);

    const contactMap = {};
    appData.contacts.forEach(c => contactMap[c.employee_id] = c);

    tbody.innerHTML = paginated.map((e, index) => {
      const stt = start + index + 1;
      const c = contactMap[e.employee_id] || {};
      const statusBadge = e.employment_status === 'Đang làm việc'
        ? '<span class="badge badge-active"><i class="fa-solid fa-check"></i> Đang làm việc</span>'
        : '<span class="badge badge-resigned"><i class="fa-solid fa-xmark"></i> Đã nghỉ việc</span>';

      const natureBadge = e.labor_nature === 'Chính thức'
        ? '<span class="badge badge-navy">Chính thức</span>'
        : e.labor_nature === 'Thử việc'
        ? '<span class="badge badge-probation">Thử việc</span>'
        : `<span class="badge" style="background:#F1F5F9; color:#475569;">${e.labor_nature || '-'}</span>`;

      return `
        <tr>
          <td class="col-sticky-stt" style="color: var(--text-muted); font-size: 12px; font-weight: 500;">${stt}</td>
          <td class="col-sticky-id"><strong style="color: var(--primary-navy); cursor: pointer;" onclick="appEmployees.openDetailModal('${e.employee_id}')">${e.employee_id}</strong></td>
          <td class="col-sticky-name">
            <div style="font-weight: 600; color: var(--text-primary); cursor: pointer;" onclick="appEmployees.openDetailModal('${e.employee_id}')">${e.full_name}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${e.time_attendance_code ? 'MCC: ' + e.time_attendance_code : ''}</div>
          </td>
          <td>${e.gender || '-'}</td>
          <td>${appData.posMap[e.position_id] || e.position_id || '-'}</td>
          <td style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${appData.deptMap[e.department_id] || e.department_id}">
            ${appData.deptMap[e.department_id] || e.department_id}
          </td>
          <td>${c.mobile_phone || '-'}</td>
          <td>${c.work_email ? `<a href="mailto:${c.work_email}" style="color: var(--primary-navy); text-decoration: none;">${c.work_email}</a>` : '-'}</td>
          <td>${natureBadge}</td>
          <td>${statusBadge}</td>
          <td class="col-sticky-action">
            <div style="display: flex; gap: 4px; justify-content: center;">
              <button class="btn btn-icon btn-sm" title="Xem Chi Tiết 8 Tab" onclick="appEmployees.openDetailModal('${e.employee_id}')">
                <i class="fa-solid fa-eye" style="color: var(--primary-navy);"></i>
              </button>
              <button class="btn btn-icon btn-sm" title="Chỉnh Sửa" onclick="appEmployees.openEditModal('${e.employee_id}')">
                <i class="fa-solid fa-pen-to-square" style="color: #2563EB;"></i>
              </button>
              <button class="btn btn-icon btn-sm" title="Xóa Nhân Viên" onclick="appEmployees.deleteEmployee('${e.employee_id}')">
                <i class="fa-solid fa-trash" style="color: var(--accent-red);"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  renderPagination() {
    const total = this.filteredList.length;
    const totalPages = Math.ceil(total / this.pageSize) || 1;
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }
    const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, total);

    const infoEl = document.getElementById('pagination-info');
    if (infoEl) {
      infoEl.innerHTML = `Hiển thị <strong>${start} - ${end}</strong> trên tổng số <strong>${total}</strong> nhân sự`;
    }

    const container = document.getElementById('pagination-controls');
    if (!container) return;

    let html = `
      <button class="page-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="appEmployees.goToPage(1)"><i class="fa-solid fa-angles-left"></i></button>
      <button class="page-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="appEmployees.goToPage(${this.currentPage - 1})"><i class="fa-solid fa-angle-left"></i></button>
    `;

    // Page window
    const maxBtns = 5;
    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxBtns - 1);
    if (endPage - startPage < maxBtns - 1) {
      startPage = Math.max(1, endPage - maxBtns + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
      html += `<button class="page-btn ${p === this.currentPage ? 'active' : ''}" onclick="appEmployees.goToPage(${p})">${p}</button>`;
    }

    html += `
      <button class="page-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="appEmployees.goToPage(${this.currentPage + 1})"><i class="fa-solid fa-angle-right"></i></button>
      <button class="page-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="appEmployees.goToPage(${totalPages})"><i class="fa-solid fa-angles-right"></i></button>
    `;

    container.innerHTML = html;
  },

  goToPage(p) {
    const totalPages = Math.ceil(this.filteredList.length / this.pageSize) || 1;
    let target = p;
    if (target < 1) target = 1;
    if (target > totalPages) target = totalPages;
    this.currentPage = target;
    this.renderTable();
    this.renderPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // Open Full 8-Tab Detail Modal
  async openDetailModal(empId) {
    try {
      const res = await fetch(`/api/employees/${empId}`);
      const json = await res.json();
      if (!json.success || !json.data) {
        utils.showToast('Không thể tải chi tiết nhân viên', 'error');
        return;
      }

      const { employee, contact, identity, emergency, education, salary, insurance, contracts, account } = json.data;
      this.selectedEmployee = employee;

      // Header
      document.getElementById('detail-modal-emp-name').textContent = `Hồ Sơ Nhân Viên: ${employee.full_name} (${employee.employee_id})`;

      // Tab 1: General
      document.getElementById('det-emp-id').textContent = employee.employee_id || '-';
      document.getElementById('det-time-code').textContent = employee.time_attendance_code || '-';
      document.getElementById('det-full-name').textContent = employee.full_name || '-';
      document.getElementById('det-gender').textContent = employee.gender || '-';
      document.getElementById('det-dob').textContent = utils.formatDate(employee.date_of_birth);
      document.getElementById('det-birth-place').textContent = employee.birth_place || '-';
      document.getElementById('det-native-place').textContent = employee.native_place || '-';
      document.getElementById('det-ethnicity-rel').textContent = `${employee.ethnicity || 'Kinh'} / ${employee.religion || 'Không'}`;
      document.getElementById('det-dept-name').textContent = employee.department_name || employee.department_id || '-';
      document.getElementById('det-pos-name').textContent = employee.position_name || employee.position_id || '-';
      document.getElementById('det-direct-mgr').textContent = employee.direct_manager_name ? `${employee.direct_manager_name} (${employee.direct_manager_id || ''})` : '-';
      document.getElementById('det-indirect-mgr').textContent = employee.indirect_manager_name ? `${employee.indirect_manager_name} (${employee.indirect_manager_id || ''})` : '-';
      document.getElementById('det-labor-nature').textContent = employee.labor_nature || '-';
      document.getElementById('det-emp-status').textContent = employee.employment_status || '-';
      document.getElementById('det-trial-date').textContent = utils.formatDate(employee.trial_start_date || employee.probation_start_date);
      document.getElementById('det-official-date').textContent = utils.formatDate(employee.official_date);
      document.getElementById('det-seniority').textContent = employee.seniority_text || '-';
      document.getElementById('det-blacklist').textContent = employee.is_blacklisted ? 'Có (Danh sách đen)' : 'Không';

      // Tab 2: Contact
      document.getElementById('det-mobile').textContent = contact.mobile_phone || '-';
      document.getElementById('det-home-phone').textContent = contact.home_phone || '-';
      document.getElementById('det-work-email').textContent = contact.work_email || '-';
      document.getElementById('det-personal-email').textContent = contact.personal_email || '-';
      document.getElementById('det-perm-addr').textContent = contact.permanent_address_full || '-';
      document.getElementById('det-curr-addr').textContent = contact.current_address_full || '-';

      // Tab 3: Identity
      document.getElementById('det-id-type').textContent = identity.doc_type || 'CCCD';
      document.getElementById('det-id-num').textContent = identity.id_number || '-';
      document.getElementById('det-id-date').textContent = utils.formatDate(identity.id_issue_date);
      document.getElementById('det-id-place').textContent = identity.id_issue_place || '-';
      document.getElementById('det-id-exp').textContent = utils.formatDate(identity.id_expiry_date);
      document.getElementById('det-tax-code').textContent = employee.tax_code || '-';
      document.getElementById('det-passport-num').textContent = identity.passport_number || '-';
      document.getElementById('det-passport-date').textContent = utils.formatDate(identity.passport_issue_date);

      // Tab 4: Emergency
      const emContainer = document.getElementById('det-emergency-container');
      if (emergency && emergency.length > 0) {
        emContainer.innerHTML = emergency.map(em => `
          <div class="info-item"><span class="info-label">Họ và Tên Thân Nhân</span><span class="info-value">${em.contact_name || '-'}</span></div>
          <div class="info-item"><span class="info-label">Mối Quan Hệ</span><span class="info-value">${em.relationship || '-'}</span></div>
          <div class="info-item"><span class="info-label">Số ĐT Liên Hệ</span><span class="info-value">${em.mobile_phone || '-'}</span></div>
          <div class="info-item"><span class="info-label">Email Thân Nhân</span><span class="info-value">${em.email || '-'}</span></div>
          <div class="info-item" style="grid-column: 1 / -1;"><span class="info-label">Địa Chỉ</span><span class="info-value">${em.address || '-'}</span></div>
        `).join('');
      } else {
        emContainer.innerHTML = `<div style="grid-column: 1 / -1; color: var(--text-muted); text-align: center; padding: 20px;">Chưa có thông tin người liên hệ khẩn cấp.</div>`;
      }

      // Tab 5: Education
      const eduContainer = document.getElementById('det-education-container');
      if (education && education.length > 0) {
        eduContainer.innerHTML = education.map(ed => `
          <div class="info-item"><span class="info-label">Trình Độ Văn Hóa</span><span class="info-value">${ed.education_level || '12/12'}</span></div>
          <div class="info-item"><span class="info-label">Trình Độ Đào Tạo</span><span class="info-value">${ed.degree_type || '-'}</span></div>
          <div class="info-item"><span class="info-label">Cơ Sở Đào Tạo (Trường)</span><span class="info-value">${ed.institution || '-'}</span></div>
          <div class="info-item"><span class="info-label">Khoa / Bộ Môn</span><span class="info-value">${ed.faculty || '-'}</span></div>
          <div class="info-item"><span class="info-label">Chuyên Ngành Tốt Nghiệp</span><span class="info-value">${ed.major || '-'}</span></div>
          <div class="info-item"><span class="info-label">Năm Tốt Nghiệp / Xếp Loại</span><span class="info-value">${ed.graduation_year || '-'} (${ed.classification || '-'})</span></div>
        `).join('');
      } else {
        eduContainer.innerHTML = `<div style="grid-column: 1 / -1; color: var(--text-muted); text-align: center; padding: 20px;">Chưa có thông tin văn bằng / học vị.</div>`;
      }

      // Tab 6: Salary
      document.getElementById('det-salary-grade').textContent = salary.salary_grade || '1';
      document.getElementById('det-base-salary').textContent = utils.formatCurrency(salary.base_salary);
      document.getElementById('det-total-salary').textContent = utils.formatCurrency(salary.total_salary);
      document.getElementById('det-ins-salary').textContent = utils.formatCurrency(salary.insurance_salary);
      document.getElementById('det-bank-acc').textContent = salary.bank_account_number || '-';
      document.getElementById('det-bank-name').textContent = salary.bank_name || '-';
      document.getElementById('det-bank-branch').textContent = salary.bank_branch || '-';

      // Tab 7: Insurance
      document.getElementById('det-has-ins').textContent = insurance.has_insurance || 'Không tham gia';
      document.getElementById('det-bhxh-code').textContent = insurance.social_insurance_code || '-';
      document.getElementById('det-bhxh-book').textContent = insurance.social_insurance_book_no || '-';
      document.getElementById('det-ins-date').textContent = utils.formatDate(insurance.insurance_join_date);
      document.getElementById('det-ins-rate').textContent = '10.5% (BHXH 8%, BHYT 1.5%, BHTN 1%)';
      document.getElementById('det-hospital').textContent = insurance.hospital_registered || '-';
      document.getElementById('det-union').textContent = insurance.union_member || 'Không';

      // Tab 8: Contract & Account
      const firstContract = contracts && contracts.length > 0 ? contracts[0] : {};
      document.getElementById('det-contract-id').textContent = firstContract.contract_id || '-';
      document.getElementById('det-contract-type').textContent = firstContract.contract_type || 'Hợp đồng xác định thời hạn';
      document.getElementById('det-contract-status').textContent = firstContract.contract_status || 'HIỆU LỰC';
      document.getElementById('det-acc-email').textContent = account.account_email || `${employee.employee_id.toLowerCase()}@trunghaico.vn`;
      document.getElementById('det-acc-role').textContent = account.role || 'EMPLOYEE';
      document.getElementById('det-acc-status').textContent = account.account_status || 'Đã kích hoạt';

      // Reset to Tab 1
      document.querySelector('.modal-tab-btn[data-tab="tab-general"]').click();

      // Show modal
      document.getElementById('modal-employee-detail').classList.add('active');
    } catch (e) {
      console.error(e);
      utils.showToast('Lỗi khi mở hồ sơ nhân viên', 'error');
    }
  },

  closeDetailModal() {
    document.getElementById('modal-employee-detail').classList.remove('active');
  },

  openAddModal() {
    document.getElementById('form-is-edit').value = '0';
    document.getElementById('form-modal-title').textContent = 'Thêm Nhân Viên Mới';
    document.getElementById('form-emp-id').value = '';
    document.getElementById('form-emp-id').readOnly = false;
    document.getElementById('employee-crud-form').reset();
    document.getElementById('modal-employee-form').classList.add('active');
  },

  openEditModal(empId) {
    const emp = appData.empMap[empId];
    if (!emp) return;

    const contact = appData.contacts.find(c => c.employee_id === empId) || {};
    const salary = appData.salaries.find(s => s.employee_id === empId) || {};
    const idDoc = appData.identity.find(i => i.employee_id === empId) || {};

    document.getElementById('form-is-edit').value = '1';
    document.getElementById('form-modal-title').textContent = `Chỉnh Sửa Nhân Viên: ${emp.full_name} (${empId})`;
    
    document.getElementById('form-emp-id').value = emp.employee_id;
    document.getElementById('form-emp-id').readOnly = true;
    document.getElementById('form-full-name').value = emp.full_name || '';
    document.getElementById('form-gender').value = emp.gender || 'Nam';
    document.getElementById('form-dob').value = emp.date_of_birth || '';
    document.getElementById('form-dept-id').value = emp.department_id || '';
    document.getElementById('form-pos-id').value = emp.position_id || '';
    document.getElementById('form-direct-mgr').value = emp.direct_manager_id || '';
    document.getElementById('form-labor-nature').value = emp.labor_nature || 'Chính thức';
    document.getElementById('form-mobile').value = contact.mobile_phone || '';
    document.getElementById('form-email').value = contact.work_email || '';
    document.getElementById('form-id-num').value = idDoc.id_number || '';
    document.getElementById('form-salary').value = salary.base_salary || '';

    document.getElementById('modal-employee-form').classList.add('active');
  },

  closeFormModal() {
    document.getElementById('modal-employee-form').classList.remove('active');
  },

  async handleFormSubmit(e) {
    e.preventDefault();
    const isEdit = document.getElementById('form-is-edit').value === '1';
    const empId = document.getElementById('form-emp-id').value.trim();

    const payload = {
      employee_id: empId,
      full_name: document.getElementById('form-full-name').value.trim(),
      gender: document.getElementById('form-gender').value,
      date_of_birth: document.getElementById('form-dob').value || null,
      department_id: document.getElementById('form-dept-id').value,
      position_id: document.getElementById('form-pos-id').value,
      direct_manager_id: document.getElementById('form-direct-mgr').value || null,
      labor_nature: document.getElementById('form-labor-nature').value,
      mobile_phone: document.getElementById('form-mobile').value.trim(),
      work_email: document.getElementById('form-email').value.trim(),
      id_number: document.getElementById('form-id-num').value.trim(),
      base_salary: parseFloat(document.getElementById('form-salary').value) || 0
    };

    try {
      const url = isEdit ? `/api/employees/${empId}` : '/api/employees';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success) {
        utils.showToast(isEdit ? 'Cập nhật nhân viên thành công!' : 'Thêm nhân viên mới thành công!', 'success');
        this.closeFormModal();
        await appData.init();
        appDashboard.init();
        this.applyFilters();
      } else {
        utils.showToast(json.message || 'Lỗi khi lưu dữ liệu', 'error');
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi kết nối tới máy chủ', 'error');
    }
  },

  async deleteEmployee(empId) {
    const emp = appData.empMap[empId];
    const name = emp ? emp.full_name : empId;
    if (!confirm(`Bạn có chắc chắn muốn xóa nhân viên "${name}" (${empId}) khỏi cơ sở dữ liệu?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/employees/${empId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        utils.showToast(`Đã xóa thành công nhân sự ${empId}`, 'success');
        await appData.init();
        appDashboard.init();
        this.applyFilters();
      } else {
        utils.showToast('Không thể xóa nhân viên', 'error');
      }
    } catch (e) {
      utils.showToast('Lỗi khi xóa nhân viên', 'error');
    }
  },

  exportFilteredExcel() {
    if (this.filteredList.length === 0) {
      utils.showToast('Không có dữ liệu để xuất', 'error');
      return;
    }

    const contactMap = {};
    appData.contacts.forEach(c => contactMap[c.employee_id] = c);
    const salMap = {};
    appData.salaries.forEach(s => salMap[s.employee_id] = s);
    const idMap = {};
    appData.identity.forEach(i => idMap[i.employee_id] = i);

    const exportData = this.filteredList.map((e, idx) => ({
      "STT": idx + 1,
      "Mã nhân viên": e.employee_id,
      "Họ và tên": e.full_name,
      "Giới tính": e.gender,
      "Ngày sinh": e.date_of_birth,
      "Vị trí công việc": appData.posMap[e.position_id] || e.position_id,
      "Đơn vị công tác": appData.deptMap[e.department_id] || e.department_id,
      "Quản lý trực tiếp": e.direct_manager_name || '',
      "Tính chất lao động": e.labor_nature,
      "Trạng thái lao động": e.employment_status,
      "Số ĐT di động": contactMap[e.employee_id]?.mobile_phone || '',
      "Email công việc": contactMap[e.employee_id]?.work_email || '',
      "Số CMND/CCCD": idMap[e.employee_id]?.id_number || '',
      "Lương cơ bản": salMap[e.employee_id]?.base_salary || 0,
      "Số TK ngân hàng": salMap[e.employee_id]?.bank_account_number || '',
      "Ngân hàng": salMap[e.employee_id]?.bank_name || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSachNhanSu");
    XLSX.writeFile(wb, `Danh_Sach_Nhan_Su_Trung_Hai_${new Date().toISOString().slice(0,10)}.xlsx`);
    utils.showToast('Xuất danh sách nhân sự Excel thành công!', 'success');
  }
};
