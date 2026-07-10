async function loadAppliedJobs() {
    const listEl = document.getElementById('applied-jobs-list');
    const emptyEl = document.getElementById('applied-jobs-empty');

    if (!listEl || !emptyEl) return;

    try {
        // 这里的 URL 你可以根据自己的路由调整
        const res = await fetch('php/apply-job-demonstration.php', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!res.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await res.json(); // 期望是一个数组

        listEl.innerHTML = '';

        if (!Array.isArray(data) || data.length === 0) {
            // 没有记录
            emptyEl.classList.remove('hidden');
            return;
        }

        emptyEl.classList.add('hidden');

        data.forEach((item) => {
            const badgeClass = getStatusBadgeClass(item.application_status);

            const wrapper = document.createElement('div');
            wrapper.className =
                'bg-white p-4 rounded shadow flex flex-col md:flex-row md:items-center md:justify-between';

            wrapper.innerHTML = `
        <div>
          <h3 class="font-semibold text-lg">${escapeHtml(item.job_role)}</h3>
          <p class="text-gray-500 text-sm">
            ${escapeHtml(item.company_name)} &bull; Applied: ${escapeHtml(item.applied_at)}
          </p>
        </div>
        <span class="inline-block px-3 py-1 rounded-full text-xs font-semibold ${badgeClass}">
          ${escapeHtml(item.application_status)}
        </span>
      `;

            listEl.appendChild(wrapper);
        });

    } catch (err) {
        console.error('Failed to load applied jobs:', err);
        emptyEl.textContent = 'Failed to load applied jobs. Please try again later.';
        emptyEl.classList.remove('hidden');
    }
}

// 状态对应不同颜色
function getStatusBadgeClass(status) {
    switch (status) {
        case 'Pending':
            return 'bg-yellow-100 text-yellow-800';
        case 'interviewing':
            return 'bg-blue-100 text-blue-800';
        case 'Accepted':
            return 'bg-green-100 text-green-800';
        case 'Rejected':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

// 简单的 XSS 处理
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 页面加载时先拉一次
document.addEventListener('DOMContentLoaded', () => {
    loadAppliedJobs();
});
