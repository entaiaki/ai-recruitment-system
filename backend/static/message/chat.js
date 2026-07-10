// /message/chat.js
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-chat');
    if (!btn) return;

    const jobId = btn.dataset.job_id;
    const jobTitle = btn.dataset.job_role || '';
    const companyName = btn.dataset.company_name || '';
    const otherUserId = btn.dataset.other_user_id || '';

    const params = new URLSearchParams({
        job_id: jobId,
        job_title: jobTitle,
        company: companyName,
        other_user_id: otherUserId
    });

    window.location.href = `../message/chat-with-hr.html?${params.toString()}`;
});

