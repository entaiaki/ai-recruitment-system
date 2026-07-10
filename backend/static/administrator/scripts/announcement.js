// administrator/scripts/announcement.js

// ====== DOM 引用 ======
const targetTypeSelect = document.getElementById('ann-target-type');
const targetUserWrapper = document.getElementById('target-user-id-wrapper');
const targetUserInput = document.getElementById('ann-target-user-id');
const form = document.getElementById('announcement-form');
const statusSpan = document.getElementById('ann-status');
const listBody = document.getElementById('ann-list');
const reloadBtn = document.getElementById('reload-announcements');

const prevBtn = document.getElementById('ann-prev');
const nextBtn = document.getElementById('ann-next');
const pageInfoSpan = document.getElementById('ann-page-info');

// ====== 分页相关变量 ======
let annData = [];        // 所有公告
let currentPage = 1;     // 当前页
const pageSize = 5;      // ✅ 每页显示 5 条（想改就在这里改）

// ====== URL 初始化（?users_id=xxx 自动填 single_user）======
(function initFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const uid = params.get('users_id');
  if (uid) {
    targetTypeSelect.value = 'single_user';
    targetUserWrapper.classList.remove('hidden');
    targetUserInput.value = uid;
  }
})();

// ====== 选择 single_user 时显示 users_id 输入框 ======
targetTypeSelect.addEventListener('change', () => {
  if (targetTypeSelect.value === 'single_user') {
    targetUserWrapper.classList.remove('hidden');
  } else {
    targetUserWrapper.classList.add('hidden');
    targetUserInput.value = '';
  }
});

// ====== 提交公告 ======
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusSpan.textContent = '';

  const title = document.getElementById('ann-title').value.trim();
  const content = document.getElementById('ann-content').value.trim();
  const target_type = targetTypeSelect.value;
  const target_user_id = target_type === 'single_user'
    ? (targetUserInput.value ? parseInt(targetUserInput.value, 10) : null)
    : null;

  if (!title || !content) {
    statusSpan.textContent = 'Title and content are required.';
    statusSpan.className = 'text-xs text-red-500';
    return;
  }

  if (target_type === 'single_user' && (!target_user_id || isNaN(target_user_id))) {
    statusSpan.textContent = 'Please provide a valid users_id.';
    statusSpan.className = 'text-xs text-red-500';
    return;
  }

  try {
    const res = await fetch('php/send_announcement.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, target_type, target_user_id })
    });
    const json = await res.json();
    if (!json.ok) {
      statusSpan.textContent = json.error || 'Failed to send announcement.';
      statusSpan.className = 'text-xs text-red-500';
      return;
    }

    statusSpan.textContent = 'Announcement sent.';
    statusSpan.className = 'text-xs text-green-600';

    form.reset();
    targetUserWrapper.classList.add('hidden');

    // 重新加载并回到第一页
    await loadAnnouncements();
  } catch (err) {
    console.error(err);
    statusSpan.textContent = 'Network error.';
    statusSpan.className = 'text-xs text-red-500';
  }
});

// ====== 从后端加载公告列表（只负责拿数据 + 调用分页渲染）======
async function loadAnnouncements() {
  listBody.innerHTML = `
      <tr>
        <td colspan="6" class="px-3 py-3 text-center text-xs text-gray-400">
          Loading...
        </td>
      </tr>
    `;

  try {
    const res = await fetch('php/get_announcements.php');
    const json = await res.json();
    if (!json.ok) {
      listBody.innerHTML = `
              <tr>
                <td colspan="6" class="px-3 py-3 text-center text-xs text-red-500">
                  ${json.error || 'Failed to load announcements.'}
                </td>
              </tr>
            `;
      annData = [];
      currentPage = 1;
      updatePaginationInfo();
      return;
    }

    annData = json.data || [];
    currentPage = 1; // 每次加载回到第一页

    if (annData.length === 0) {
      listBody.innerHTML = `
              <tr>
                <td colspan="6" class="px-3 py-3 text-center text-xs text-gray-400">
                  No announcements yet.
                </td>
              </tr>
            `;
      updatePaginationInfo();
      return;
    }

    renderPagedAnnouncements();
  } catch (err) {
    console.error(err);
    listBody.innerHTML = `
          <tr>
            <td colspan="6" class="px-3 py-3 text-center text-xs text-red-500">
              Network error.
            </td>
          </tr>
        `;
    annData = [];
    currentPage = 1;
    updatePaginationInfo();
  }
}

