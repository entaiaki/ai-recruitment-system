// recruiter/scripts/recruiter_profile.js

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('recruiterProfileForm');
    const messageBox = document.getElementById('profileMessage');

    // 显示提示信息
    function showMessage(text, type = 'success') {
        if (!messageBox) return;

        messageBox.textContent = text;
        messageBox.classList.remove('hidden');

        // 清除旧的样式
        messageBox.classList.remove(
            'text-red-600', 'bg-red-50', 'border-red-200',
            'text-green-600', 'bg-green-50', 'border-green-200',
            'border', 'px-3', 'py-2', 'rounded'
        );

        messageBox.classList.add('border', 'px-3', 'py-2', 'rounded');

        if (type === 'error') {
            messageBox.classList.add('text-red-600', 'bg-red-50', 'border-red-200');
        } else {
            messageBox.classList.add('text-green-600', 'bg-green-50', 'border-green-200');
        }
    }

    // 加载 recruiter 资料
    function loadProfile() {
        fetch('php/recruiter_profile.php', {
            method: 'GET',
            credentials: 'include' // 用 session cookie
        })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    showMessage(data.message || 'Failed to load profile.', 'error');
                    return;
                }

                const d = data.data || {};

                if (d.real_name !== undefined && d.real_name !== null) {
                    document.getElementById('real_name').value = d.real_name || '';
                }
                if (d.email !== undefined && d.email !== null) {
                    document.getElementById('email').value = d.email || '';
                }
                if (d.education_level !== undefined && d.education_level !== null) {
                    document.getElementById('pi_education').value = d.education_level || '';
                }
                document.getElementById('phone1').value = d.phone1 || '';
                document.getElementById('phone2').value = d.phone2 || '';
            })
            .catch(err => {
                console.error(err);
                showMessage('Error loading profile.', 'error');
            });
    }

    // 保存 recruiter 资料
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();

            const formData = new FormData(form);

            fetch('php/recruiter_profile.php', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showMessage(data.message || 'Profile saved successfully.');
                        // 再次刷新数据，确保显示的是数据库里的
                        loadProfile();
                    } else {
                        showMessage(data.message || 'Failed to save profile.', 'error');
                    }
                })
                .catch(err => {
                    console.error(err);
                    showMessage('Error saving profile.', 'error');
                });
        });
    }

    // 初始化加载
    loadProfile();
});
