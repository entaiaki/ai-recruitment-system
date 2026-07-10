// scripts/resume-management.js

document.addEventListener('DOMContentLoaded', () => {
    // Header/Footer loader
    fetch('../header.html').then(res => res.text()).then(data => {
        document.getElementById('header').innerHTML = data;
    });
    fetch('../footer.html').then(res => res.text()).then(data => {
        document.getElementById('footer').innerHTML = data;
        if (window.loadRuntime) {
            window.loadRuntime();
        }
    });

    const tbody = document.getElementById('resume-table-body');
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('image-modal-img');
    const modalClose = document.getElementById('image-modal-close');

    async function loadResumes() {
        try {
            const res = await fetch('php/resumes_api.php?action=list');
            const data = await res.json();

            if (!data.success) {
                alert(data.message || 'Failed to load resumes');
                return;
            }

            tbody.innerHTML = '';

            data.resumes.forEach(resume => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50';

                tr.innerHTML = `
                    <td class="px-4 py-3 text-center">
                        <input type="radio"
                               name="selected-resume"
                               value="${resume.resume_id}"
                               class="h-4 w-4 text-blue-600 focus:ring-blue-500"
                               ${Number(resume.is_selected) === 1 ? 'checked' : ''}>
                    </td>
                    <td class="px-4 py-3">
                        <div class="font-medium text-gray-900">${resume.resume_name}</div>
                    </td>
                    <td class="px-4 py-3 text-gray-500">
                        ${resume.created_at}
                    </td>
                    <td class="px-4 py-3 text-center">
                        <div class="inline-flex items-center space-x-2">
                            <button
                                class="btn-view-resume inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded border border-gray-400 text-gray-700 hover:bg-gray-50"
                                data-image-url="php/resume_image.php?id=${resume.resume_id}">
                                View
                            </button>
                            <button
                                class="btn-delete-resume inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded border border-red-500 text-red-600 hover:bg-red-50"
                                data-id="${resume.resume_id}">
                                Delete
                            </button>
                        </div>
                    </td>
                `;

                tbody.appendChild(tr);
            });

            bindRowEvents();
        } catch (e) {
            console.error(e);
            alert('Error loading resumes');
        }
    }

    function bindRowEvents() {
        // 选中单选框 -> 更新 is_eclected
        document.querySelectorAll('input[name="selected-resume"]').forEach(radio => {
            radio.addEventListener('change', async () => {
                const resumeId = radio.value;
                const formData = new URLSearchParams();
                formData.append('action', 'select');
                formData.append('resume_id', resumeId);

                try {
                    const res = await fetch('php/resumes_api.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: formData.toString()
                    });
                    const data = await res.json();
                    if (!data.success) {
                        alert(data.message || 'Failed to set selected resume');
                    }
                } catch (e) {
                    console.error(e);
                    alert('Error selecting resume');
                }
            });
        });

        // View
        document.querySelectorAll('.btn-view-resume').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.dataset.imageUrl;
                if (!url) {
                    alert('No image URL configured for this resume.');
                    return;
                }
                modalImg.src = url;
                modal.classList.remove('hidden');
            });
        });


        // Delete
        document.querySelectorAll('.btn-delete-resume').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (!confirm('Are you sure you want to delete this resume?')) return;

                const formData = new URLSearchParams();
                formData.append('action', 'delete');
                formData.append('resume_id', id);

                try {
                    const res = await fetch('php/resumes_api.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: formData.toString()
                    });
                    const data = await res.json();
                    if (!data.success) {
                        alert(data.message || 'Delete failed');
                        return;
                    }
                    loadResumes();
                } catch (e) {
                    console.error(e);
                    alert('Error deleting resume');
                }
            });
        });
    }

    // Create：你之后可以改成跳上传页或弹窗
    const createBtn = document.getElementById('btn-create-resume');
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            // 示例：跳到上传简历的页面
            window.location.href = 'php/upload_resume.php';
        });
    }

    // 图片预览弹框
    if (modal && modalImg && modalClose) {
        modalClose.addEventListener('click', () => {
            modal.classList.add('hidden');
            modalImg.src = '';
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                modalImg.src = '';
            }
        });
    }

    // 首次加载
    loadResumes();
});
