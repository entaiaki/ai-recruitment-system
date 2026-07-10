// administrator/scripts/user-management.js — adapted for FastAPI backend
window.UM = { currentPage: 1, pageSize: 10 };

document.addEventListener('DOMContentLoaded', function () {
  UM.userList = []; UM.currentAdmin = null;
  // Get current admin info
  API.get('/api/users/me').then(function (u) {
    UM.currentAdmin = u;
    document.getElementById('currentAdminInfo').textContent = 'Logged in as: ' + u.full_name + ' (' + u.role + ')';
    document.getElementById('currentAdminInfo').classList.remove('hidden');
    loadUsers();
  }).catch(function () { window.location.href = '/login.html'; });

  document.getElementById('logoutBtn').addEventListener('click', function () { API.logout(); });
  document.getElementById('searchBtn').addEventListener('click', function () { UM.currentPage = 1; loadUsers(); });
  document.getElementById('searchInput').addEventListener('keyup', function (e) { if (e.key === 'Enter') { UM.currentPage = 1; loadUsers(); } });
  document.getElementById('roleFilter').addEventListener('change', function () { UM.currentPage = 1; loadUsers(); });
  document.getElementById('addAdminBtn').addEventListener('click', openFormModal);
  document.getElementById('closeFormModal').addEventListener('click', closeFormModal);
  document.getElementById('cancelAdminForm').addEventListener('click', closeFormModal);
  document.getElementById('closeDetailBtn').addEventListener('click', closeDetailModal);
  document.getElementById('detailCloseBottom').addEventListener('click', closeDetailModal);
  document.getElementById('adminForm').addEventListener('submit', submitForm);
  document.getElementById('deleteUserBtn').addEventListener('click', deleteUser);
});

function loadUsers() {
  API.get('/api/users').then(function (users) {
    // Apply filters client-side
    var q = (document.getElementById('searchInput').value || '').trim().toLowerCase();
    var rf = document.getElementById('roleFilter').value;
    var filtered = users.filter(function (u) {
      if (rf !== 'all' && u.role !== rf) return false;
      if (q && !(u.full_name || '').toLowerCase().includes(q) && !(u.email || '').toLowerCase().includes(q) && !(u.department || '').toLowerCase().includes(q)) return false;
      return true;
    });
    UM.userList = filtered;
    renderTable();
  });
}

function renderTable() {
  var tbody = document.getElementById('userTableBody');
  var start = (UM.currentPage - 1) * UM.pageSize;
  var page = UM.userList.slice(start, start + UM.pageSize);
  if (!page.length) { tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-gray-400">No users found</td></tr>'; renderPagination(); return; }
  tbody.innerHTML = page.map(function (u) {
    var roleBadge = { admin: 'bg-purple-100 text-purple-700', hr: 'bg-blue-100 text-blue-700', dept_leader: 'bg-green-100 text-green-700', guest: 'bg-gray-100 text-gray-600' }[u.role] || 'bg-gray-100 text-gray-600';
    return '<tr class="hover:bg-gray-50 cursor-pointer" onclick="showDetail(' + u.id + ')">' +
      '<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">' + esc(u.id) + '</td>' +
      '<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">' + esc(u.full_name) + '</td>' +
      '<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">' + esc(u.email) + '</td>' +
      '<td class="px-6 py-4 whitespace-nowrap text-sm"><span class="px-2 py-1 text-xs rounded-full ' + roleBadge + '">' + esc(u.role) + '</span></td>' +
      '<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">' + esc(u.department) + '</td>' +
      '<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">' + (u.is_active ? '<span class="text-green-600">Active</span>' : '<span class="text-red-600">Disabled</span>') + '</td></tr>';
  }).join('');
  renderPagination();
}

function renderPagination() {
  var total = Math.ceil(UM.userList.length / UM.pageSize) || 1;
  var html = '';
  for (var i = 1; i <= total; i++) {
    html += '<button onclick="UM.currentPage=' + i + ';renderTable()" class="px-3 py-1 rounded ' + (i === UM.currentPage ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600') + ' text-sm">' + i + '</button>';
  }
  document.getElementById('pagination').innerHTML = html;
}

function showDetail(uid) {
  var u = UM.userList.find(function (x) { return x.id === uid; });
  if (!u) return;
  document.getElementById('detailName').textContent = u.full_name;
  document.getElementById('detailEmail').textContent = u.email;
  document.getElementById('detailRole').textContent = u.role;
  document.getElementById('detailDept').textContent = u.department || '—';
  document.getElementById('detailActive').textContent = u.is_active ? 'Active' : 'Disabled';
  document.getElementById('detailCreated').textContent = u.created_at ? u.created_at.slice(0, 10) : '—';
  document.getElementById('detailModal').classList.remove('hidden');
  document.getElementById('detailModal').classList.add('flex');
}

function closeDetailModal() {
  document.getElementById('detailModal').classList.add('hidden');
  document.getElementById('detailModal').classList.remove('flex');
}

function openFormModal() {
  document.getElementById('adminForm').reset();
  document.getElementById('formModal').classList.remove('hidden');
  document.getElementById('formModal').classList.add('flex');
}

function closeFormModal() {
  document.getElementById('formModal').classList.add('hidden');
  document.getElementById('formModal').classList.remove('flex');
}

function submitForm(e) {
  e.preventDefault();
  var data = {
    full_name: document.getElementById('formFullName').value.trim(),
    email: document.getElementById('formEmail').value.trim(),
    password: document.getElementById('formPassword').value,
    role: document.getElementById('formRole').value,
    department: document.getElementById('formDepartment').value.trim() || null
  };
  if (!data.full_name || !data.email || !data.password) return alert('Name, email and password are required.');
  API.post('/api/users', data).then(function () {
    closeFormModal();
    loadUsers();
  }).catch(function (e) { alert('Failed: ' + e.message); });
}

function deleteUser() {
  var detailId = document.getElementById('detailName').textContent;
  var u = UM.userList.find(function (x) { return x.full_name === detailId; });
  if (!u) return;
  var confirmed = confirm('Delete user ' + u.full_name + ' (' + u.email + ')?');
  if (!confirmed) return;
  API.del('/api/users/' + u.id).then(function () {
    closeDetailModal();
    loadUsers();
  }).catch(function (e) { alert('Delete failed: ' + e.message); });
}

function esc(s) { return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;') : ''; }
