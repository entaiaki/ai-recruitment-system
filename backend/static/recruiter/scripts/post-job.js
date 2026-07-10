document.addEventListener('DOMContentLoaded', function () {
  // Tom Select initialization (already handled in HTML)
  // recruiter/scripts/post-job.js
  const form = document.querySelector('form'); //用 document.querySelector('form') 找到页面中的第一个表单元素
  if (!form) return;

  form.addEventListener('submit', function (e) { //当表单被提交时（点击“提交”按钮或按回车），会执行这个函数。
    e.preventDefault();

    // Gather form data
    const company = document.getElementById('company').value.trim(); //.trim() 去掉首尾空格
    const role = document.getElementById('role').value.trim();
    const locationSelect = document.getElementById('location');
    const locations = Array.from(locationSelect.selectedOptions).map(opt => opt.value); //Array.from(...).map(...) 把它们转换成一个字符串数组（比如 ["Beijing", "Shanghai"]）。
    const vacancies = document.getElementById('vacancies').value.trim();
    const experience = document.getElementById('experience').value;
    const jobType = document.getElementById('jobtype').value;
    const salaryMin = document.getElementById('salary_min').value.trim();
    const salaryMax = document.getElementById('salary_max').value.trim();
    const description = document.getElementById('description').value.trim();

    // Generate unique job ID (e.g., JOB + timestamp + random)生成类似 JOB1731408449453284 的唯一 ID。Date.now() 是当前时间戳，Math.random() 生成随机数，拼在一起避免重复。
    const jobId = 'JOB' + Date.now() + Math.floor(Math.random() * 1000);
    // Date/time of posting
    const postedAt = new Date().toISOString(); //获取当前日期时间，并转成标准 ISO 格式（例如 "2025-11-12T12:34:56.789Z"）

    // 构建职位对象
    const jobData = {
      jobId,
      company,
      role,
      locations,
      vacancies: vacancies ? Number(vacancies) : null, //转换为数字，如果为空则为 null
      experience,
      jobType,
      salaryRange: `₹${Number(salaryMin).toLocaleString()} – ₹${Number(salaryMax).toLocaleString()} per annum`,
      description,
      postedAt
    };

    // 在控制台打印整个职位对象；
    // 弹出提示框告诉用户“职位已发布”；
    // 最后重置表单（清空所有输入）。
    console.log('Job Posted:', jobData);
    alert('Job posted! (Check console for job data)');
    form.reset();

    // Optionally, redirect to dashboard or clear Tom Select
    if (window.TomSelect && locationSelect.tomselect) {
      locationSelect.tomselect.clear();
    }
  });
}); 