// ====== 渲染当前页的数据 ======
function renderPagedAnnouncements() {
  const total = annData.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = annData.slice(startIndex, startIndex + pageSize);

  listBody.innerHTML = '';

  if (pageItems.length === 0) {
    listBody.innerHTML = `
          <tr>
            <td colspan="6" class="px-3 py-3 text-center text-xs text-gray-400">
              No announcements yet.
            </td>
          </tr>
        `;
    updatePaginationInfo();
    return;
  }

  pageItems.forEach(item => {
    const tr = document.createElement('tr');
    const deleted = item.is_deleted === '1' || item.is_deleted === 1;
    tr.className = deleted ? 'bg-gray-50 text-gray-400' : '';

    const targetLabel = (() => {
      switch (item.target_type) {
        case 'single_user': return `Single user (ID: ${item.target_user_id})`;
        case 'all_jobseekers': return 'All jobseekers';
        case 'all_recruiters': return 'All recruiters';
        case 'all_non_admin': return 'All users (non-admin)';
        default: return item.target_type;
      }
    })();

    tr.innerHTML = `
          <td class="px-3 py-2">${item.announcement_id}</td>
          <td class="px-3 py-2">${item.title}</td>
          <td class="px-3 py-2">${targetLabel}</td>
          <td class="px-3 py-2">${item.created_at}</td>
          <td class="px-3 py-2">
            ${deleted
        ? '<span class="text-xs text-red-500">Deleted</span>'
        : '<span class="text-xs text-green-600">Active</span>'}
          </td>
          <td class="px-3 py-2">
            ${deleted ? '' : `
              <button data-id="${item.announcement_id}"
                      class="delete-ann text-xs text-red-600 hover:text-red-800">
                Delete
              </button>
            `}
          </td>
        `;

    listBody.appendChild(tr);
  });

  // 绑定当前页的删除按钮
  document.querySelectorAll('.delete-ann').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      if (!confirm(`Delete announcement #${id}?`)) return;
      deleteAnnouncement(id);
    });
  });

  updatePaginationInfo();
}

// ====== 更新页码显示 & 按钮状态 ======
function updatePaginationInfo() {
  const total = annData.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (pageInfoSpan) {
    pageInfoSpan.textContent =
      total === 0
        ? 'Page 0 / 0 (Total: 0)'
        : `Page ${currentPage} / ${totalPages} (Total: ${total})`;
  }

  if (prevBtn) {
    const disabled = (currentPage <= 1 || total === 0);
    prevBtn.disabled = disabled;
    prevBtn.classList.toggle('opacity-50', disabled);
    prevBtn.classList.toggle('cursor-not-allowed', disabled);
  }

  if (nextBtn) {
    const disabled = (currentPage >= totalPages || total === 0);
    nextBtn.disabled = disabled;
    nextBtn.classList.toggle('opacity-50', disabled);
    nextBtn.classList.toggle('cursor-not-allowed', disabled);
  }
}

// ====== 删除公告 ======
async function deleteAnnouncement(id) {
  try {
    const res = await fetch('php/delete_announcement.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ announcement_id: id })
    });
    const json = await res.json();
    if (!json.ok) {
      alert(json.error || 'Failed to delete.');
      return;
    }
    // 删除后重新加载
    await loadAnnouncements();
  } catch (err) {
    console.error(err);
    alert('Network error.');
  }
}

// ====== 事件绑定 ======
reloadBtn.addEventListener('click', loadAnnouncements);

if (prevBtn) {
  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderPagedAnnouncements();
    }
  });
}

if (nextBtn) {
  nextBtn.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(annData.length / pageSize));
    if (currentPage < totalPages) {
      currentPage++;
      renderPagedAnnouncements();
    }
  });
}

// ====== 初始化加载 ======
loadAnnouncements();
