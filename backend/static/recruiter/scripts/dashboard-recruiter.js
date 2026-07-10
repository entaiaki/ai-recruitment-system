console.log('dashboard-recruiter.js v2 loaded');
// Recruiter Dashboard JS
//recruiter/scripts/dashboard-recruiter.js
// Dummy jobs array
let jobs = [];

// 支持的申请状态
const APPLICATION_STATUSES = ['Pending', 'interviewing', 'Accepted', 'Rejected'];

// 当前 applicants 弹窗的状态（全局保存一次）
let applicantsState = {
  jobId: null,
  all: [],    // 所有申请人
  filter: 'Pending' // 当前按钮选中的状态
};

//定义一个 异步函数 loadJobs，用于从后端加载招聘岗位。
async function loadJobs(status = 'Open') {  //如果没传参数，就默认查询“Open（开放中）”的职位。
  try {
    //fetch() 是浏览器提供的网络请求函数，用来访问接口。当前端调用 php/jobs_list.php?status=Open 时，后端会返回对应状态的岗位列表数据。
    const res = await fetch(`php/jobs_list.php?status=${encodeURIComponent(status)}`, {
      credentials: 'include'
    });
    const json = await res.json();//等待后端返回响应结果并解析为 JSON 对象。（这里相当于：把 PHP 的 echo json_encode([...]) 还原成 JavaScript 对象）
    jobs = json.data || [];
    // 例如后端返回：
    // {
    //   "data": [
    //     { "id": "1", "title": "Frontend Developer", "company": "Acme", ... },
    //     { "id": "2", "title": "Data Analyst", "company": "DataWiz", ... }
    //   ]
    // }
    // 解析后：json.data  // 是一个包含多个职位对象的数组
    renderJobs(); //调用 renderJobs() 函数，把加载到的岗位显示在页面上
  } catch (e) {
    console.error(e);
    const box = document.getElementById('my-jobs-list');
    if (box) box.innerHTML = '<div class="text-red-500">Failed to load jobs.</div>';
  }
}


//定义另一个异步函数，用来关闭某个岗位
async function closeJob(jobId) {
  try {
    //请求体,传给后端 close_job.php
    const res = await fetch('php/close_job.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ jobId: Number(jobId) })
    });
    //等服务器返回后，将返回的内容解析成 JSON 对象。
    const json = await res.json();
    console.log('close_job.php 返回：', json); // ← 看 affected 是多少
    if (json.ok) { //如果返回 JSON 里 ok 为 true，说明关闭成功
      // 本地同步一下，或直接重新拉
      jobs = jobs.map(j => j.id === String(jobId) ? { ...j, status: 'Closed' } : j); //更新本地 jobs 数组，让刚才关闭的那一项的 status 改为 "Closed"；
      renderJobs();
      // 或者：await loadJobs('Open');
    } else {
      alert('Close failed: ' + (json.error || 'unknown error'));
    }
  } catch (e) {
    console.error(e);
    alert('Network error when closing job.');
  }
}

// 加载某个岗位的申请人列表并初始化弹窗状态
async function loadApplicants(jobId) {
  try {
    const res = await fetch(`php/applicants_list.php?job_id=${encodeURIComponent(jobId)}`, {
      credentials: 'include'
    });
    const json = await res.json();

    if (!json.ok) {
      alert('Failed to load applicants: ' + (json.error || 'unknown error'));
      return;
    }

    applicantsState.jobId = jobId;
    applicantsState.all = json.data || [];
    applicantsState.filter = 'Pending'; // 默认先看 Pending

    renderApplicantsModal(); // 不再传参数，直接用全局状态

  } catch (e) {
    console.error(e);
    alert('Network error when loading applicants.');
  }
}


// 根据 applicantsState 渲染弹窗
async function updateApplicationStatusOnServer(applicationId, jobId, newStatus) {
  const res = await fetch('php/update_application_status.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      applicationId: String(applicationId),
      jobId: Number(jobId),
      newStatus
    })
  });
  return res.json();
}




