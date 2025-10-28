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
    // Redirect to GitHub OAuth flow
    window.location.href = '/auth/github';
}

async function logout() {
    try {
        await fetch('/auth/logout', {
            method: 'POST',
            credentials: 'include' // Include session cookie
        });
        
        currentUser = null;
        showHero();
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

async function checkAuthStatus() {
    try {
        const response = await fetch('/api/installations', {
            credentials: 'include' // Include session cookie
        });

        if (response.ok) {
            // User is authenticated
            const installations = await response.json();
            currentUser = { installations }; // We'll update this when we have a /api/user endpoint
            showDashboard();
        } else {
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
    
    // Update user info (we'll need to add a /api/user endpoint or fetch from GitHub directly)
    // For now, we'll just show basic info
    if (currentUser) {
        // We'll fetch user info from GitHub via our API in loadRepositories
    }
    
    loadRepositories();
}

async function loadRepositories() {
    const loadingElement = document.getElementById('repositories-loading');
    const listElement = document.getElementById('repositories-list');
    
    loadingElement.style.display = 'block';
    listElement.innerHTML = '';
    
    try {
        const response = await fetch('/api/repositories', {
            credentials: 'include' // Use session cookie
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
    
    // Load recent jobs and PRs
    loadRecentJobs();
    loadRecentPRs();
}

async function loadRepositoryConfig(fullName) {
    try {
        const [owner, repo] = fullName.split('/');
        const response = await fetch(`/api/repositories/${owner}/${repo}/config`, {
            credentials: 'include' // Use session cookie
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
    form.elements['mergeStrategy'].value = config.merge_strategy || 'merge';
    form.elements['autoUpdate'].checked = config.auto_update !== false;
    form.elements['excludePatterns'].value = (config.exclude_patterns || []).join(', ');
    
    // Initialize drag-and-drop after templates are added
    initializeSortable();
}

// Initialize SortableJS for drag-and-drop template reordering
let sortableInstance = null;

function initializeSortable() {
    const templatesContainer = document.getElementById('templates-container');
    if (templatesContainer && !sortableInstance) {
        sortableInstance = Sortable.create(templatesContainer, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag'
        });
    }
}

function addTemplate() {
    addTemplateInput('');
}

function addTemplateInput(value) {
    const templatesContainer = document.getElementById('templates-container');
    const div = document.createElement('div');
    div.className = 'input-group mb-2 template-item';
    
    div.innerHTML = `
        <span class="input-group-text drag-handle" style="cursor: move;">
            <i class="fas fa-grip-vertical"></i>
        </span>
        <input type="text" class="form-control template-url-input" placeholder="https://github.com/owner/template.git" 
               name="template" value="${value}" onblur="validateTemplateUrl(this)">
        <button class="btn btn-outline-primary" type="button" onclick="validateTemplateUrl(this.previousElementSibling)">
            <i class="fas fa-check"></i> Validate
        </button>
        <button class="btn btn-outline-danger" type="button" onclick="removeTemplate(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    templatesContainer.appendChild(div);
    
    // Reinitialize sortable if it exists
    if (sortableInstance) {
        sortableInstance.destroy();
        sortableInstance = null;
        initializeSortable();
    }
}

function removeTemplate(button) {
    const templatesContainer = document.getElementById('templates-container');
    if (templatesContainer.children.length > 1) {
        button.parentElement.remove();
    } else {
        showAlert('At least one template is required', 'warning');
    }
}

// Validate template URL
async function validateTemplateUrl(input) {
    const url = input.value.trim();
    if (!url) return;
    
    // Basic format validation
    const urlPattern = /^https?:\/\/github\.com\/[\w-]+\/[\w.-]+(\.git)?$/;
    if (!urlPattern.test(url)) {
        input.classList.remove('is-valid');
        input.classList.add('is-invalid');
        showAlert('Invalid GitHub repository URL format', 'warning');
        return;
    }
    
    if (!selectedRepo) {
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
        return;
    }
    
    // Server-side validation
    try {
        const [owner, repo] = selectedRepo.split('/');
        const response = await fetch(`/api/repositories/${owner}/${repo}/validate-template`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ template_url: url })
        });
        
        const result = await response.json();
        
        if (result.valid) {
            input.classList.remove('is-invalid');
            input.classList.add('is-valid');
        } else {
            input.classList.remove('is-valid');
            input.classList.add('is-invalid');
            showAlert(result.error || 'Template repository is not accessible', 'warning');
        }
    } catch (error) {
        console.error('Failed to validate template:', error);
        input.classList.remove('is-valid');
        input.classList.add('is-invalid');
        showAlert('Failed to validate template repository', 'danger');
    }
}

async function saveConfiguration(event) {
    event.preventDefault();
    
    if (!selectedRepo) return;
    
    const form = event.target;
    const formData = new FormData(form);
    
    // Get all template inputs
    const templates = Array.from(form.elements['template'])
        .map(input => input.value.trim())
        .filter(value => value);
    
    // Validate templates
    if (templates.length === 0) {
        showAlert('Please add at least one template repository', 'warning');
        return;
    }
    
    // Get exclude patterns
    const excludePatternsValue = formData.get('excludePatterns');
    const excludePatterns = excludePatternsValue
        ? excludePatternsValue.split(',').map(pattern => pattern.trim()).filter(pattern => pattern)
        : [];
    
    const config = {
        templates,
        merge_strategy: formData.get('mergeStrategy'),
        exclude_patterns: excludePatterns,
        auto_update: formData.get('autoUpdate') === 'on'
    };
    
    try {
        const [owner, repo] = selectedRepo.split('/');
        const response = await fetch(`/api/repositories/${owner}/${repo}/config`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(config)
        });
        
        if (response.ok) {
            showAlert('Configuration saved successfully!', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save configuration');
        }
    } catch (error) {
        console.error('Failed to save configuration:', error);
        showAlert(error.message || 'Failed to save configuration', 'danger');
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
                'Content-Type': 'application/json'
            },
            credentials: 'include', // Use session cookie
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
                'Content-Type': 'application/json'
            },
            credentials: 'include', // Use session cookie
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

// Apply templates with optional preview
async function applyTemplates(preview = false) {
    if (!selectedRepo) return;

    const [owner, repo] = selectedRepo.split('/');

    try {
        const response = await fetch(`/api/repositories/${owner}/${repo}/apply-templates`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ preview })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to trigger template application');
        }

        const result = await response.json();

        if (preview) {
            // Start polling for preview results
            startJobPolling(result.job_id, true);
        } else {
            // Start polling for job status
            startJobPolling(result.job_id, false);
        }
    } catch (error) {
        console.error('Failed to apply templates:', error);
        showAlert(error.message || 'Failed to trigger template application', 'danger');
    }
}

// Poll job status
let pollingInterval = null;
async function startJobPolling(jobId, isPreview) {
    const progressDiv = document.getElementById('job-progress');
    const statusText = document.getElementById('job-status-text');
    const progressBar = document.getElementById('job-progress-bar');
    const detailsDiv = document.getElementById('job-details');
    const errorDiv = document.getElementById('job-error');

    progressDiv.classList.remove('d-none');
    errorDiv.classList.add('d-none');
    
    statusText.textContent = isPreview ? 'Preview' : 'Template Application';
    progressBar.style.width = '10%';

    // Stop any existing polling
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }

    pollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/jobs/${jobId}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch job status');
            }

            const job = await response.json();

            // Update progress bar based on status
            if (job.status === 'pending') {
                progressBar.style.width = '30%';
                detailsDiv.textContent = 'Waiting to start...';
            } else if (job.status === 'running') {
                progressBar.style.width = '60%';
                detailsDiv.textContent = 'Processing templates...';
            } else if (job.status === 'completed') {
                progressBar.style.width = '100%';
                progressBar.classList.remove('progress-bar-animated');
                clearInterval(pollingInterval);
                pollingInterval = null;

                if (isPreview) {
                    // Show preview modal
                    showPreviewResults(job);
                } else {
                    detailsDiv.innerHTML = '<div class="alert alert-success"><i class="fas fa-check-circle"></i> Template application completed successfully!</div>';
                    // Refresh PRs and jobs list
                    loadRecentPRs();
                    loadRecentJobs();
                }
            } else if (job.status === 'failed') {
                progressBar.style.width = '100%';
                progressBar.classList.remove('progress-bar-animated');
                progressBar.classList.add('bg-danger');
                clearInterval(pollingInterval);
                pollingInterval = null;

                errorDiv.classList.remove('d-none');
                errorDiv.textContent = `Error: ${job.error_message || 'Unknown error occurred'}`;
            }
        } catch (error) {
            console.error('Failed to poll job status:', error);
            clearInterval(pollingInterval);
            pollingInterval = null;
            errorDiv.classList.remove('d-none');
            errorDiv.textContent = 'Failed to fetch job status';
        }
    }, 2000); // Poll every 2 seconds
}

// Show preview results in modal
function showPreviewResults(job) {
    const modal = new bootstrap.Modal(document.getElementById('previewModal'));
    const content = document.getElementById('preview-content');
    
    // Job result should contain preview data
    const previewData = job.result;
    
    if (!previewData || !previewData.preview) {
        content.innerHTML = '<div class="alert alert-warning">No preview data available</div>';
        modal.show();
        return;
    }

    let html = '';
    
    for (const templateResult of previewData.results) {
        html += `
            <div class="mb-4">
                <h6><i class="fas fa-folder"></i> ${templateResult.template}</h6>
                <div class="row g-2 mb-2">
                    <div class="col-md-4">
                        <div class="card text-center">
                            <div class="card-body">
                                <h5 class="text-success">${templateResult.filesAdded.length}</h5>
                                <small>Files to Add</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card text-center">
                            <div class="card-body">
                                <h5 class="text-primary">${templateResult.filesModified.length}</h5>
                                <small>Files to Modify</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card text-center">
                            <div class="card-body">
                                <h5 class="text-warning">${templateResult.filesWithConflicts.length}</h5>
                                <small>Files with Conflicts</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${templateResult.changes.length > 0 ? `
                <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>File</th>
                                <th>Action</th>
                                <th>Size</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${templateResult.changes.map(change => `
                                <tr>
                                    <td><code>${change.path}</code></td>
                                    <td>
                                        <span class="badge bg-${change.action === 'add' ? 'success' : change.action === 'modify' ? 'primary' : 'secondary'}">
                                            ${change.action}
                                        </span>
                                    </td>
                                    <td>${(change.size / 1024).toFixed(2)} KB</td>
                                    <td>
                                        ${change.hasConflicts ? '<span class="badge bg-warning">Has Conflicts</span>' : '<span class="badge bg-success">OK</span>'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                ` : '<p class="text-muted">No changes</p>'}
                
                ${templateResult.errors.length > 0 ? `
                <div class="alert alert-warning mt-2">
                    <strong>Warnings:</strong>
                    <ul class="mb-0">
                        ${templateResult.errors.map(err => `<li>${err}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
            </div>
        `;
    }
    
    content.innerHTML = html;
    
    // Set up confirm button
    document.getElementById('confirm-apply-btn').onclick = () => {
        modal.hide();
        applyTemplates(false); // Actually apply without preview
    };
    
    modal.show();
}

// Load recent jobs
async function loadRecentJobs() {
    if (!selectedRepo) return;

    const [owner, repo] = selectedRepo.split('/');
    const jobsDiv = document.getElementById('recent-jobs');
    const jobsList = document.getElementById('jobs-list');

    try {
        const response = await fetch(`/api/repositories/${owner}/${repo}/jobs?limit=5`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load jobs');
        }

        const data = await response.json();

        if (data.jobs.length === 0) {
            jobsDiv.classList.add('d-none');
            return;
        }

        jobsDiv.classList.remove('d-none');
        
        jobsList.innerHTML = data.jobs.map(job => `
            <div class="d-flex justify-content-between align-items-center mb-2 p-2 border-bottom">
                <div>
                    <span class="badge bg-${job.status === 'completed' ? 'success' : job.status === 'failed' ? 'danger' : job.status === 'running' ? 'primary' : 'secondary'}">
                        ${job.status}
                    </span>
                    <small class="ms-2">${job.type}</small>
                </div>
                <div>
                    <small class="text-muted">${new Date(job.created_at).toLocaleString()}</small>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load recent jobs:', error);
    }
}

// Load recent PRs
async function loadRecentPRs() {
    if (!selectedRepo) return;

    const [owner, repo] = selectedRepo.split('/');
    const prsDiv = document.getElementById('recent-prs');
    const prsList = document.getElementById('prs-list');

    try {
        const response = await fetch(`/api/repositories/${owner}/${repo}/pull-requests?limit=5`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load pull requests');
        }

        const data = await response.json();

        if (data.pull_requests.length === 0) {
            prsDiv.classList.add('d-none');
            return;
        }

        prsDiv.classList.remove('d-none');
        
        prsList.innerHTML = data.pull_requests.map(pr => `
            <div class="d-flex justify-content-between align-items-center mb-2 p-2 border-bottom">
                <div>
                    <a href="${pr.pr_url}" target="_blank" rel="noopener noreferrer">
                        <i class="fab fa-github"></i> PR #${pr.pr_number}
                    </a>
                    <div class="small text-muted">Templates: ${pr.templates_applied}</div>
                </div>
                <div>
                    <small class="text-muted">${new Date(pr.created_at).toLocaleString()}</small>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load recent PRs:', error);
    }
}

// OAuth callback is now handled server-side with session cookies
// The server redirects back to the home page after successful authentication
