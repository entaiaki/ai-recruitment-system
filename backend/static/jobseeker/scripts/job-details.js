// Job Details Page JS

document.addEventListener('DOMContentLoaded', function () {
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get('jobId') || 'JOB12345';
  const jobRole = urlParams.get('jobRole') || 'Frontend Developer';  // 用 jobRole 这个名字更直观
  const companyName = urlParams.get('companyName') || 'Acme Corp';
  const location = urlParams.get('location') || 'Remote';
  const experience = urlParams.get('experienceRequired') || '2+ years';
  const jobType = urlParams.get('jobType') || 'Full Time';
  const salary = urlParams.get('salary') || '₹6,00,000 – ₹10,00,000 per annum';
  const jobDescription = urlParams.get('jobDescription') || 'We are looking for a skilled Frontend Developer to join our team.';


  // Hero section
  const hero = document.getElementById('job-details-hero');
  if (hero) {
    hero.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <h1 class="text-3xl font-bold text-blue-800 mb-2">${jobRole}</h1>
          <p class="text-gray-600">Company: <span class="font-semibold">${companyName}</span></p>
          <p class="text-gray-600">Job ID: <span class="font-mono text-blue-600">#${jobId}</span></p>
        </div>
        <div class="mt-4 md:mt-0">
          <a href="dashboard-jobseeker.html" class="text-blue-600 hover:text-blue-800 text-sm">← Back to Dashboard</a>
        </div>
      </div>
    `;
  }

  // Details section
  const content = document.getElementById('job-details-content');
  if (content) {
    content.innerHTML = `
      <div class="flex flex-wrap gap-4 mb-4 text-gray-600 text-sm">
        <span class="inline-block bg-blue-50 px-3 py-1 rounded">Location: <span class="font-semibold">${location}</span></span>
        <span class="inline-block bg-blue-50 px-3 py-1 rounded">Experience: <span class="font-semibold">${experience}</span></span>
        <span class="inline-block bg-blue-50 px-3 py-1 rounded">Job Type: <span class="font-semibold">${jobType}</span></span>
        <span class="inline-block bg-blue-50 px-3 py-1 rounded">Salary: <span class="font-semibold">${salary}</span></span>
      </div>
      <h2 class="text-lg font-semibold text-gray-700 mb-2">Job Description</h2>
      <p class="mb-6 text-gray-700">${jobDescription}</p>
    `;
  }

  // 设置“立即申请”按钮的链接，传递必要的参数通过 URL，后续通过const urlParams = new URLSearchParams(window.location.search); 接收
  const applyBtn = document.getElementById('apply-now-btn');
  if (applyBtn) {
    const params = new URLSearchParams({
      jobId: jobId,
      jobRole: jobRole,
      companyName: companyName,
      jobDescription: jobDescription
    });
    applyBtn.href = `apply-job.html?${params.toString()}`;
  }
}); 