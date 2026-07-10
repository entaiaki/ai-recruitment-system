// jobseeker/scripts/moments.js

document.addEventListener('DOMContentLoaded', () => {
    const momentsListEl = document.getElementById('moments-list');
    const momentForm = document.getElementById('moment-form');

    if (momentsListEl) {
        // 通过 data-mode 判断使用哪种列表
        const mode = momentsListEl.dataset.mode || 'all'; // 'mine' or 'all'
        loadMoments(mode);
    }

    if (momentForm) {
        bindMomentForm(momentForm);
    }
});

// 加载动态列表
async function loadMoments(mode = 'all') {
    const listEl = document.getElementById('moments-list');
    const emptyEl = document.getElementById('moments-empty');
    if (!listEl) return;

    listEl.innerHTML = '<div class="text-sm text-gray-500">Loading moments...</div>';
    if (emptyEl) emptyEl.classList.add('hidden');

    // mine：只看自己的记录；all：看所有用户
    const url = mode === 'mine'
        ? 'php/my_moments_list.php'
        : 'php/moments_list.php';

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!data.ok) {
            listEl.innerHTML =
                `<div class="text-red-500 text-sm">${data.error || 'Failed to load moments.'}</div>`;
            return;
        }

        const moments = data.data || [];
        if (moments.length === 0) {
            listEl.innerHTML = '';
            if (emptyEl) emptyEl.classList.remove('hidden');
            return;
        }

        listEl.innerHTML = '';

        moments.forEach(m => {
            const card = document.createElement('article');
            card.className = 'bg-white rounded-lg shadow p-4';

            const createdAtText = formatDateTime(m.created_at);
            const canDelete = mode === 'mine'; // 只有“我的记录”才显示删除按钮

            let imagesHtml = '';
            if (m.images && m.images.length) {
                imagesHtml = `
                    <div class="mt-2 grid grid-cols-2 gap-2">
                        ${m.images
                        .map(
                            img =>
                                `<img src="../${img}" alt="" class="w-full h-32 object-cover rounded">`
                        )
                        .join('')}
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="flex justify-between items-center mb-2">
                    <div>
                        <div class="font-semibold text-gray-800">
                            ${escapeHtml(m.author_name || 'Unknown')}
                        </div>
                        <div class="text-xs text-gray-500">${createdAtText}</div>
                    </div>
                    ${canDelete
                    ? `<button
                                    class="text-xs text-red-600 hover:underline moment-delete-btn"
                                    data-id="${m.moment_id}">
                                    Delete
                               </button>`
                    : ''
                }
                </div>
                <div class="text-gray-800 whitespace-pre-line text-sm">
                    ${escapeHtml(m.content || '')}
                </div>
                ${imagesHtml}
            `;

            listEl.appendChild(card);
        });

        // 绑定删除按钮事件（只在 mine 模式下存在）
        if (mode === 'mine') {
            bindDeleteButtons();
        }

    } catch (err) {
        console.error(err);
        listEl.innerHTML = `<div class="text-red-500 text-sm">Error loading moments.</div>`;
    }
}

// 绑定删除按钮
function bindDeleteButtons() {
    const buttons = document.querySelectorAll('.moment-delete-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (!id) return;

            if (!confirm('Delete this moment?')) return;

            try {
                const fd = new FormData();
                fd.append('moment_id', id);

                const res = await fetch('php/moment_delete.php', {
                    method: 'POST',
                    body: fd
                });
                const data = await res.json();

                if (!data.ok) {
                    alert(data.error || 'Delete failed.');
                    return;
                }

                // 删除成功后，重新加载“我的”列表
                loadMoments('mine');
            } catch (err) {
                console.error(err);
                alert('Error occurred while deleting.');
            }
        });
    });
}

// 绑定发布表单
function bindMomentForm(form) {
    const statusEl = document.getElementById('moment-form-status');

    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (statusEl) statusEl.textContent = 'Posting...';

        const contentEl = document.getElementById('moment-content');
        const filesEl = document.getElementById('moment-images');
        const content = contentEl.value.trim();

        if (!content) {
            if (statusEl) statusEl.textContent = 'Content cannot be empty.';
            return;
        }

        const fd = new FormData();
        fd.append('content', content);
        if (filesEl && filesEl.files) {
            Array.from(filesEl.files).forEach(file => {
                fd.append('images[]', file);
            });
        }

        try {
            const res = await fetch('php/moment_create.php', {
                method: 'POST',
                body: fd
            });
            const data = await res.json();

            if (!data.ok) {
                if (statusEl) statusEl.textContent = data.error || 'Failed to post.';
                return;
            }

            contentEl.value = '';
            if (filesEl) filesEl.value = '';
            if (statusEl) statusEl.textContent = 'Posted successfully.';

            // 发布后刷新“我的记录”
            const listEl = document.getElementById('moments-list');
            if (listEl && listEl.dataset.mode === 'mine') {
                loadMoments('mine');
            }
        } catch (err) {
            console.error(err);
            if (statusEl) statusEl.textContent = 'Error occurred.';
        }
    });
}

// 时间格式化
function formatDateTime(str) {
    if (!str) return '';
    const d = new Date(str.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return str;
    return d.toLocaleString();
}

// XSS 处理
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


