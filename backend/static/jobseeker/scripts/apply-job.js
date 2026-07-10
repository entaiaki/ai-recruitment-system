// jobseeker/scripts/apply-job.js

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', function () {
    // ===== 1. URL → hero & job_id =====
    const urlParams = new URLSearchParams(window.location.search);

    const jobId = urlParams.get('jobId') || '';
    const jobTitle = urlParams.get('jobRole') || 'Job Title';
    const companyName = urlParams.get('companyName') || 'Company';
    const jobDesc =
        urlParams.get('jobDescription') || 'Job description is not provided.';

    updateHeroHeader(jobId, jobTitle, companyName, jobDesc);

    const jobIdInput = document.getElementById('job_id');
    if (jobIdInput) jobIdInput.value = jobId;

    const applyForm = document.getElementById('applyForm');
    const applyButton = document.getElementById('apply-btn');
    const hiddenPhone1 = document.getElementById('phone1_hidden');
    const hiddenPhone2 = document.getElementById('phone2_hidden');

    let personalInfoOK = false;
    let resumeReady = false;

    function updateApplyButtonState() {
        if (!applyButton) return;
        if (personalInfoOK && resumeReady) {
            applyButton.disabled = false;
            applyButton.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            applyButton.disabled = true;
            applyButton.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }

    // ===== 2. Personal Info 摘要（后端给 name/email/edu/phones） =====
    async function loadPersonalInfo() {
        const summaryEl = document.getElementById('personal-info-summary');
        const warningEl = document.getElementById('personal-info-warning');
        if (!summaryEl || !warningEl) return;

        try {
            const res = await fetch('php/personal_info_get.php', {
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();

            if (!data.success) {
                summaryEl.innerHTML =
                    '<p class="text-sm text-red-600">Failed to load personal information.</p>';
                personalInfoOK = false;
                warningEl.classList.remove('hidden');
                updateApplyButtonState();
                return;
            }

            const info = data.data || {};
            const baseComplete = !!data.complete;

            // 从后端返回的数据里取手机号
            const phones = Array.isArray(info.phones) ? info.phones : [];
            const phone1 = info.phone || phones[0] || '';
            const phone2 = phones[1] || '';

            const phonePattern = /^[0-9]{11}$/;
            const phoneOK = phonePattern.test(phone1);

            personalInfoOK = baseComplete && phoneOK;

            summaryEl.innerHTML = `
                <p><span class="font-semibold">Name:</span> ${escapeHtml(info.name || '')}</p>
                <p><span class="font-semibold">Email:</span> ${escapeHtml(info.email || '')}</p>
                <p><span class="font-semibold">Education:</span> ${escapeHtml(info.education_level || '')}</p>
                <p><span class="font-semibold">Phone 1 (primary):</span> ${escapeHtml(phone1 || '(not set)')}</p>
                <p><span class="font-semibold">Phone 2 (secondary):</span> ${escapeHtml(phone2 || 'Not provided')}</p>
            `;

            if (!personalInfoOK) {
                warningEl.classList.remove('hidden');
            } else {
                warningEl.classList.add('hidden');
            }

            // 把当前电话写入隐藏字段，提交时交给 PHP
            if (hiddenPhone1) hiddenPhone1.value = phone1;
            if (hiddenPhone2) hiddenPhone2.value = phone2;

            updateApplyButtonState();
        } catch (e) {
            console.error(e);
            summaryEl.innerHTML =
                '<p class="text-sm text-red-600">Error loading personal information.</p>';
            personalInfoOK = false;
            warningEl.classList.remove('hidden');
            updateApplyButtonState();
        }
    }

    // ===== 3. Resume 摘要 =====
    async function loadSelectedResume() {
        const summaryEl = document.getElementById('resume-summary');
        const warningEl = document.getElementById('resume-warning');
        const resumeIdHidden = document.getElementById('resume_id');

        if (!summaryEl || !warningEl || !resumeIdHidden) return;

        try {
            const res = await fetch('php/get_selected_resume.php');
            const data = await res.json();

            if (!data.success) {
                summaryEl.innerHTML =
                    '<p class="text-sm text-red-600">No default resume selected.</p>';
                warningEl.classList.remove('hidden');
                resumeReady = false;
                resumeIdHidden.value = '';
                updateApplyButtonState();
                return;
            }

            const r = data.resume;
            resumeIdHidden.value = r.resume_id;
            summaryEl.innerHTML = `
                <p><span class="font-semibold">Selected Resume:</span> ${escapeHtml(r.resume_name)}</p>
                <p class="text-xs text-gray-500">Uploaded at: ${escapeHtml(r.created_at)}</p>
            `;
            warningEl.classList.add('hidden');
            resumeReady = true;
            updateApplyButtonState();
        } catch (e) {
            console.error(e);
            summaryEl.innerHTML =
                '<p class="text-sm text-red-600">Error loading resume information.</p>';
            resumeReady = false;
            updateApplyButtonState();
        }
    }

    loadPersonalInfo();
    loadSelectedResume();

    // ===== 4. 提交校验 =====
    if (applyForm) {
        applyForm.addEventListener('submit', function (e) {
            const phone1 = hiddenPhone1 ? hiddenPhone1.value.trim() : '';
            const phone2 = hiddenPhone2 ? hiddenPhone2.value.trim() : '';

            const phonePattern = /^[0-9]{11}$/;
            if (!phonePattern.test(phone1)) {
                e.preventDefault();
                alert('Please set a valid Application Phone 1 (primary) in Personal Information.');
                return;
            }

            if (!personalInfoOK) {
                e.preventDefault();
                alert('Please complete your Personal Information before applying.');
                return;
            }
            if (!resumeReady) {
                e.preventDefault();
                alert('Please select a default resume in Resume Management before applying.');
                return;
            }

            const experience = document.getElementById('experience');
            const salary = document.getElementById('salary');
            const notice = document.getElementById('notice');

            let valid = true;

            if (!experience.value) {
                experience.classList.add('border-red-500');
                valid = false;
            } else {
                experience.classList.remove('border-red-500');
            }

            if (salary.value === '' || isNaN(salary.value) || Number(salary.value) < 0) {
                salary.classList.add('border-red-500');
                valid = false;
            } else {
                salary.classList.remove('border-red-500');
            }

            if (notice.value === '' || isNaN(notice.value) || Number(notice.value) < 0) {
                notice.classList.add('border-red-500');
                valid = false;
            } else {
                notice.classList.remove('border-red-500');
            }

            if (!valid) {
                e.preventDefault();
            }
        });
    }
});

function updateHeroHeader(jobId, jobTitle, companyName, jobDescription) {
    const heroSection = document.getElementById('job-hero');
    if (heroSection) {
        heroSection.innerHTML = `
      <div class="bg-blue-50 rounded-lg p-6 mb-6">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
          <div>
            <h1 class="text-2xl font-bold text-blue-800 mb-2">${escapeHtml(jobTitle)}</h1>
            <p class="text-gray-600">
              Company: <span class="font-semibold">${escapeHtml(companyName)}</span>
            </p>
            <p class="text-gray-600">
              Job ID: <span class="font-mono text-blue-600">#${escapeHtml(jobId)}</span>
            </p>
          </div>
          <div class="mt-4 md:mt-0">
            <a href="dashboard-jobseeker.html"
               class="text-blue-600 hover:text-blue-800 text-sm">← Back to Dashboard</a>
          </div>
        </div>
        <div class="border-t pt-4">
          <h3 class="font-semibold text-gray-700 mb-2">Job Description:</h3>
          <p class="text-gray-600 text-sm">${escapeHtml(jobDescription)}</p>
        </div>
      </div>
    `;
    }
}

