// ==========================================================================
// AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC) MODULE
// ==========================================================================

const appAuth = {
  currentUser: null,
  storageKey: 'hrm_trunghai_user_session',

  init() {
    this.attachEventListeners();
    this.checkSession();
  },

  checkSession() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.currentUser = JSON.parse(saved);
        this.applyUserSession(this.currentUser);
        this.hideLoginScreen();
        return;
      }
    } catch (e) {
      console.error('Session load error:', e);
    }
    this.showLoginScreen();
  },

  showLoginScreen() {
    document.documentElement.classList.remove('user-logged-in');
    const loginEl = document.getElementById('login-screen');
    if (loginEl) {
      loginEl.classList.remove('hidden');
    }
  },

  hideLoginScreen() {
    document.documentElement.classList.add('user-logged-in');
    const loginEl = document.getElementById('login-screen');
    if (loginEl) {
      loginEl.classList.add('hidden');
    }
  },

  async login(username, password) {
    if (!username || !password) {
      utils.showToast('Vui lòng nhập tên đăng nhập và mật khẩu', 'error');
      return false;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const json = await res.json();
      if (json.success && json.user) {
        this.currentUser = json.user;
        localStorage.setItem(this.storageKey, JSON.stringify(json.user));
        this.applyUserSession(json.user);
        this.hideLoginScreen();
        utils.showToast(`Chào mừng ${json.user.full_name} (${json.user.role})!`, 'success');
        return true;
      } else {
        utils.showToast(json.message || 'Đăng nhập không thành công', 'error');
        return false;
      }
    } catch (e) {
      console.error(e);
      utils.showToast('Lỗi kết nối máy chủ', 'error');
      return false;
    }
  },

  // Modal-based Logout flow
  openLogoutModal() {
    const modal = document.getElementById('modal-logout-confirm');
    if (modal) {
      modal.classList.add('active');
    }
  },

  closeLogoutModal() {
    const modal = document.getElementById('modal-logout-confirm');
    if (modal) {
      modal.classList.remove('active');
    }
  },

  confirmLogout() {
    if (window.appLogs) {
      appLogs.recordClientLog('LOGOUT', 'Bảo mật', `Đăng xuất khỏi hệ thống (${this.currentUser?.full_name || ''})`);
    }
    this.closeLogoutModal();
    localStorage.removeItem(this.storageKey);
    this.currentUser = null;
    this.showLoginScreen();
    utils.showToast('Đã đăng xuất khỏi hệ thống', 'info');
  },

  // Apply Role-Based UI Constraints
  applyUserSession(user) {
    if (!user) return;

    // 1. Topbar user info
    const topUserName = document.getElementById('topbar-user-name');
    const topUserRole = document.getElementById('topbar-user-role');
    const topUserAvatar = document.getElementById('topbar-user-avatar');

    const initials = user.full_name ? user.full_name.split(' ').map(n => n[0]).slice(-2).join('') : 'U';
    const isAdmin = user.role === 'ADMIN';
    const displayRole = isAdmin ? 'Admin' : 'Nhân sự';

    if (topUserName) topUserName.textContent = user.full_name;
    if (topUserRole) {
      topUserRole.textContent = displayRole;
      topUserRole.className = `badge ${isAdmin ? 'badge-red' : 'badge-navy'}`;
    }
    if (topUserAvatar) topUserAvatar.textContent = initials;

    // 2. Sidebar user info
    const sideUserName = document.querySelector('.sidebar-user .user-name');
    const sideUserRole = document.querySelector('.sidebar-user .user-role');
    const sideUserAvatar = document.querySelector('.sidebar-user .user-avatar');

    if (sideUserName) sideUserName.textContent = user.full_name;
    if (sideUserRole) sideUserRole.textContent = `${displayRole} - ${user.employee_id}`;
    if (sideUserAvatar) sideUserAvatar.textContent = initials;

    // 3. Role-Based Navigation Filtering
    const navAccounts = document.querySelector('.nav-item[data-view="accounts"]');
    const navLogs = document.querySelector('.nav-item[data-view="logs"]');
    const navReports = document.querySelector('.nav-item[data-view="reports"]');
    const btnAddEmp = document.getElementById('btn-open-add-modal');
    const btnClearLogs = document.getElementById('btn-clear-logs');

    // Admin: Toàn quyền truy cập mọi phân hệ
    if (isAdmin) {
      if (navAccounts) navAccounts.style.display = 'flex';
      if (navLogs) navLogs.style.display = 'flex';
      if (navReports) navReports.style.display = 'flex';
      if (btnAddEmp) btnAddEmp.style.display = 'inline-flex';
      if (btnClearLogs) btnClearLogs.style.display = 'inline-flex';
    } 
    // Nhân sự (HR): Toàn quyền nghiệp vụ, xem nhật ký, ẩn trang Phân quyền
    else {
      if (navAccounts) navAccounts.style.display = 'none';
      if (navLogs) navLogs.style.display = 'flex';
      if (navReports) navReports.style.display = 'flex';
      if (btnAddEmp) btnAddEmp.style.display = 'inline-flex';
      if (btnClearLogs) btnClearLogs.style.display = 'none'; // Chỉ Admin mới được xóa lịch sử
    }
  },

  attachEventListeners() {
    // Login form submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('login-username').value.trim();
        const p = document.getElementById('login-password').value;
        await this.login(u, p);
      });
    }

    // Topbar Logout button opens modal
    const logoutBtn = document.getElementById('btn-topbar-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.openLogoutModal());
    }

    // Confirm logout button inside modal
    const confirmLogoutBtn = document.getElementById('btn-confirm-logout-action');
    if (confirmLogoutBtn) {
      confirmLogoutBtn.addEventListener('click', () => this.confirmLogout());
    }

    // Toggle password visibility
    const togglePassBtn = document.getElementById('btn-toggle-password');
    const passInput = document.getElementById('login-password');
    if (togglePassBtn && passInput) {
      togglePassBtn.addEventListener('click', () => {
        const isPass = passInput.type === 'password';
        passInput.type = isPass ? 'text' : 'password';
        togglePassBtn.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
      });
    }
  }
};
