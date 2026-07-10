// jobseeker/scripts/personal-info.js

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('personal-info-form');
    const msgEl = document.getElementById('pi_message');

    const nameInput = document.getElementById('pi_name');
    const emailInput = document.getElementById('pi_email');
    const eduSelect = document.getElementById('pi_education');
    const phone1Input = document.getElementById('pi_phone1');
    const phone2Input = document.getElementById('pi_phone2');

    // 从后端获取：名字 / 邮箱 / 学历 / 手机号（来自 users_phones）
    async function loadPersonalInfo() {
        try {
            const res = await fetch('php/personal_info_get.php', {
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();

            if (!data.success) {
                msgEl.textContent = data.message || 'Failed to load personal information.';
                msgEl.className = 'text-sm text-red-600';
                return;
            }

            const info = data.data || {};
            nameInput.value = info.name || '';
            emailInput.value = info.email || '';
            eduSelect.value = info.education_level || '';

            // 后端返回 data.phone（主手机号）和 data.phones（数组）
            const phones = Array.isArray(info.phones) ? info.phones : [];
            const primaryPhone = info.phone || phones[0] || '';
            const secondaryPhone = phones[1] || '';

            phone1Input.value = primaryPhone;
            phone2Input.value = secondaryPhone;

        } catch (e) {
            console.error(e);
            msgEl.textContent = 'Error loading personal information.';
            msgEl.className = 'text-sm text-red-600';
        }
    }

    loadPersonalInfo();

    // 保存：把 name / email / education / phone1 / phone2 发给后端
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            msgEl.textContent = '';
            msgEl.className = 'text-sm';

            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const education = eduSelect.value.trim();
            const phone1 = phone1Input.value.trim();
            const phone2 = phone2Input.value.trim();

            let valid = true;
            const phonePattern = /^[0-9]{11}$/;

            // phone1 必须 11 位
            if (!phonePattern.test(phone1)) {
                phone1Input.classList.add('border-red-500');
                valid = false;
            } else {
                phone1Input.classList.remove('border-red-500');
            }

            // phone2 如果填了，也要校验
            if (phone2 && !phonePattern.test(phone2)) {
                phone2Input.classList.add('border-red-500');
                valid = false;
            } else {
                phone2Input.classList.remove('border-red-500');
            }

            if (!name || !email || !education) {
                valid = false;
            }

            if (!valid) {
                msgEl.textContent = 'Please check required fields and phone formats.';
                msgEl.className = 'text-sm text-red-600';
                return;
            }

            try {
                const res = await fetch('php/personal_info_save.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        email,
                        education_level: education,
                        phone1,
                        phone2
                    })
                });

                const data = await res.json();

                if (!data.success) {
                    msgEl.textContent = data.message || 'Failed to save.';
                    msgEl.className = 'text-sm text-red-600';
                    return;
                }

                msgEl.textContent = 'Saved successfully.';
                msgEl.className = 'text-sm text-green-600';

            } catch (err) {
                console.error(err);
                msgEl.textContent = 'Error saving personal information.';
                msgEl.className = 'text-sm text-red-600';
            }
        });
    }
});