function renderApplicantsModal() {
  console.log('renderApplicantsModal with chat button');
  const modal = document.getElementById('applicants-modal');
  const body = document.getElementById('applicants-modal-body');

  if (!modal || !body) {
    console.error("Applicants modal DOM element not found.");
    return;
  }

  const jobId = applicantsState.jobId;
  const all = applicantsState.all || [];
  const filter = applicantsState.filter;

  // 找到这个 job（从全局 jobs 数组里）
  const job = jobs.find(j => String(j.id) === String(jobId));
  const vacancies = job ? Number(job.vacancies) : null;

  const acceptedCount = all.filter(a => a.application_status === 'Accepted').length;
  const filtered = all.filter(a => a.application_status === filter);

  body.innerHTML = `
    <div class="text-sm text-gray-500 mb-2">
      Job ID: ${jobId} · Total: ${all.length} applicant(s) ${vacancies != null ? `· Vacancies: ${vacancies}` : ''}
    </div>

    <!-- 顶部四个状态按钮 -->
    <div class="flex space-x-2 mb-4">
      ${APPLICATION_STATUSES.map(st => `
        <button
          class="status-filter-btn px-3 py-1 rounded text-sm ${st === filter ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}"
          data-status="${st}">
          ${st}
        </button>
      `).join('')}
    </div>

    <div class="space-y-3">
      ${filtered.length === 0
      ? `<div class="text-gray-400 text-sm">No applicants with status "${filter}".</div>`
      : filtered.map(app => `
              <div class="border rounded p-3 flex flex-col md:flex-row md:justify-between md:items-center">
                <div class="space-y-1">
                  <div class="font-semibold text-base">${app.real_name}</div>
                  <div class="text-xs text-gray-500">
                    Email: ${app.email}<br>
                    Education: ${app.education_level} · Experience: ${app.years_experience} years<br>
                    Expected Salary: ${app.expected_salary_lpa} LPA · Notice: ${app.notice_period_days} days<br>
                    Status: ${app.application_status}
                  </div>
                  <div class="text-xs text-gray-500 mt-1">
                    Phones: ${app.phones && app.phones.length
          ? app.phones.map(p => `${p.phone_number} (${p.phone_type})`).join(', ')
          : 'N/A'
        }
                  </div>
                  <div class="text-xs text-gray-400 mt-1">
                    Applied at: ${app.created_at}
                  </div>
                </div>

                <div class="mt-2 md:mt-0 md:ml-4 flex flex-col space-y-2 items-end">
                  <div class="text-xs text-gray-500 mb-1">change status:</div>
                  <select
                    class="status-select border rounded px-2 py-1 text-xs"
                    data-appid="${app.application_id}">
                    ${APPLICATION_STATUSES.map(st => {
          const isAcceptedOption = (st === 'Accepted');
          const shouldDisableAccepted =
            isAcceptedOption &&
            app.application_status !== 'Accepted' &&
            vacancies != null &&
            acceptedCount >= vacancies;

          return `
                          <option value="${st}"
                            ${st === app.application_status ? 'selected' : ''}
                            ${shouldDisableAccepted ? 'disabled' : ''}>
                            ${st}
                          </option>
                        `;
        }).join('')
        }
                  </select>

                  <!-- Chat 按钮 -->
                  <button
                    class="btn-chat border border-blue-500 text-blue-600 px-3 py-1 rounded text-xs hover:bg-blue-50 transition"
                    data-job_id="${jobId}"
                    data-other_user_id="${app.real_user_id || ''}"
                    data-job_role="${job ? job.title : 'Job'}"
                    data-company_name="${job ? job.company : ''}">
                    Chat
                  </button>

                  ${app.resume_name
          ? `
                        <button class="text-blue-600 text-xs underline view-resume-btn"
                                data-resume-id="${app.resume_id}">
                          View Resume (${app.resume_name})
                        </button>
                      `
          : ''
        }
                </div>
              </div>
            `).join('')
    }
    </div>
  `;

  // 顶部四个状态按钮：切换 filter 再渲染
  body.querySelectorAll('.status-filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const st = this.getAttribute('data-status');
      applicantsState.filter = st;
      renderApplicantsModal();
    });
  });

  // 状态下拉框：修改申请状态
  body.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', async function () {
      const appId = this.getAttribute('data-appid');
      const newStatus = this.value;
      const jobIdLocal = applicantsState.jobId;

      const app = applicantsState.all.find(a => String(a.application_id) === String(appId));
      if (!app) return;

      const oldStatus = app.application_status;
      app.application_status = newStatus;   // 乐观更新

      const res = await updateApplicationStatusOnServer(appId, jobIdLocal, newStatus);
      if (!res.ok) {
        alert(res.error || 'Failed to update status');
        app.application_status = oldStatus; // 回滚
      }

      renderApplicantsModal();
    });
  });

  // 简历预览
  body.querySelectorAll('.view-resume-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const resumeId = this.getAttribute('data-resume-id');
      const resumeModal = document.getElementById('resume-modal');
      const resumeImg = document.getElementById('resume-image');
      if (!resumeModal || !resumeImg) {
        window.open(`php/view_resume.php?resume_id=${encodeURIComponent(resumeId)}`, '_blank');
        return;
      }
      resumeImg.src = `php/view_resume.php?resume_id=${encodeURIComponent(resumeId)}&t=${Date.now()}`;
      resumeModal.classList.remove('hidden');
      resumeModal.classList.add('flex');
    });
  });

  // 打开弹窗
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}





