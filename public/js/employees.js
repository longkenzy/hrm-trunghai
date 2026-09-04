// ==========================================================================
// EMPLOYEE MANAGEMENT MODULE
// ==========================================================================

const appEmployees = {
  initialized: false,
  currentPage: 1,
  pageSize: 25,
  filteredList: [],
  selectedEmployee: null,

  init() {
    this.populateFilterDropdowns();
    if (!this.initialized) {
      this.attachEventListeners();
      this.initialized = true;
    }
    this.applyFilters();
  },

  populateFilterDropdowns() {
    // Dept filter for table
    const deptSelect = document.getElementById('emp-filter-dept');
    if (deptSelect) {
      const opts = appData.departments.map(d => `<option value="${d.department_id}">${d.department_name}</option>`).join('');
      deptSelect.innerHTML = `<option value="">-- Tất cả Đơn vị / Phòng ban --</option>` + opts;
    }

    // Pos filter for table
    const posSelect = document.getElementById('emp-filter-pos');
    if (posSelect) {
      const opts = appData.positions.map(p => `<option value="${p.position_id}">${p.position_name}</option>`).join('');
      posSelect.innerHTML = `<option value="">-- Tất cả Vị trí --</option>` + opts;
    }

    // Direct manager dropdown for form
    const formMgrSelect = document.getElementById('form-direct-mgr');
    if (formMgrSelect) {
      const activeEmps = appData.employees.filter(e => e.employment_status === 'Đang làm việc');
      const opts = activeEmps.map(e => `<option value="${e.employee_id}">${e.full_name} (${e.employee_id})</option>`).join('');
      formMgrSelect.innerHTML = `<option value="">-- Không có / Tự quản lý --</option>` + opts;
    }

    // Initialize cascading Company -> Department -> Position in Employee Form
    this.populateCompanyDeptPosDropdowns();
  },

  populateCompanyDeptPosDropdowns(selectedCompId = '', selectedDeptId = '', selectedPosId = '') {
    const formCompSelect = document.getElementById('form-company-id');
    const formDeptSelect = document.getElementById('form-dept-id');
    const formPosSelect = document.getElementById('form-pos-id');
    if (!formCompSelect || !formDeptSelect || !formPosSelect) return;

    // 1. Populate Companies
    const companies = appData.companies || [];
    let compOpts = `<option value="">-- Chọn Công Ty Trực Thuộc --</option>`;
    companies.forEach(c => {
      compOpts += `<option value="${c.company_id}" ${c.company_id === selectedCompId ? 'selected' : ''}>${c.company_name} (${c.company_id})</option>`;
    });
    formCompSelect.innerHTML = compOpts;
    if (selectedCompId) formCompSelect.value = selectedCompId;

    // 2. Populate Departments (filtered by selected company if chosen)
    const departments = appData.departments || [];
    const filteredDepts = selectedCompId 
      ? departments.filter(d => {
          if (d.company_id === selectedCompId) return true;
          // Fallback prefix match (e.g. TP-KT matches TP)
          if (d.department_id && (d.department_id.startsWith(selectedCompId + '-') || d.department_id.startsWith(selectedCompId + '_'))) return true;
          return false;
        })
      : departments;

    // Auto-select if there's only 1 department in this company and none explicitly chosen
    let activeDeptId = selectedDeptId;
    if (!activeDeptId && selectedCompId && filteredDepts.length === 1) {
      activeDeptId = filteredDepts[0].department_id;
    }

    let deptOpts = `<option value="">-- Chọn Phòng Ban --</option>`;
    filteredDepts.forEach(d => {
      const compLabel = (!selectedCompId && appData.companyMap[d.company_id]) ? ` [${appData.companyMap[d.company_id]}]` : '';
      deptOpts += `<option value="${d.department_id}" ${d.department_id === activeDeptId ? 'selected' : ''}>${d.department_name}${compLabel}</option>`;
    });
    formDeptSelect.innerHTML = deptOpts;
    if (activeDeptId) formDeptSelect.value = activeDeptId;

    // 3. Populate Positions (Danh mục chức danh độc lập, không phụ thuộc phòng ban và công ty)
    const positions = appData.positions || [];
    let activePosId = selectedPosId;

    let posOpts = `<option value="">-- Chọn Vị Trí Công Việc --</option>`;
    positions.forEach(p => {
      posOpts += `<option value="${p.position_id}" ${p.position_id === activePosId ? 'selected' : ''}>${p.position_name} (${p.position_id})</option>`;
    });
    formPosSelect.innerHTML = posOpts;
    if (activePosId) formPosSelect.value = activePosId;

    // Auto fill Job Title
    if (activePosId) {
      const posObj = positions.find(p => p.position_id === activePosId);
      const titleInput = document.getElementById('form-job-title');
      if (titleInput && (!titleInput.value.trim() || titleInput.dataset.autofilled === '1') && posObj) {
        titleInput.value = posObj.position_name;
        titleInput.dataset.autofilled = '1';
      }
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

    // Detail Modal Tabs Navigation
    document.querySelectorAll('#modal-employee-detail .modal-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = e.currentTarget.getAttribute('data-tab');
        document.querySelectorAll('#modal-employee-detail .modal-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#modal-employee-detail .tab-pane').forEach(p => p.classList.remove('active'));
        
        e.currentTarget.classList.add('active');
        const pane = document.getElementById(targetTab);
        if (pane) pane.classList.add('active');
      });
    });

    // Form Modal Tabs Navigation
    document.querySelectorAll('.form-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = e.currentTarget.getAttribute('data-tab');
        document.querySelectorAll('.form-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.form-tab-pane').forEach(p => {
          p.classList.remove('active');
          p.style.display = 'none';
        });
        
        e.currentTarget.classList.add('active');
        const pane = document.getElementById(targetTab);
        if (pane) {
          pane.classList.add('active');
          pane.style.display = 'block';
        }
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

    // Delete All Employees
    const deleteAllBtn = document.getElementById('btn-delete-all-emp');
    if (deleteAllBtn) {
      deleteAllBtn.addEventListener('click', () => this.openDeleteAllModal());
    }

    // Delete All Confirmation Input Listener
    const deleteAllInput = document.getElementById('delete-all-confirm-input');
    if (deleteAllInput) {
      deleteAllInput.addEventListener('input', (e) => {
        const val = (e.target.value || '').trim().toUpperCase();
        const confirmBtn = document.getElementById('btn-confirm-delete-all-action');
        if (confirmBtn) {
          const isValid = val === 'XOA TOAN BO';
          confirmBtn.disabled = !isValid;
          confirmBtn.style.opacity = isValid ? '1' : '0.5';
          confirmBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
        }
      });
    }

    // Delete All Action Confirm Button
    const confirmDeleteAllBtn = document.getElementById('btn-confirm-delete-all-action');
    if (confirmDeleteAllBtn) {
      confirmDeleteAllBtn.addEventListener('click', () => this.confirmDeleteAll());
    }

    // Cascading Company -> Department -> Position in Employee Form
    const formCompSelect = document.getElementById('form-company-id');
    const formDeptSelect = document.getElementById('form-dept-id');
    const formPosSelect = document.getElementById('form-pos-id');

    if (formCompSelect) {
      formCompSelect.addEventListener('change', (e) => {
        const compId = e.target.value;
        this.populateCompanyDeptPosDropdowns(compId, '', '');
      });
    }

    if (formDeptSelect) {
      formDeptSelect.addEventListener('change', (e) => {
        const deptId = e.target.value;
        const dept = (appData.departments || []).find(d => d.department_id === deptId);
        const compId = dept ? (dept.company_id || 'TH-CORP') : (formCompSelect ? formCompSelect.value : '');
        this.populateCompanyDeptPosDropdowns(compId, deptId, '');
      });
    }

    if (formPosSelect) {
      formPosSelect.addEventListener('change', (e) => {
        const posId = e.target.value;
        const pos = (appData.positions || []).find(p => p.position_id === posId);
        if (pos) {
          const dept = (appData.departments || []).find(d => d.department_id === pos.department_id);
          const compId = dept ? (dept.company_id || 'TH-CORP') : (formCompSelect ? formCompSelect.value : '');
          this.populateCompanyDeptPosDropdowns(compId, pos.department_id || '', posId);
        }
      });
    }
  },

  applyFilters() {
    const searchVal = (document.getElementById('emp-search-input')?.value || '').toLowerCase().trim();
    const deptVal = document.getElementById('emp-filter-dept')?.value || '';
    const posVal = document.getElementById('emp-filter-pos')?.value || '';
    const statusVal = document.getElementById('emp-filter-status')?.value || '';
    const natureVal = document.getElementById('emp-filter-nature')?.value || '';

    const contactMap = {};
    appData.contacts.forEach(c => contactMap[c.employee_id] = c);
    const idMap = {};
    appData.identity.forEach(i => idMap[i.employee_id] = i);

    this.filteredList = appData.employees.filter(e => {
      if (deptVal && e.department_id !== deptVal) return false;
      if (posVal && e.position_id !== posVal) return false;
      if (statusVal && e.employment_status !== statusVal) return false;
      if (natureVal && e.labor_nature !== natureVal) return false;

      if (searchVal) {
        const c = contactMap[e.employee_id] || {};
        const idDoc = idMap[e.employee_id] || {};
        const dName = (appData.deptMap[e.department_id] || '').toLowerCase();
        const pName = (appData.posMap[e.position_id] || '').toLowerCase();

        const match = (
          (e.employee_id || '').toLowerCase().includes(searchVal) ||
          (e.full_name || '').toLowerCase().includes(searchVal) ||
          (c.mobile_phone || '').includes(searchVal) ||
          (c.work_email || '').toLowerCase().includes(searchVal) ||
          (idDoc.id_number || '').includes(searchVal) ||
          dName.includes(searchVal) ||
          pName.includes(searchVal)
        );
        if (!match) return false;
      }

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
              <button class="btn btn-icon btn-sm" title="Chỉnh Sửa 34 Cột" onclick="appEmployees.openEditModal('${e.employee_id}')">
                <i class="fa-solid fa-pen-to-square" style="color: #2563EB;"></i>
              </button>
              <button class="btn btn-icon btn-sm" title="Xóa Nhân Viên" onclick="appEmployees.showDeletePopover(event, '${e.employee_id}')">
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

    let html = '';
    html += `<button class="page-btn ${this.currentPage === 1 ? 'disabled' : ''}" onclick="appEmployees.goToPage(${this.currentPage - 1})"><i class="fa-solid fa-angle-left"></i></button>`;

    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" onclick="appEmployees.goToPage(${i})">${i}</button>`;
    }

    html += `<button class="page-btn ${this.currentPage === totalPages ? 'disabled' : ''}" onclick="appEmployees.goToPage(${this.currentPage + 1})"><i class="fa-solid fa-angle-right"></i></button>`;
    container.innerHTML = html;
  },

  goToPage(page) {
    const totalPages = Math.ceil(this.filteredList.length / this.pageSize) || 1;
    if (page < 1 || page > totalPages) return;
    this.currentPage = page;
    this.renderTable();
    this.renderPagination();
    window.scrollTo({ top: 300, behavior: 'smooth' });
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

      // Safe helper to set textContent without throwing if an element is missing
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = (val !== undefined && val !== null && val !== '') ? val : '-';
      };

      // Header
      setVal('detail-modal-emp-name', `Hồ Sơ Nhân Viên: ${employee.full_name || ''} (${employee.employee_id || ''})`);

      // Tab 1: General
      setVal('det-emp-id', employee.employee_id);
      setVal('det-time-code', employee.time_attendance_code);
      setVal('det-full-name', employee.full_name);
      setVal('det-gender', employee.gender);
      setVal('det-dob', utils.formatDate(employee.date_of_birth));
      setVal('det-birth-place', employee.birth_place);
      setVal('det-native-place', employee.native_place);
      setVal('det-ethnicity-rel', `${employee.ethnicity || 'Kinh'} / ${employee.religion || 'Không'}`);
      setVal('det-marital-children', `${employee.marital_status || 'Độc thân'} (Số con: ${employee.children_count !== undefined ? employee.children_count : 0})`);
      
      const empDept = (appData.departments || []).find(d => d.department_id === employee.department_id);
      const compId = employee.company_id || (empDept ? empDept.company_id : '') || 'TH-CORP';
      const compName = appData.companyMap[compId] || 'Tổng Công Ty Trung Hải';
      setVal('det-company-name', compName);

      setVal('det-dept-name', employee.department_name || employee.department_id);
      setVal('det-pos-name', employee.position_name || employee.position_id);
      setVal('det-job-rank', employee.job_rank || (salary.salary_grade ? `Cấp ${salary.salary_grade}` : 'Cấp 3'));
      setVal('det-job-title', employee.job_title || employee.position_name);
      setVal('det-work-loc', employee.work_location || 'Trụ sở Tổng công ty');
      setVal('det-direct-mgr', employee.direct_manager_name ? `${employee.direct_manager_name} (${employee.direct_manager_id || ''})` : '-');
      setVal('det-indirect-mgr', employee.indirect_manager_name ? `${employee.indirect_manager_name} (${employee.indirect_manager_id || ''})` : '-');
      setVal('det-labor-nature', employee.labor_nature);
      setVal('det-emp-status', employee.employment_status);
      setVal('det-start-date', utils.formatDate(employee.start_date || employee.trial_start_date));
      setVal('det-end-date', employee.end_date === 'Không xác định' ? 'Không xác định' : utils.formatDate(employee.end_date));
      setVal('det-official-date', utils.formatDate(employee.official_date) || utils.formatDate(employee.trial_start_date));
      setVal('det-seniority', employee.seniority_text);
      setVal('det-other-certs', employee.other_certificates || (education && education[0] ? education[0].other_certificates : '') || 'Chứng chỉ An toàn Lao động');

      // Tab 2: Contact
      setVal('det-mobile', contact.mobile_phone);
      setVal('det-home-phone', contact.home_phone);
      setVal('det-work-email', contact.work_email);
      setVal('det-personal-email', contact.personal_email);
      setVal('det-perm-addr', contact.permanent_address_full);
      setVal('det-curr-addr', contact.current_address_full);

      // Tab 3: Identity
      setVal('det-id-type', identity.doc_type || 'CCCD');
      setVal('det-id-num', identity.id_number);
      setVal('det-id-date', utils.formatDate(identity.id_issue_date));
      setVal('det-id-place', identity.id_issue_place);
      setVal('det-id-exp', utils.formatDate(identity.id_expiry_date));
      setVal('det-tax-code', employee.tax_code);
      setVal('det-passport-num', identity.passport_number);
      setVal('det-passport-date', utils.formatDate(identity.passport_issue_date));

      // Tab 4: Emergency
      const emContainer = document.getElementById('det-emergency-container');
      if (emContainer) {
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
      }

      // Tab 5: Education
      const eduContainer = document.getElementById('det-education-container');
      if (eduContainer) {
        if (education && education.length > 0) {
          eduContainer.innerHTML = education.map(ed => `
            <div class="info-item"><span class="info-label">Trình Độ Văn Hóa</span><span class="info-value">${ed.education_level || 'Đại học'}</span></div>
            <div class="info-item"><span class="info-label">Trình Độ Đào Tạo</span><span class="info-value">${ed.degree_type || 'Chính quy'}</span></div>
            <div class="info-item"><span class="info-label">Cơ Sở Đào Tạo (Trường)</span><span class="info-value">${ed.institution || '-'}</span></div>
            <div class="info-item"><span class="info-label">Khoa / Bộ Môn</span><span class="info-value">${ed.faculty || '-'}</span></div>
            <div class="info-item"><span class="info-label">Chuyên Ngành Tốt Nghiệp</span><span class="info-value">${ed.major || '-'}</span></div>
            <div class="info-item"><span class="info-label">Năm Tốt Nghiệp / Xếp Loại</span><span class="info-value">${ed.graduation_year || '-'} (${ed.classification || '-'})</span></div>
            <div class="info-item" style="grid-column: 1 / -1;"><span class="info-label">Bằng Cấp Chuyên Môn Khác</span><span class="info-value" style="color: #059669;">${ed.other_certificates || employee.other_certificates || '-'}</span></div>
          `).join('');
        } else {
          eduContainer.innerHTML = `<div style="grid-column: 1 / -1; color: var(--text-muted); text-align: center; padding: 20px;">Chưa có thông tin văn bằng / học vị.</div>`;
        }
      }

      // Tab 6: Salary
      setVal('det-salary-grade', salary.salary_grade || '1');
      setVal('det-base-salary', utils.formatCurrency(salary.base_salary));
      setVal('det-total-salary', utils.formatCurrency(salary.total_salary));
      setVal('det-ins-salary', utils.formatCurrency(salary.insurance_salary));
      setVal('det-bank-acc', salary.bank_account_number);
      setVal('det-bank-name', salary.bank_name);
      setVal('det-bank-branch', salary.bank_branch);

      // Tab 7: Insurance
      setVal('det-has-ins', insurance.has_insurance || 'Không tham gia');
      setVal('det-bhxh-code', insurance.social_insurance_code);
      setVal('det-bhxh-book', insurance.social_insurance_book_no);
      setVal('det-ins-date', utils.formatDate(insurance.insurance_join_date));
      setVal('det-ins-rate', '10.5% (BHXH 8%, BHYT 1.5%, BHTN 1%)');
      setVal('det-hospital', insurance.hospital_registered);
      setVal('det-union', insurance.union_member || 'Không');

      // Tab 8: Contract & Account
      const firstContract = contracts && contracts.length > 0 ? contracts[0] : {};
      setVal('det-contract-id', firstContract.contract_id);
      setVal('det-contract-type', firstContract.contract_type || employee.contract_type || 'Hợp đồng lao động');
      setVal('det-contract-status', firstContract.contract_status || 'HIỆU LỰC');
      setVal('det-acc-email', account.account_email || `${(employee.employee_id || '').toLowerCase()}@trunghaico.vn`);
      setVal('det-acc-role', account.role || 'USER');
      setVal('det-acc-status', account.account_status || 'Đã kích hoạt');

      // Reset to Tab 1
      const defaultTabBtn = document.querySelector('#modal-employee-detail .modal-tab-btn[data-tab="tab-general"]');
      if (defaultTabBtn) defaultTabBtn.click();

      // Show modal
      const modalEl = document.getElementById('modal-employee-detail');
      if (modalEl) modalEl.classList.add('active');
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
    const oldInput = document.getElementById('form-old-emp-id');
    if (oldInput) oldInput.value = '';
    document.getElementById('form-modal-title').textContent = 'Thêm Nhân Viên Mới (Đầy Đủ 34 Cột)';
    document.getElementById('form-modal-icon').className = 'fa-solid fa-user-plus';
    document.getElementById('form-emp-id').value = '';
    document.getElementById('form-emp-id').readOnly = false;
    document.getElementById('employee-crud-form').reset();

    // Default values
    document.getElementById('form-gender').value = 'Nam';
    document.getElementById('form-ethnicity').value = 'Kinh';
    document.getElementById('form-religion').value = 'Không';
    document.getElementById('form-marital-status').value = 'Độc thân';
    document.getElementById('form-children-count').value = '0';
    document.getElementById('form-job-rank').value = 'Cấp 3 - Chuyên viên / Nhân viên Nghiệp vụ';
    document.getElementById('form-labor-nature').value = 'Chính thức';
    document.getElementById('form-emp-status').value = 'Đang làm việc';
    document.getElementById('form-contract-type').value = 'Hợp đồng lao động không xác định thời hạn';
    document.getElementById('form-id-place').value = 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội';
    document.getElementById('form-bank-name').value = 'Vietcombank';
    document.getElementById('form-education-level').value = 'Đại học';
    document.getElementById('form-emergency-relation').value = 'Vợ';

    // Switch to Tab 1
    document.querySelector('.form-tab-btn[data-tab="form-tab-personal"]').click();

    // Cascading dropdowns: default company, dept, pos from available settings
    const defaultCompId = (appData.companies && appData.companies[0]?.company_id) || 'TH-CORP';
    const firstDept = (appData.departments || []).find(d => (d.company_id || 'TH-CORP') === defaultCompId);
    const defaultDeptId = firstDept ? firstDept.department_id : ((appData.departments && appData.departments[0]?.department_id) || '');
    const firstPos = (appData.positions || []).find(p => p.department_id === defaultDeptId);
    const defaultPosId = firstPos ? firstPos.position_id : ((appData.positions && appData.positions[0]?.position_id) || '');

    this.populateCompanyDeptPosDropdowns(defaultCompId, defaultDeptId, defaultPosId);

    document.getElementById('modal-employee-form').classList.add('active');
  },

  async openEditModal(empId) {
    try {
      const res = await fetch(`/api/employees/${empId}`);
      const json = await res.json();
      if (!json.success || !json.data) {
        utils.showToast('Không thể tải chi tiết nhân viên để sửa', 'error');
        return;
      }

      const { employee, contact, identity, emergency, education, salary, insurance, contracts } = json.data;
      const firstContract = contracts && contracts.length > 0 ? contracts[0] : {};
      const firstEmerg = emergency && emergency.length > 0 ? emergency[0] : {};
      const firstEdu = education && education.length > 0 ? education[0] : {};

      document.getElementById('form-is-edit').value = '1';
      document.getElementById('form-old-emp-id').value = empId;
      document.getElementById('form-modal-title').textContent = `Chỉnh Sửa Hồ Sơ: ${employee.full_name} (${empId})`;
      document.getElementById('form-modal-icon').className = 'fa-solid fa-user-pen';
      
      // Tab 1: Personal (Mã nhân viên có thể thay đổi được khi chỉnh sửa)
      document.getElementById('form-emp-id').value = employee.employee_id || empId;
      document.getElementById('form-emp-id').readOnly = false;
      document.getElementById('form-full-name').value = employee.full_name || '';
      document.getElementById('form-gender').value = employee.gender || 'Nam';
      document.getElementById('form-dob').value = employee.date_of_birth || '';
      document.getElementById('form-birth-place').value = employee.birth_place || '';
      document.getElementById('form-native-place').value = employee.native_place || '';
      document.getElementById('form-ethnicity').value = employee.ethnicity || 'Kinh';
      document.getElementById('form-religion').value = employee.religion || 'Không';
      document.getElementById('form-marital-status').value = employee.marital_status || 'Độc thân';
      document.getElementById('form-children-count').value = employee.children_count !== undefined ? employee.children_count : 0;
      document.getElementById('form-tax-code').value = employee.tax_code || '';

      // Tab 2: Job & Contract (Cascading Company -> Dept -> Position)
      const empDept = (appData.departments || []).find(d => d.department_id === employee.department_id);
      const compId = employee.company_id || (empDept ? empDept.company_id : '') || 'TH-CORP';
      this.populateCompanyDeptPosDropdowns(compId, employee.department_id || '', employee.position_id || '');
      document.getElementById('form-job-rank').value = employee.job_rank || (salary.salary_grade ? `Cấp ${salary.salary_grade} - Kỹ sư Chính` : 'Cấp 3 - Chuyên viên / Nhân viên Nghiệp vụ');
      document.getElementById('form-job-title').value = employee.job_title || '';
      document.getElementById('form-work-location').value = employee.work_location || 'Trụ sở Tổng công ty - Tòa nhà Trung Hải, Hà Nội';
      document.getElementById('form-direct-mgr').value = employee.direct_manager_id || '';
      document.getElementById('form-labor-nature').value = employee.labor_nature || 'Chính thức';
      document.getElementById('form-emp-status').value = employee.employment_status || 'Đang làm việc';
      document.getElementById('form-contract-type').value = firstContract.contract_type || employee.contract_type || 'Hợp đồng lao động không xác định thời hạn';
      document.getElementById('form-start-date').value = employee.start_date || employee.trial_start_date || '';
      document.getElementById('form-end-date').value = employee.end_date || firstContract.end_date || 'Không xác định';

      // Tab 3: Contact, CCCD & Emergency
      document.getElementById('form-mobile').value = contact.mobile_phone || '';
      document.getElementById('form-email').value = contact.work_email || '';
      document.getElementById('form-personal-email').value = contact.personal_email || '';
      document.getElementById('form-perm-address').value = contact.permanent_address_full || '';
      document.getElementById('form-curr-address').value = contact.current_address_full || '';
      document.getElementById('form-id-num').value = identity.id_number || '';
      document.getElementById('form-id-date').value = identity.id_issue_date || '';
      document.getElementById('form-id-place').value = identity.id_issue_place || 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội';
      document.getElementById('form-passport-num').value = identity.passport_number || '';
      document.getElementById('form-emergency-name').value = firstEmerg.contact_name || '';
      document.getElementById('form-emergency-relation').value = firstEmerg.relationship || 'Vợ';
      document.getElementById('form-emergency-phone').value = firstEmerg.mobile_phone || '';

      // Tab 4: Salary, Insurance & Education
      document.getElementById('form-salary').value = salary.base_salary || 0;
      document.getElementById('form-total-salary').value = salary.total_salary || salary.base_salary || 0;
      document.getElementById('form-bank-acc').value = salary.bank_account_number || '';
      document.getElementById('form-bank-name').value = salary.bank_name || 'Vietcombank';
      document.getElementById('form-bank-branch').value = salary.bank_branch || '';
      document.getElementById('form-bhxh-book').value = insurance.social_insurance_book_no || insurance.social_insurance_code || '';
      document.getElementById('form-hospital').value = insurance.hospital_registered || '';
      document.getElementById('form-education-level').value = firstEdu.education_level || 'Đại học';
      document.getElementById('form-major').value = firstEdu.major || '';
      document.getElementById('form-other-certs').value = employee.other_certificates || firstEdu.other_certificates || '';

      // Switch to Tab 1
      document.querySelector('.form-tab-btn[data-tab="form-tab-personal"]').click();
      document.getElementById('modal-employee-form').classList.add('active');
    } catch (e) {
      console.error(e);
      utils.showToast('Lỗi khi mở form chỉnh sửa', 'error');
    }
  },

  closeFormModal() {
    document.getElementById('modal-employee-form').classList.remove('active');
  },

  async handleFormSubmit(e) {
    e.preventDefault();
    const isEdit = document.getElementById('form-is-edit').value === '1';
    const oldEmpId = (document.getElementById('form-old-emp-id')?.value || '').trim();
    const empId = document.getElementById('form-emp-id').value.trim();

    if (!empId) {
      utils.showToast('Vui lòng nhập Mã nhân viên', 'error');
      return;
    }

    const payload = {
      employee_id: empId,
      full_name: document.getElementById('form-full-name').value.trim(),
      gender: document.getElementById('form-gender').value,
      date_of_birth: document.getElementById('form-dob').value || null,
      birth_place: document.getElementById('form-birth-place').value.trim(),
      native_place: document.getElementById('form-native-place').value.trim(),
      ethnicity: document.getElementById('form-ethnicity').value.trim(),
      religion: document.getElementById('form-religion').value.trim(),
      marital_status: document.getElementById('form-marital-status').value,
      children_count: parseInt(document.getElementById('form-children-count').value, 10) || 0,
      tax_code: document.getElementById('form-tax-code').value.trim(),

      company_id: document.getElementById('form-company-id')?.value || '',
      department_id: document.getElementById('form-dept-id').value,
      position_id: document.getElementById('form-pos-id').value,
      job_rank: document.getElementById('form-job-rank').value,
      job_title: document.getElementById('form-job-title').value.trim(),
      work_location: document.getElementById('form-work-location').value.trim(),
      direct_manager_id: document.getElementById('form-direct-mgr').value || null,
      labor_nature: document.getElementById('form-labor-nature').value,
      employment_status: document.getElementById('form-emp-status').value,
      contract_type: document.getElementById('form-contract-type').value,
      start_date: document.getElementById('form-start-date').value || null,
      end_date: document.getElementById('form-end-date').value.trim() || 'Không xác định',

      mobile_phone: document.getElementById('form-mobile').value.trim(),
      work_email: document.getElementById('form-email').value.trim(),
      personal_email: document.getElementById('form-personal-email').value.trim(),
      permanent_address_full: document.getElementById('form-perm-address').value.trim(),
      current_address_full: document.getElementById('form-curr-address').value.trim(),

      id_number: document.getElementById('form-id-num').value.trim(),
      id_issue_date: document.getElementById('form-id-date').value || null,
      id_issue_place: document.getElementById('form-id-place').value.trim(),
      passport_number: document.getElementById('form-passport-num').value.trim() || null,

      emergency_name: document.getElementById('form-emergency-name').value.trim(),
      emergency_relation: document.getElementById('form-emergency-relation').value,
      emergency_phone: document.getElementById('form-emergency-phone').value.trim(),

      base_salary: parseFloat(document.getElementById('form-salary').value) || 0,
      total_salary: parseFloat(document.getElementById('form-total-salary').value) || parseFloat(document.getElementById('form-salary').value) || 0,
      bank_account_number: document.getElementById('form-bank-acc').value.trim(),
      bank_name: document.getElementById('form-bank-name').value,
      bank_branch: document.getElementById('form-bank-branch').value.trim(),

      social_insurance_book_no: document.getElementById('form-bhxh-book').value.trim(),
      hospital_registered: document.getElementById('form-hospital').value.trim(),

      education_level: document.getElementById('form-education-level').value,
      major: document.getElementById('form-major').value.trim(),
      other_certificates: document.getElementById('form-other-certs').value.trim()
    };

    try {
      const targetIdForUrl = (isEdit && oldEmpId) ? oldEmpId : empId;
      const url = isEdit ? `/api/employees/${encodeURIComponent(targetIdForUrl)}` : '/api/employees';
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

  showDeletePopover(event, empId) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.hideDeletePopover();

    const emp = appData.empMap[empId];
    const name = emp ? emp.full_name : empId;
    const triggerBtn = event.currentTarget || event.target.closest('button');

    const popover = document.createElement('div');
    popover.id = 'hrm-emp-delete-popover';
    popover.className = 'hrm-delete-popover';
    popover.innerHTML = `
      <div class="hrm-popover-header">
        <i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-red); font-size: 13px;"></i>
        <span>Xác nhận xóa nhân sự</span>
      </div>
      <div class="hrm-popover-body">
        Chuyển nhân viên <strong style="color: var(--primary-navy);">${name}</strong> (<span style="color: var(--accent-red); font-weight: 600;">${empId}</span>) vào <strong>Thùng rác</strong>? Bạn có thể khôi phục bất cứ lúc nào.
      </div>
      <div class="hrm-popover-actions">
        <button type="button" class="btn btn-secondary hrm-popover-btn-cancel" onclick="appEmployees.hideDeletePopover()">Hủy</button>
        <button type="button" class="btn btn-accent hrm-popover-btn-confirm" id="btn-popover-confirm-del-${empId}">
          <i class="fa-solid fa-trash-can"></i> Xóa
        </button>
      </div>
      <div class="hrm-popover-arrow"></div>
    `;

    document.body.appendChild(popover);

    if (triggerBtn) {
      const rect = triggerBtn.getBoundingClientRect();
      const popoverWidth = 280;
      const popoverHeight = popover.offsetHeight || 135;

      let left = rect.left - popoverWidth - 10;
      let top = rect.top + (rect.height / 2) - (popoverHeight / 2);
      let placement = 'left';

      if (left < 10) {
        left = rect.right + 10;
        placement = 'right';
      }

      if (top < 10) top = 10;
      if (top + popoverHeight > window.innerHeight - 10) {
        top = window.innerHeight - popoverHeight - 10;
      }

      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
      popover.setAttribute('data-placement', placement);
    }

    const confirmBtn = document.getElementById(`btn-popover-confirm-del-${empId}`);
    if (confirmBtn) {
      confirmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.confirmDelete(empId, confirmBtn);
      });
    }

    const outsideClickListener = (e) => {
      if (!popover.contains(e.target) && triggerBtn && !triggerBtn.contains(e.target)) {
        this.hideDeletePopover();
      }
    };
    const escListener = (e) => {
      if (e.key === 'Escape') {
        this.hideDeletePopover();
      }
    };
    const scrollListener = () => {
      this.hideDeletePopover();
    };

    this._popoverCleanup = () => {
      document.removeEventListener('click', outsideClickListener);
      document.removeEventListener('keydown', escListener);
      window.removeEventListener('scroll', scrollListener, true);
    };

    setTimeout(() => {
      document.addEventListener('click', outsideClickListener);
      document.addEventListener('keydown', escListener);
      window.addEventListener('scroll', scrollListener, true);
    }, 10);
  },

  hideDeletePopover() {
    const existing = document.getElementById('hrm-emp-delete-popover');
    if (existing) {
      existing.remove();
    }
    if (this._popoverCleanup) {
      this._popoverCleanup();
      this._popoverCleanup = null;
    }
  },

  async confirmDelete(empId, btnElement) {
    if (btnElement) {
      btnElement.disabled = true;
      btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xóa...';
    }

    try {
      const user = (typeof appAuth !== 'undefined' && typeof appAuth.getCurrentUser === 'function')
        ? appAuth.getCurrentUser()
        : (typeof appAuth !== 'undefined' && appAuth?.currentUser ? appAuth.currentUser : { employee_id: 'TH-1948', full_name: 'Huỳnh Thanh Long', role: 'ADMIN' });

      const res = await fetch(`/api/employees/${empId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator_id: user?.employee_id || 'TH-1948',
          operator_name: user?.full_name || 'Huỳnh Thanh Long',
          operator_role: user?.role || 'ADMIN'
        })
      });
      const json = await res.json();
      if (json.success) {
        utils.showToast(json.message || `Đã chuyển nhân sự ${empId} vào Thùng rác`, 'success');
        this.hideDeletePopover();
        await appData.init();
        appDashboard.init();
        if (typeof appTrash !== 'undefined') appTrash.render();
        this.applyFilters();
      } else {
        utils.showToast(json.message || 'Không thể xóa nhân viên', 'error');
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.innerHTML = '<i class="fa-solid fa-trash-can"></i> Xóa';
        }
      }
    } catch (e) {
      utils.showToast('Lỗi khi xóa nhân viên: ' + e.message, 'error');
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.innerHTML = '<i class="fa-solid fa-trash-can"></i> Xóa';
      }
    }
  },

  async deleteEmployee(empId) {
    this.showDeletePopover(window.event, empId);
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
  },

  openDeleteAllModal() {
    const totalEmployees = (appData.employees || []).length;
    if (totalEmployees === 0) {
      utils.showToast('Hiện không có hồ sơ nhân sự nào trong hệ thống', 'info');
      return;
    }

    const countEl = document.getElementById('delete-all-total-count');
    if (countEl) countEl.textContent = utils.formatNumber(totalEmployees);

    // Calculate employees with accounts
    const accountEmpIds = new Set((appData.accounts || []).map(a => a.employee_id).filter(Boolean));
    accountEmpIds.add('TH-0001');
    accountEmpIds.add('TH-1948');
    const keptEmployees = appData.employees.filter(e => accountEmpIds.has(e.employee_id));
    const actualDeleteCount = Math.max(0, totalEmployees - keptEmployees.length);

    const keptEl = document.getElementById('delete-all-kept-count');
    if (keptEl) keptEl.textContent = utils.formatNumber(keptEmployees.length);

    const actualEl = document.getElementById('delete-all-actual-count');
    if (actualEl) actualEl.textContent = utils.formatNumber(actualDeleteCount);

    const keepCheckbox = document.getElementById('delete-all-keep-accounts');
    if (keepCheckbox) {
      keepCheckbox.checked = true;
      keepCheckbox.onchange = () => {
        if (actualEl) {
          actualEl.textContent = utils.formatNumber(keepCheckbox.checked ? actualDeleteCount : totalEmployees);
        }
      };
    }

    const inputEl = document.getElementById('delete-all-confirm-input');
    if (inputEl) inputEl.value = '';

    const confirmBtn = document.getElementById('btn-confirm-delete-all-action');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.5';
      confirmBtn.style.cursor = 'not-allowed';
      confirmBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> <span>Xóa Toàn Bộ</span>';
    }

    // Reset radio to default (recycle)
    const recycleRadio = document.querySelector('input[name="delete-all-mode"][value="recycle"]');
    if (recycleRadio) recycleRadio.checked = true;

    const modal = document.getElementById('modal-delete-all-employees');
    if (modal) modal.classList.add('active');
  },

  closeDeleteAllModal() {
    const modal = document.getElementById('modal-delete-all-employees');
    if (modal) modal.classList.remove('active');
    const inputEl = document.getElementById('delete-all-confirm-input');
    if (inputEl) inputEl.value = '';
  },

  async confirmDeleteAll() {
    const confirmBtn = document.getElementById('btn-confirm-delete-all-action');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang xử lý...</span>';
    }

    const mode = document.querySelector('input[name="delete-all-mode"]:checked')?.value;
    const isPermanent = mode === 'permanent';
    const keepAccounts = document.getElementById('delete-all-keep-accounts')?.checked !== false;

    try {
      const user = (typeof appAuth !== 'undefined' && typeof appAuth.getCurrentUser === 'function')
        ? appAuth.getCurrentUser()
        : (typeof appAuth !== 'undefined' && appAuth?.currentUser ? appAuth.currentUser : { employee_id: 'TH-1948', full_name: 'Huỳnh Thanh Long', role: 'ADMIN' });

      const res = await fetch('/api/employees/all', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permanent: isPermanent,
          keep_accounts: keepAccounts,
          operator_id: user?.employee_id || 'TH-1948',
          operator_name: user?.full_name || 'Huỳnh Thanh Long',
          operator_role: user?.role || 'ADMIN'
        })
      });

      const json = await res.json();

      if (json.success) {
        utils.showToast(json.message || `Đã xóa thành công ${json.count || ''} nhân sự`, 'success');
        this.closeDeleteAllModal();
        
        // Reload all cached application data
        await appData.init();

        // Refresh views and dashboards
        if (typeof appDashboard !== 'undefined' && typeof appDashboard.init === 'function') {
          appDashboard.init();
        }
        if (typeof appTrash !== 'undefined' && typeof appTrash.render === 'function') {
          appTrash.render();
        }
        if (typeof appLogs !== 'undefined' && typeof appLogs.render === 'function') {
          appLogs.render();
        }

        // Reapply filter for empty state display
        this.currentPage = 1;
        this.applyFilters();
      } else {
        utils.showToast(json.message || 'Lỗi khi xóa toàn bộ nhân sự', 'error');
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> <span>Xóa Toàn Bộ</span>';
        }
      }
    } catch (e) {
      utils.showToast('Lỗi kết nối khi xóa nhân sự: ' + e.message, 'error');
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> <span>Xóa Toàn Bộ</span>';
      }
    }
  }
};
