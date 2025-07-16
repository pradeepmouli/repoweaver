// Global state
let currentUser = null;
let repositories = [];
let selectedRepo = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('login-btn').addEventListener('click', login);
    document.getElementById('get-started-btn').addEventListener('click', login);
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('config-form').addEventListener('submit', saveConfiguration);
}

function login() {
    window.location.href = '/auth/login';
}

async function logout() {
    try {
        await fetch('/auth/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('github_token')}`
            }
        });
        
        localStorage.removeItem('github_token');
        currentUser = null;
        showHero();
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

async function checkAuthStatus() {
    const token = localStorage.getItem('github_token');
    if (!token) {
        showHero();
        return;
    }

    try {
        const response = await fetch('/api/user', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            currentUser = await response.json();
            showDashboard();
        } else {
            localStorage.removeItem('github_token');
            showHero();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        showHero();
    }
}

function showHero() {
    document.getElementById('hero').classList.remove('d-none');
    document.getElementById('dashboard').classList.add('d-none');
    document.getElementById('user-info').classList.add('d-none');
    document.getElementById('login-btn').classList.remove('d-none');
}

function showDashboard() {
    document.getElementById('hero').classList.add('d-none');
    document.getElementById('dashboard').classList.remove('d-none');
    document.getElementById('user-info').classList.remove('d-none');
    document.getElementById('login-btn').classList.add('d-none');
    
    // Update user info
    document.getElementById('user-avatar').src = currentUser.avatar_url;
    document.getElementById('user-name').textContent = currentUser.name || currentUser.login;
    
    loadRepositories();
}

async function loadRepositories() {
    const loadingElement = document.getElementById('repositories-loading');
    const listElement = document.getElementById('repositories-list');
    
    loadingElement.style.display = 'block';
    listElement.innerHTML = '';
    
    try {
        const response = await fetch('/api/repositories', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('github_token')}`
            }
        });
        
        if (response.ok) {
            repositories = await response.json();
            renderRepositories();
        } else {
            throw new Error('Failed to load repositories');
        }
    } catch (error) {
        console.error('Failed to load repositories:', error);
        listElement.innerHTML = '<div class="alert alert-danger">Failed to load repositories</div>';
    } finally {
        loadingElement.style.display = 'none';
    }
}

function renderRepositories() {
    const listElement = document.getElementById('repositories-list');
    
    if (repositories.length === 0) {
        listElement.innerHTML = '<div class="alert alert-info">No repositories found</div>';
        return;
    }
    
    listElement.innerHTML = repositories.map(repo => `
        <div class="repo-card ${selectedRepo === repo.full_name ? 'border-primary' : ''}" 
             onclick="selectRepository('${repo.full_name}')">
            <h6>${repo.name}</h6>
            <small class="text-muted">${repo.full_name}</small>
            ${repo.private ? '<i class="fas fa-lock text-warning ms-2"></i>' : ''}
        </div>
    `).join('');
}

async function selectRepository(fullName) {
    selectedRepo = fullName;
    document.getElementById('selected-repo').textContent = fullName;
    document.getElementById('repository-config').classList.remove('d-none');
    document.getElementById('welcome-message').classList.add('d-none');
    
    renderRepositories(); // Update selection highlight
    
    // Load repository configuration
    await loadRepositoryConfig(fullName);
}

async function loadRepositoryConfig(fullName) {
    try {
        const [owner, repo] = fullName.split('/');
        const response = await fetch(`/api/repositories/${owner}/${repo}/config`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('github_token')}`
            }
        });
        
        if (response.ok) {
            const config = await response.json();
            populateConfigForm(config);
        }
    } catch (error) {
        console.error('Failed to load repository config:', error);
    }
}

function populateConfigForm(config) {
    const form = document.getElementById('config-form');
    
    // Clear existing templates
    const templatesContainer = document.getElementById('templates-container');
    templatesContainer.innerHTML = '';
    
    // Add templates
    if (config.templates && config.templates.length > 0) {
        config.templates.forEach(template => {
            addTemplateInput(template);
        });
    } else {
        addTemplateInput('');
    }
    
    // Set other fields
    form.elements['mergeStrategy'].value = config.mergeStrategy || 'merge';
    form.elements['autoUpdate'].checked = config.autoUpdate !== false;
    form.elements['excludePatterns'].value = (config.excludePatterns || []).join(', ');
}

function addTemplate() {
    addTemplateInput('');
}