// 渲染职位列表
function renderJobs() {
  const jobsContainer = document.getElementById('my-jobs-list');
  if (!jobsContainer) return;
  jobsContainer.innerHTML = '';

  if (!jobs || jobs.length === 0) {
    jobsContainer.innerHTML =
      '<div class="text-gray-400 text-center py-8">No jobs yet. Post a new job to get started!</div>';
    return;
  }

  jobs.forEach(job => {
    const isOpen = job.status === 'Open';

    const jobDiv = document.createElement('div');
    jobDiv.className =
      'bg-white p-4 rounded shadow flex flex-col md:flex-row md:items-center md:justify-between mb-4';

    jobDiv.innerHTML = `
      <div>
        <h3 class="font-semibold text-lg">${job.title}</h3>
        <p class="text-gray-500 text-sm">
          ${job.company} &bull; ${job.vacancies} Vacancies &bull; ${job.jobType}
        </p>
        <p class="text-gray-500 text-xs mt-1">
          Location: ${job.location.join(', ')} | Salary:${job.salary} per month
        </p>
        <p class="text-xs mt-1">
          Status:
          <span class="${isOpen ? 'text-green-600' : 'text-gray-500'} font-semibold">
            ${job.status}
          </span>
        </p>
      </div>
      <div class="flex space-x-2 mt-2 md:mt-0">
        <button
          class="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition view-applicants-btn"
          data-jobid="${job.id}"
        >
          View Applicants
        </button>

        ${isOpen
        ? `<button
                 class="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition close-job-btn"
                 data-jobid="${job.id}"
               >
                 Close Job
               </button>`
        : ''
      }
      </div>
    `;

    jobsContainer.appendChild(jobDiv);
  });

  // 下面这段绑定按钮事件的代码可以保持不变：
  document.querySelectorAll('.close-job-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const jobId = btn.getAttribute('data-jobid');
      closeJob(jobId);
    });
  });

  document.querySelectorAll('.view-applicants-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const jobId = btn.getAttribute('data-jobid');
      loadApplicants(jobId);
    });
  });
}



document.addEventListener('DOMContentLoaded', function () {
  // 1. 页面加载后先从后端取职位列表
  loadJobs('All'); // loadJobs 里成功后会自己调用 renderJobs()

  // 2. “Post New Job” 按钮
  const postJobBtn = document.getElementById('post-job-btn');
  if (postJobBtn) {
    postJobBtn.addEventListener('click', function () {
      window.location.href = 'post-job.html';
    });
  }

  // 3. Applicants 弹窗关闭逻辑
  const applicantsModal = document.getElementById('applicants-modal');
  const closeApplicantsBtn = document.getElementById('close-applicants-modal');

  if (applicantsModal && closeApplicantsBtn) {
    // 点击右上角 X 关闭
    closeApplicantsBtn.addEventListener('click', () => {
      applicantsModal.classList.add('hidden');
      applicantsModal.classList.remove('flex');
    });

    // 点击灰色背景也关闭
    applicantsModal.addEventListener('click', (e) => {
      if (e.target === applicantsModal) {
        applicantsModal.classList.add('hidden');
        applicantsModal.classList.remove('flex');
      }
    });
  }

  // 4. Resume 预览弹窗关闭逻辑（如果你已经在 HTML 里加了 resume-modal）
  const resumeModal = document.getElementById('resume-modal');
  const closeResumeBtn = document.getElementById('close-resume-modal');

  if (resumeModal && closeResumeBtn) {
    // 点击右上角 X 关闭
    closeResumeBtn.addEventListener('click', () => {
      resumeModal.classList.add('hidden');
      resumeModal.classList.remove('flex');
    });

    // 点击灰色背景也关闭
    resumeModal.addEventListener('click', (e) => {
      if (e.target === resumeModal) {
        resumeModal.classList.add('hidden');
        resumeModal.classList.remove('flex');
      }
    });
  }
});
