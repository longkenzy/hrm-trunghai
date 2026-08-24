// ==========================================================================
// MAIN APPLICATION ROUTER & CONTROLLER
// ==========================================================================

const app = {
  async init() {
    console.log('Initializing TRUNG HAI HRM WebApp...');
    
    // 1. Load Data
    const loaded = await appData.init();
    if (!loaded) {
      utils.showToast('Không thể kết nối CSDL máy chủ', 'error');
    }

    // 2. Initialize Sub-modules
    appDashboard.init();
    appEmployees.init();
    appOrganization.init();
    appAccounts.init();
    appLogs.init();
    appAuth.init();

    // 3. Navigation setup
    this.setupNavigation();
    this.setupSidebarToggle();
    this.setupGlobalSearch();
    this.setupQuickActions();

    // Window resize handler
    window.addEventListener('resize', () => {
      if (document.getElementById('view-dashboard')?.classList.contains('active')) {
        appDashboard.renderCharts();
      }
    });

    utils.showToast('Hệ thống HRM TRUNG HẢI đã sẵn sàng!', 'success');
  },

  setupSidebarToggle() {
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        setTimeout(() => {
          if (document.getElementById('view-dashboard')?.classList.contains('active')) {
            appDashboard.renderCharts();
          }
        }, 250);
      });
    }
  },

  setupNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const viewPanels = document.querySelectorAll('.view-panel');
    const pageTitle = document.getElementById('current-page-title');

    const titles = {
      'dashboard': '<i class="fa-solid fa-chart-pie"></i> <span>Dashboard Thống Kê</span>',
      'employees': '<i class="fa-solid fa-users"></i> <span>Quản Lý Nhân Sự</span>',
      'departments': '<i class="fa-solid fa-building"></i> <span>Danh Sách Phòng Ban</span>',
      'positions': '<i class="fa-solid fa-briefcase"></i> <span>Vị Trí Công Việc</span>',
      'contracts': '<i class="fa-solid fa-file-contract"></i> <span>Hợp Đồng & Cảnh Báo</span>',
      'reports': '<i class="fa-solid fa-file-excel"></i> <span>Báo Cáo & Xuất Dữ Liệu</span>',
      'accounts': '<i class="fa-solid fa-user-shield"></i> <span>Tài Khoản & Phân Quyền</span>',
      'logs': '<i class="fa-solid fa-clock-rotate-left"></i> <span>Nhật Ký Hoạt Động Hệ Thống</span>'
    };

    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const viewId = item.getAttribute('data-view');
        if (!viewId) return;

        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        viewPanels.forEach(panel => {
          panel.classList.remove('active');
          if (panel.id === `view-${viewId}`) {
            panel.classList.add('active');
          }
        });

        if (pageTitle && titles[viewId]) {
          pageTitle.innerHTML = titles[viewId];
        }

        // Trigger dynamic renders on view activation
        if (viewId === 'dashboard') {
          setTimeout(() => appDashboard.renderCharts(), 50);
        } else if (viewId === 'departments') {
          appOrganization.renderDepartmentsTable();
        } else if (viewId === 'positions') {
          appOrganization.renderPositionsTable();
        } else if (viewId === 'contracts') {
          appOrganization.renderContractsTable();
        } else if (viewId === 'accounts') {
          appAccounts.init();
        } else if (viewId === 'logs') {
          appLogs.fetchLogs();
        }
      });
    });
  },

  setupGlobalSearch() {
    const globalSearch = document.getElementById('global-search-input');
    if (!globalSearch) return;

    globalSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = globalSearch.value.trim();
        if (query) {
          // Switch to employees view and search
          document.querySelector('.nav-item[data-view="employees"]').click();
          const empSearch = document.getElementById('emp-search-input');
          if (empSearch) {
            empSearch.value = query;
            appEmployees.currentPage = 1;
            appEmployees.applyFilters();
          }
        }
      }
    });
  },

  setupQuickActions() {
    const quickExportBtn = document.getElementById('btn-quick-export');
    if (quickExportBtn) {
      quickExportBtn.addEventListener('click', () => {
        appReports.exportCompleteWorkbook();
      });
    }
  }
};

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
