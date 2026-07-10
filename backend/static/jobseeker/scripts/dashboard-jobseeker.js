console.log('dashboard-jobseeker.js loaded');

// ===== 分页相关全局变量 =====
let allJobs = [];
let currentPage = 1;
const PAGE_SIZE = 5; // 每页几条，可以改

// 页面加载完就去拉职位
document.addEventListener('DOMContentLoaded', function () {
  loadFilteredJobs('php/jobs_filter.php');

  const verifyBtn = document.getElementById('filter-verify');
  verifyBtn.addEventListener('click', function () {

    const keyword = document.getElementById('filter-keyword').value.trim();
    const education = document.getElementById('filter-education').value;
    const discipline = document.getElementById('filter-discipline').value;
    const location = document.getElementById('filter-location').value;
    const experience = document.getElementById('filter-experience').value;
    const jobtype = document.getElementById('filter-jobtype').value;
    const companySize = document.getElementById('filter-company-size').value;
    const salaryMin = document.getElementById('filter-salary-min').value.trim();

    const params = new URLSearchParams({
      keyword,
      education,
      discipline,
      location,
      experience,
      jobtype,
      company_size: companySize,
      salary_min: salaryMin
    });

    const url = `php/jobs_filter.php?${params.toString()}`;
    loadFilteredJobs(url);
  });

});

// 拉职位数据
async function loadFilteredJobs(url) {
  const res = await fetch(url);
  const json = await res.json();

  if (!json.ok) {
    alert("Failed to load filtered jobs");
    return;
  }

  allJobs = json.data || [];
  currentPage = 1;          // 每次筛选回到第一页
  renderJobCardsPage();     // 用分页渲染
}

// 渲染“当前页”的职位
function renderJobCardsPage() {
  const container = document.getElementById('open-jobs');
  container.innerHTML = '';

  if (allJobs.length === 0) {
    container.innerHTML = `<div class="text-gray-500 text-center py-8">No jobs found.</div>`;
    renderPagination();  // 里面会把分页清空
    return;
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const jobsForPage = allJobs.slice(start, end);

  jobsForPage.forEach(job => {
    const div = document.createElement('div');
    div.className = "bg-white p-4 rounded shadow flex flex-col md:flex-row md:items-center md:justify-between";

    div.innerHTML = `
      <div>
        <h3 class="font-semibold text-lg">${job.job_role}</h3>
        <p class="text-gray-500 text-sm">
          ${job.company_name} • 
          ${job.experience_required} • 
          ${job.job_type}
        </p>
      </div>

      <div class="flex gap-2 mt-3 md:mt-0">
        <!-- Chat 按钮 -->
        <button
          class="btn-chat border border-blue-500 text-blue-600 px-4 py-2 rounded text-sm hover:bg-blue-50 transition"
          data-job_id="${job.job_id}"
          data-job_role="${job.job_role}"
          data-company_name="${job.company_name}"
          data-other_user_id="${job.users_id}">
          Chat
        </button>

        <!-- Apply 按钮 -->
        <button class="apply-btn bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800"
          data-job_id="${job.job_id}"
          data-job_role="${job.job_role}"
          data-company_name="${job.company_name}"
          data-location="${job.location}"
          data-experience_required="${job.experience_required}"
          data-job_type="${job.job_type}"
          data-salary="${job.salary}"
          data-job_description="${job.job_description}">
          Apply
        </button>
      </div>
    `;
    container.appendChild(div);
  });

  rebindApplyButtons();
  renderPagination();
}

// 渲染底部分页条
function renderPagination() {
  const pagination = document.getElementById('open-jobs-pagination');
  const totalPages = Math.ceil(allJobs.length / PAGE_SIZE);

  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return; // 只有一页就不显示分页
  }

  let html = `<div class="flex items-center justify-center space-x-3 text-sm">`;

  // 上一页
  html += `
    <button class="page-prev ${currentPage === 1 ? 'text-gray-300 cursor-default' : 'text-gray-500 hover:text-gray-700'}"
            data-page="${currentPage - 1}"
            ${currentPage === 1 ? 'disabled' : ''}>
      &lt;
    </button>
  `;

  // 中间页码
  for (let i = 1; i <= totalPages; i++) {
    const active = i === currentPage;
    html += `
      <button 
        class="page-number px-2 ${active ? 'text-gray-900 border-b-2 border-gray-800' : 'text-gray-500 hover:text-gray-700'}"
        data-page="${i}">
        ${i}
      </button>
    `;
  }

  // 下一页
  html += `
    <button class="page-next ${currentPage === totalPages ? 'text-gray-300 cursor-default' : 'text-gray-500 hover:text-gray-700'}"
            data-page="${currentPage + 1}"
            ${currentPage === totalPages ? 'disabled' : ''}>
      &gt;
    </button>
  `;

  html += `</div>`;
  pagination.innerHTML = html;

  // 绑定点击
  pagination.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages && page !== currentPage) {
        currentPage = page;
        renderJobCardsPage();
      }
    });
  });
}

// 申请按钮跳转到职位详情页
function rebindApplyButtons() {
  document.querySelectorAll('.apply-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const params = new URLSearchParams({
        jobId: btn.dataset.job_id,
        jobRole: btn.dataset.job_role,
        companyName: btn.dataset.company_name,
        location: btn.dataset.location,
        experienceRequired: btn.dataset.experience_required,
        jobType: btn.dataset.job_type,
        salary: btn.dataset.salary,
        jobDescription: btn.dataset.job_description
      });

      window.location.href = `job-details.html?${params.toString()}`;
    });
  });
}