function addTemplateInput(value) {
    const templatesContainer = document.getElementById('templates-container');
    const div = document.createElement('div');
    div.className = 'input-group mb-2';
    
    div.innerHTML = `
        <input type="text" class="form-control" placeholder="https://github.com/owner/template.git" 
               name="template" value="${value}">
        <button class="btn btn-outline-danger" type="button" onclick="removeTemplate(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    templatesContainer.appendChild(div);
}

function removeTemplate(button) {
    const templatesContainer = document.getElementById('templates-container');
    if (templatesContainer.children.length > 1) {
        button.parentElement.remove();
    }
}

async function saveConfiguration(event) {
    event.preventDefault();
    
    if (!selectedRepo) return;
    
    const form = event.target;
    const formData = new FormData(form);
    
    const templates = Array.from(form.elements['template'])
        .map(input => input.value.trim())
        .filter(value => value);
    
    const excludePatterns = formData.get('excludePatterns')
        .split(',')
        .map(pattern => pattern.trim())
        .filter(pattern => pattern);
    
    const config = {
        templates,
        mergeStrategy: formData.get('mergeStrategy'),
        excludePatterns,
        autoUpdate: formData.get('autoUpdate') === 'on'
    };
    
    try {
        const [owner, repo] = selectedRepo.split('/');
        const response = await fetch(`/api/repositories/${owner}/${repo}/config`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('github_token')}`
            },
            body: JSON.stringify(config)
        });
        
        if (response.ok) {
            showAlert('Configuration saved successfully!', 'success');
        } else {
            throw new Error('Failed to save configuration');
        }
    } catch (error) {
        console.error('Failed to save configuration:', error);
        showAlert('Failed to save configuration', 'danger');
    }
}

async function bootstrapRepository() {
    if (!selectedRepo) return;
    
    const config = getFormConfig();
    
    try {
        const [owner, repo] = selectedRepo.split('/');
        const response = await fetch(`/api/repositories/${owner}/${repo}/bootstrap`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('github_token')}`
            },
            body: JSON.stringify(config)
        });
        
        if (response.ok) {
            const result = await response.json();
            showResults('Bootstrap', result);
        } else {
            throw new Error('Bootstrap failed');
        }
    } catch (error) {
        console.error('Bootstrap failed:', error);
        showAlert('Bootstrap failed', 'danger');
    }
}

async function updateRepository() {
    if (!selectedRepo) return;
    
    const config = getFormConfig();
    
    try {
        const [owner, repo] = selectedRepo.split('/');
        const response = await fetch(`/api/repositories/${owner}/${repo}/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('github_token')}`
            },
            body: JSON.stringify(config)
        });
        
        if (response.ok) {
            const result = await response.json();
            showResults('Update', result);
        } else {
            throw new Error('Update failed');
        }
    } catch (error) {
        console.error('Update failed:', error);
        showAlert('Update failed', 'danger');
    }
}

function getFormConfig() {
    const form = document.getElementById('config-form');
    const formData = new FormData(form);
    
    const templates = Array.from(form.elements['template'])
        .map(input => input.value.trim())
        .filter(value => value)
        .map(url => ({
            url,
            name: extractRepoName(url),
            branch: 'main'
        }));
    
    const excludePatterns = formData.get('excludePatterns')
        .split(',')
        .map(pattern => pattern.trim())
        .filter(pattern => pattern);
    
    return {
        templates,
        mergeStrategy: formData.get('mergeStrategy'),
        excludePatterns
    };
}

function extractRepoName(url) {
    const match = url.match(/\/([^\/]+?)(?:\.git)?$/);
    return match ? match[1] : 'unknown';
}

function showResults(operation, result) {
    const modal = new bootstrap.Modal(document.getElementById('resultsModal'));
    const content = document.getElementById('results-content');
    
    let html = `
        <div class="alert alert-${result.success ? 'success' : 'danger'}">
            <h5>${operation} ${result.success ? 'Successful' : 'Failed'}</h5>
            <p>Repository: ${result.repositoryPath}</p>
            <p>Total files processed: ${result.totalFilesProcessed}</p>
        </div>
    `;
    
    if (result.templateResults && result.templateResults.length > 0) {
        html += '<h6>Template Results:</h6>';
        result.templateResults.forEach(tr => {
            html += `
                <div class="card mb-2">
                    <div class="card-body">
                        <h6 class="card-title">${tr.template.name}</h6>
                        <p class="card-text">
                            Files processed: ${tr.filesProcessed}<br>
                            Status: ${tr.success ? 'Success' : 'Failed'}
                            ${tr.pullRequestNumber ? `<br>Pull Request: #${tr.pullRequestNumber}` : ''}
                        </p>
                        ${tr.errors.length > 0 ? `
                            <div class="alert alert-warning">
                                <strong>Errors:</strong>
                                <ul class="mb-0">
                                    ${tr.errors.map(error => `<li>${error}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
    }
    
    if (result.errors && result.errors.length > 0) {
        html += `
            <div class="alert alert-danger">
                <strong>Errors:</strong>
                <ul class="mb-0">
                    ${result.errors.map(error => `<li>${error}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    content.innerHTML = html;
    modal.show();
}

function showAlert(message, type) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// Handle OAuth callback
if (window.location.pathname === '/auth/callback') {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        fetch(`/auth/callback?code=${code}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    localStorage.setItem('github_token', data.user.access_token);
                    currentUser = data.user;
                    window.location.href = '/';
                } else {
                    showAlert('Authentication failed', 'danger');
                }
            })
            .catch(error => {
                console.error('Auth callback failed:', error);
                showAlert('Authentication failed', 'danger');
            });
    }
}