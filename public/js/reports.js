// ==========================================================================
// REPORTS & EXCEL EXPORT MODULE
// ==========================================================================

const appReports = {
  // Export all 12 sheets directly
  exportCompleteWorkbook() {
    try {
      const wb = XLSX.utils.book_new();
      for (const [sheetName, sheetData] of Object.entries(appData.tables)) {
        if (Array.isArray(sheetData) && sheetData.length > 0) {
          const ws = XLSX.utils.json_to_sheet(sheetData);
          XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
        }
      }
      XLSX.writeFile(wb, `HRM_Database_Trung_Hai_12_Sheets_${new Date().toISOString().slice(0,10)}.xlsx`);
      utils.showToast('Đã xuất toàn bộ Database 12 Sheets thành công!', 'success');
    } catch (e) {
      console.error(e);
      // Fallback to backend download
      window.location.href = '/api/export';
    }
  },

  // Export Salary & Banking Report
  exportSalaryReport() {
    try {
      const salData = appData.salaries.map((s, idx) => {
        const emp = appData.empMap[s.employee_id] || {};
        return {
          "STT": idx + 1,
          "Mã nhân viên": s.employee_id,
          "Họ và tên": s.full_name,
          "Phòng ban": appData.deptMap[emp.department_id] || emp.department_id,
          "Vị trí": appData.posMap[emp.position_id] || emp.position_id,
          "Bậc lương": s.salary_grade,
          "Lương cơ bản (VNĐ)": s.base_salary,
          "Tổng lương (VNĐ)": s.total_salary,
          "Lương đóng BHXH (VNĐ)": s.insurance_salary,
          "Số tài khoản": s.bank_account_number,
          "Ngân hàng": s.bank_name,
          "Chi nhánh": s.bank_branch
        };
      });

      const ws = XLSX.utils.json_to_sheet(salData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "BaoCaoQuyLuong");
      XLSX.writeFile(wb, `Bao_Cao_Quy_Luong_Trung_Hai_${new Date().toISOString().slice(0,10)}.xlsx`);
      utils.showToast('Xuất báo cáo quỹ lương thành công!', 'success');
    } catch (e) {
      utils.showToast('Lỗi khi xuất báo cáo lương', 'error');
    }
  },

  // Export Insurance & Welfare Report
  exportInsuranceReport() {
    try {
      const insData = appData.insurance.map((ins, idx) => {
        const emp = appData.empMap[ins.employee_id] || {};
        return {
          "STT": idx + 1,
          "Mã nhân viên": ins.employee_id,
          "Họ và tên": ins.full_name,
          "Phòng ban": appData.deptMap[emp.department_id] || emp.department_id,
          "Vị trí": appData.posMap[emp.position_id] || emp.position_id,
          "Tham gia BH": ins.has_insurance,
          "Mã số BHXH": ins.social_insurance_code,
          "Số sổ BHXH": ins.social_insurance_book_no,
          "Ngày tham gia": ins.insurance_join_date,
          "Tỷ lệ đóng": '10.5%',
          "Nơi đăng ký KCB": ins.hospital_registered,
          "Công đoàn viên": ins.union_member
        };
      });

      const ws = XLSX.utils.json_to_sheet(insData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "BaoCaoBHXH");
      XLSX.writeFile(wb, `Bao_Cao_BHXH_Trung_Hai_${new Date().toISOString().slice(0,10)}.xlsx`);
      utils.showToast('Xuất báo cáo BHXH thành công!', 'success');
    } catch (e) {
      utils.showToast('Lỗi khi xuất báo cáo BHXH', 'error');
    }
  }
};
