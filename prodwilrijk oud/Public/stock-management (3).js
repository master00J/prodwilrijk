// Task Management System - Complete Version
class TaskManager {
    constructor() {
        this.tasks = [];
        this.users = [];
        this.currentUser = null;
        this.socket = null;
        this.editor = null;
        this.drake = null;
        this.selectedTaskId = null;
        
        this.init();
    }

    async init() {
        // Check authentication first
        const authResult = await this.checkAuth();
        if (!authResult) {
            return; // Stop initialization if not authenticated
        }
        
        // Initialize UI elements
        this.initializeElements();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize drag and drop
        this.initializeDragAndDrop();
        
        // Initialize markdown editor
        this.initializeMarkdownEditor();
        
        // Setup WebSocket connection
        this.setupWebSocket();
        
        // Load initial data
        await this.loadUsers();
        await this.loadTasks();
    }

    initializeElements() {
        this.elements = {
            // Views
            kanbanView: document.getElementById('kanbanView'),
            tableView: document.getElementById('tableView'),
            
            // Drawer
            taskDrawer: document.getElementById('taskDrawer'),
            drawerOverlay: document.getElementById('drawerOverlay'),
            taskForm: document.getElementById('taskForm'),
            
            // Form fields
            taskId: document.getElementById('taskId'),
            taskTitle: document.getElementById('taskTitle'),
            taskDescription: document.getElementById('taskDescription'),
            taskStatus: document.getElementById('taskStatus'),
            taskPriority: document.getElementById('taskPriority'),
            taskAssignee: document.getElementById('taskAssignee'),
            taskDueDate: document.getElementById('taskDueDate'),
            
            // Buttons
            createTaskBtn: document.getElementById('createTaskBtn'),
            closeDrawerBtn: document.getElementById('closeDrawerBtn'),
            deleteTaskBtn: document.getElementById('deleteTaskBtn'),
            addCommentBtn: document.getElementById('addCommentBtn'),
            mobileMenuToggle: document.getElementById('mobileMenuToggle'),
            
            // Containers
            todoTasks: document.getElementById('todo-tasks'),
            inProgressTasks: document.getElementById('in-progress-tasks'),
            doneTasks: document.getElementById('done-tasks'),
            taskTableBody: document.getElementById('taskTableBody'),
            commentsList: document.getElementById('commentsList'),
            activityList: document.getElementById('activityList'),
            watchersList: document.getElementById('watchersList'),
            notificationContainer: document.getElementById('notificationContainer'),
            
            // Filters
            filterStatus: document.getElementById('filterStatus'),
            filterPriority: document.getElementById('filterPriority'),
            filterAssignee: document.getElementById('filterAssignee'),
            searchTasks: document.getElementById('searchTasks'),
            
            // Other
            sidebar: document.getElementById('sidebar'),
            newComment: document.getElementById('newComment'),
            addWatcher: document.getElementById('addWatcher'),
            
            // File attachments
            fileUploadArea: document.getElementById('fileUploadArea'),
            fileInput: document.getElementById('fileInput'),
            attachmentsList: document.getElementById('attachmentsList'),

            // Image lightbox
            imageLightbox: document.getElementById('imageLightbox'),
            lightboxImage: document.getElementById('lightboxImage'),
            lightboxClose: document.getElementById('lightboxClose'),
            lightboxPrev: document.getElementById('lightboxPrev'),
            lightboxNext: document.getElementById('lightboxNext'),
            lightboxFilename: document.getElementById('lightboxFilename'),
            lightboxCounter: document.getElementById('lightboxCounter')
        };

        // Initialize image gallery
        this.imageGallery = [];
        this.currentImageIndex = 0;
    }

    setupEventListeners() {
        // View toggle
        document.querySelectorAll('.view-toggle button').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleView(e.target.dataset.view));
        });
        
        // Sidebar navigation - SCOPED TO THE SIDEBAR
        if (this.elements.sidebar) {
            this.elements.sidebar.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault(); // Prevent default for sidebar items handled by JS
                    this.handleNavigation(e.currentTarget);
                });
            });
        } else {
            console.error('Sidebar element not found for attaching nav-item listeners.');
        }
        
        // Create task
        this.elements.createTaskBtn.addEventListener('click', () => this.openTaskDrawer());
        
        // Drawer controls
        this.elements.closeDrawerBtn.addEventListener('click', () => this.closeTaskDrawer());
        this.elements.drawerOverlay.addEventListener('click', () => this.closeTaskDrawer());
        
        // Form submission
        this.elements.taskForm.addEventListener('submit', (e) => this.handleTaskSubmit(e));
        
        // Delete task
        this.elements.deleteTaskBtn.addEventListener('click', () => this.deleteTask());
        
        // Add comment
        this.elements.addCommentBtn.addEventListener('click', () => this.addComment());
        this.elements.newComment.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.addComment();
            }
        });
        
        // Add watcher
        this.elements.addWatcher.addEventListener('change', (e) => this.addWatcher(e.target.value));
        
        // File upload listeners
        this.elements.fileUploadArea.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop for file upload
        this.elements.fileUploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.elements.fileUploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.elements.fileUploadArea.addEventListener('drop', (e) => this.handleFileDrop(e));
        
        // Mobile menu
        this.elements.mobileMenuToggle.addEventListener('click', () => {
            this.elements.sidebar.classList.toggle('open');
        });
        
        // Table filters
        [this.elements.filterStatus, this.elements.filterPriority, this.elements.filterAssignee].forEach(filter => {
            filter.addEventListener('change', () => this.filterTasks());
        });
        
        this.elements.searchTasks.addEventListener('input', () => this.filterTasks());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'n') {
                    e.preventDefault();
                    this.openTaskDrawer();
                } else if (e.key === 'Escape') {
                    this.closeTaskDrawer();
                }
            }
        });

        // Image lightbox event listeners
        this.elements.lightboxClose.addEventListener('click', () => this.closeLightbox());
        this.elements.lightboxPrev.addEventListener('click', () => this.showPreviousImage());
        this.elements.lightboxNext.addEventListener('click', () => this.showNextImage());
        
        // Close lightbox on background click
        this.elements.imageLightbox.addEventListener('click', (e) => {
            if (e.target === this.elements.imageLightbox) {
                this.closeLightbox();
            }
        });

        // Keyboard navigation for lightbox
        document.addEventListener('keydown', (e) => {
            if (this.elements.imageLightbox.classList.contains('open')) {
                if (e.key === 'Escape') {
                    this.closeLightbox();
                } else if (e.key === 'ArrowLeft') {
                    this.showPreviousImage();
                } else if (e.key === 'ArrowRight') {
                    this.showNextImage();
                }
            }
        });
    }

    initializeDragAndDrop() {
        const containers = [
            this.elements.todoTasks,
            this.elements.inProgressTasks,
            this.elements.doneTasks
        ];
        
        this.drake = dragula(containers, {
            moves: (el, source, handle, sibling) => {
                return el.classList.contains('task-card');
            },
            accepts: (el, target, source, sibling) => {
                return true;
            },
            invalid: (el, handle) => {
                return handle.classList.contains('task-action-btn');
            }
        });
        
        this.drake.on('drop', (el, target, source, sibling) => {
            const taskId = parseInt(el.dataset.taskId);
            const newStatus = target.parentElement.dataset.status;
            this.updateTaskStatus(taskId, newStatus);
        });
        
        this.drake.on('drag', (el, source) => {
            el.classList.add('dragging');
        });
        
        this.drake.on('dragend', (el) => {
            el.classList.remove('dragging');
        });
    }

    initializeMarkdownEditor() {
        // We'll initialize the editor when the drawer opens
    }

    setupWebSocket() {
        // Connect to your existing Socket.IO server
        this.socket = io({
            transports: ['websocket'],
            upgrade: false
        });
        
        this.socket.on('connect', () => {
            console.log('WebSocket connected');
            // Join the task updates room
            this.socket.emit('join_tasks');
            this.showNotification('Connected to real-time updates', 'success');
        });
        
        this.socket.on('disconnect', () => {
            console.log('WebSocket disconnected');
            this.showNotification('Disconnected from real-time updates', 'error');
        });
        
        // Real-time task updates
        this.socket.on('task:created', (task) => {
            this.tasks.push(task);
            this.renderTask(task);
            this.updateCounts();
            if (task.created_by !== this.currentUser?.id) {
                this.showNotification(`New task created: ${task.title}`, 'info');
            }
        });
        
        this.socket.on('task:updated', (task) => {
            const index = this.tasks.findIndex(t => t.id === task.id);
            if (index !== -1) {
                const oldTask = this.tasks[index];
                this.tasks[index] = task;
                this.updateTaskElement(task, oldTask);
                if (this.selectedTaskId === task.id) {
                    this.loadTaskDetails(task.id);
                }
            }
        });
        
        this.socket.on('task:deleted', (taskId) => {
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.removeTaskElement(taskId);
            if (this.selectedTaskId === taskId) {
                this.closeTaskDrawer();
            }
        });
        
        // Real-time comments
        this.socket.on('comment:added', (data) => {
            if (this.selectedTaskId === data.task_id && data.author_id !== this.currentUser?.id) {
                this.appendComment(data);
            }
        });
        
        // Live cursors
        this.socket.on('cursor:move', (data) => {
            if (data.user_id !== this.currentUser?.id) {
                this.updateUserCursor(data);
            }
        });
        
        // Remove cursor when user disconnects
        this.socket.on('cursor:remove', (data) => {
            this.removeUserCursor(data.user_id);
        });
    }

    async checkAuth() {
        try {
            console.log('Checking authentication...');
            const response = await fetch('/api/check-auth');
            console.log('Auth response status:', response.status);
            
            if (response.ok) {
                const authData = await response.json();
                console.log('Auth data:', authData);
                if (authData.isAuthenticated) {
                    this.currentUser = authData.user;
                    console.log('User authenticated:', this.currentUser);
                    return true;
                } else {
                    console.log('User not authenticated');
                    // Redirect to login page if not authenticated
                    this.showNotification('Please log in to access the task management system', 'error');
                    setTimeout(() => {
                        window.location.href = '/login.html'; // Adjust path as needed
                    }, 2000);
                    return false;
                }
            } else {
                console.error('Auth check failed with status:', response.status);
                throw new Error('Authentication check failed');
            }
        } catch (error) {
            console.error('Auth check error:', error);
            this.showNotification('Authentication error. Please try refreshing the page.', 'error');
            return false;
        }
    }

    async loadUsers() {
        try {
            console.log('Loading users...');
            const response = await fetch('/api/task-management/users');
            console.log('Users response status:', response.status);
            console.log('Users response:', response);
            
            if (response.ok) {
                this.users = await response.json();
                console.log('Users loaded:', this.users.length, 'users');
                this.populateUserSelects();
            } else if (response.status === 401) {
                console.error('Authentication required for loading users');
                this.showNotification('Authentication required. Please log in.', 'error');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
            } else if (response.status === 404) {
                console.error('API endpoint /api/task-management/users not found');
                this.showNotification('Task management system not properly configured. Please contact administrator.', 'error');
            } else {
                const errorText = await response.text();
                console.error('Users response error:', errorText);
                throw new Error(`Failed to load users: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            this.showNotification('Error loading users: ' + error.message, 'error');
        }
    }

    populateUserSelects() {
        const assigneeOptions = this.users.map(user => 
            `<option value="${user.id}">${user.full_name || user.username}</option>`
        ).join('');
        
        this.elements.taskAssignee.innerHTML = '<option value="">Unassigned</option>' + assigneeOptions;
        this.elements.filterAssignee.innerHTML = '<option value="">All</option>' + assigneeOptions;
        this.elements.addWatcher.innerHTML = '<option value="">Add watcher...</option>' + assigneeOptions;
    }

    async loadTasks() {
        try {
            console.log('Loading tasks...');
            const response = await fetch('/api/task-management/list');
            console.log('Tasks response status:', response.status);
            console.log('Tasks response:', response);
            
            if (response.ok) {
                this.tasks = await response.json();
                console.log('Tasks loaded:', this.tasks.length, 'tasks');
                this.renderAllTasks();
            } else if (response.status === 401) {
                console.error('Authentication required for loading tasks');
                this.showNotification('Authentication required. Please log in.', 'error');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
            } else if (response.status === 404) {
                console.error('API endpoint /api/task-management/list not found');
                this.showNotification('Task management system not properly configured. Please contact administrator.', 'error');
            } else {
                const errorText = await response.text();
                console.error('Tasks response error:', errorText);
                throw new Error(`Failed to load tasks: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.showNotification('Error loading tasks: ' + error.message, 'error');
        }
    }

    renderAllTasks() {
        // Clear existing tasks
        this.elements.todoTasks.innerHTML = '';
        this.elements.inProgressTasks.innerHTML = '';
        this.elements.doneTasks.innerHTML = '';
        this.elements.taskTableBody.innerHTML = '';
        
        // Render tasks
        this.tasks.forEach(task => this.renderTask(task));
        this.updateCounts();
    }

    renderTask(task) {
        // Render in Kanban view
        const card = this.createTaskCard(task);
        const container = this.getContainerByStatus(task.status);
        if (container) {
            container.appendChild(card);
        }
        
        // Render in table view
        const row = this.createTaskRow(task);
        this.elements.taskTableBody.appendChild(row);
    }

    createTaskCard(task) {
        const assignee = this.users.find(u => u.id == task.assignedTo);
        const dueDate = task.due_date ? new Date(task.due_date) : null;
        const isOverdue = dueDate && dueDate < new Date() && task.status !== 'done';
        
        const card = document.createElement('div');
        card.className = 'task-card';
        card.dataset.taskId = task.id;
        
        card.innerHTML = `
            <div class="task-priority ${task.priority}"></div>
            <div class="task-header">
                <h4 class="task-title" onclick="taskManager.openTaskDrawer(${task.id})">${this.escapeHtml(task.title)}</h4>
                <div class="task-actions">
                    <button class="task-action-btn" onclick="taskManager.openTaskDrawer(${task.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
            ${task.description ? `<p class="task-description" style="font-size: 0.875rem; color: var(--text-secondary); margin: 0.5rem 0;">${this.escapeHtml(task.description.substring(0, 100))}${task.description.length > 100 ? '...' : ''}</p>` : ''}
            <div class="task-meta">
                ${dueDate ? `
                    <div class="task-meta-item ${isOverdue ? 'text-danger' : ''}">
                        <i class="fas fa-calendar"></i>
                        ${this.formatDate(dueDate)}
                    </div>
                ` : ''}
                ${task.watchers && task.watchers.length > 0 ? `
                    <div class="task-meta-item">
                        <i class="fas fa-eye"></i>
                        ${task.watchers.length}
                    </div>
                ` : ''}
            </div>
            ${assignee ? `
                <div class="task-assignee">
                    <div class="avatar" title="${assignee.full_name || assignee.username}">
                        ${assignee.avatar_url ? 
                            `<img src="${assignee.avatar_url}" alt="${assignee.full_name || assignee.username}" class="avatar-img">` :
                            (assignee.full_name || assignee.username).split(' ').map(n => n[0]).join('').toUpperCase()
                        }
                    </div>
                    <span style="font-size: 0.875rem;">${assignee.full_name || assignee.username}</span>
                </div>
            ` : ''}
        `;
        
        return card;
    }

    createTaskRow(task) {
        const assignee = this.users.find(u => u.id == task.assignedTo);
        const dueDate = task.due_date ? new Date(task.due_date) : null;
        
        const row = document.createElement('tr');
        row.dataset.taskId = task.id;
        
        row.innerHTML = `
            <td>
                <a href="#" onclick="taskManager.openTaskDrawer(${task.id}); return false;" style="text-decoration: none; color: inherit;">
                    <strong>${this.escapeHtml(task.title)}</strong>
                </a>
            </td>
            <td>
                <span class="badge bg-${this.getStatusColor(task.status)}">${this.formatStatus(task.status)}</span>
            </td>
            <td>
                <span class="badge bg-${this.getPriorityColor(task.priority)}">${task.priority}</span>
            </td>
            <td>
                ${assignee ? (assignee.full_name || assignee.username) : '<span class="text-muted">Unassigned</span>'}
            </td>
            <td>
                ${dueDate ? this.formatDate(dueDate) : '<span class="text-muted">No due date</span>'}
            </td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="taskManager.openTaskDrawer(${task.id})">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        
        return row;
    }

    getContainerByStatus(status) {
        switch (status) {
            case 'todo': return this.elements.todoTasks;
            case 'in-progress': return this.elements.inProgressTasks;
            case 'done': return this.elements.doneTasks;
            default: return null;
        }
    }

    getStatusColor(status) {
        switch (status) {
            case 'todo': return 'secondary';
            case 'in-progress': return 'primary';
            case 'done': return 'success';
            default: return 'secondary';
        }
    }

    getPriorityColor(priority) {
        switch (priority) {
            case 'high': return 'danger';
            case 'medium': return 'warning';
            case 'low': return 'success';
            default: return 'secondary';
        }
    }

    formatStatus(status) {
        return status.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    formatDate(date) {
        const now = new Date();
        const diffTime = date - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays === -1) return 'Yesterday';
        if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
        if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
        
        return date.toLocaleDateString();
    }

    updateCounts() {
        const counts = {
            'todo': 0,
            'in-progress': 0,
            'done': 0
        };
        
        this.tasks.forEach(task => {
            counts[task.status]++;
        });
        
        document.querySelectorAll('.kanban-column').forEach(column => {
            const status = column.dataset.status;
            const countElement = column.querySelector('.kanban-count');
            if (countElement) {
                countElement.textContent = counts[status] || 0;
            }
        });
    }

    toggleView(view) {
        document.querySelectorAll('.view-toggle button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        if (view === 'kanban') {
            this.elements.kanbanView.style.display = 'flex';
            this.elements.tableView.style.display = 'none';
        } else {
            this.elements.kanbanView.style.display = 'none';
            this.elements.tableView.style.display = 'block';
        }
    }

    handleNavigation(navItem) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        navItem.classList.add('active');
        
        const view = navItem.dataset.view;
        const filter = navItem.dataset.filter;
        
        if (view) {
            this.loadTasksByView(view);
        } else if (filter) {
            this.applyQuickFilter(filter);
        }
    }

    async loadTasksByView(view) {
        // Implement view-specific task loading
        switch (view) {
            case 'my-tasks':
                const myTasks = this.tasks.filter(t => t.assignedTo == this.currentUser?.id);
                this.tasks = myTasks;
                break;
            case 'watching':
                const watchingTasks = this.tasks.filter(t => t.watchers?.includes(this.currentUser?.id));
                this.tasks = watchingTasks;
                break;
            default:
                await this.loadTasks();
        }
        this.renderAllTasks();
    }

    applyQuickFilter(filter) {
        const [key, value] = filter.split(':');
        
        switch (key) {
            case 'priority':
                const priorityTasks = this.tasks.filter(t => t.priority === value);
                this.tasks = priorityTasks;
                break;
            case 'due':
                if (value === 'today') {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    
                    const todayTasks = this.tasks.filter(t => {
                        if (!t.due_date) return false;
                        const dueDate = new Date(t.due_date);
                        return dueDate >= today && dueDate < tomorrow;
                    });
                    this.tasks = todayTasks;
                } else if (value === 'overdue') {
                    const now = new Date();
                    const overdueTasks = this.tasks.filter(t => {
                        if (!t.due_date) return false;
                        return new Date(t.due_date) < now && t.status !== 'done';
                    });
                    this.tasks = overdueTasks;
                }
                break;
        }
        
        this.renderAllTasks();
    }

    openTaskDrawer(taskId = null) {
        this.selectedTaskId = taskId;
        
        if (taskId) {
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                this.loadTaskDetails(taskId);
            }
        } else {
            this.resetTaskForm();
            document.getElementById('drawerTitle').textContent = 'Create New Task';
            this.elements.deleteTaskBtn.style.display = 'none';
        }
        
        this.elements.taskDrawer.classList.add('open');
        this.elements.drawerOverlay.style.display = 'block';
        
        // Initialize markdown editor if not already initialized
        if (!this.editor) {
            this.editor = new EasyMDE({
                element: this.elements.taskDescription,
                spellChecker: false,
                status: false,
                toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "preview", "guide"],
                placeholder: "Enter task description (Markdown supported)..."
            });
        }
    }

    closeTaskDrawer() {
        this.elements.taskDrawer.classList.remove('open');
        this.elements.drawerOverlay.style.display = 'none';
        this.selectedTaskId = null;
    }

    resetTaskForm() {
        this.elements.taskForm.reset();
        this.elements.taskId.value = '';
        this.elements.watchersList.innerHTML = '';
        this.elements.commentsList.innerHTML = '';
        this.elements.activityList.innerHTML = '';
        this.elements.attachmentsList.innerHTML = '';
        if (this.editor) {
            this.editor.value('');
        }
    }

    async loadTaskDetails(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) {
            // If not in local cache, fetch from server
            try {
                const response = await fetch(`/api/task-management/${taskId}/details`);
                if (response.ok) {
                    const taskData = await response.json();
                    this.populateTaskForm(taskData);
                }
            } catch (error) {
                console.error('Error loading task details:', error);
            }
        } else {
            this.populateTaskForm(task);
        }
        
        // Load comments
        await this.loadComments(taskId);
        
        // Load activity
        await this.loadActivity(taskId);
        
        // Load attachments
        await this.loadAttachments(taskId);
    }

    populateTaskForm(task) {
        document.getElementById('drawerTitle').textContent = 'Edit Task';
        this.elements.deleteTaskBtn.style.display = 'block';
        
        // Populate form fields
        this.elements.taskId.value = task.id;
        this.elements.taskTitle.value = task.title;
        this.elements.taskStatus.value = task.status;
        this.elements.taskPriority.value = task.priority;
        this.elements.taskAssignee.value = task.assignedTo || '';
        
        // Fix due date handling to prevent timezone issues
        if (task.due_date) {
            // Parse the date and format it properly for datetime-local input
            const dueDate = new Date(task.due_date);
            // Use toISOString but adjust for local timezone to prevent shifts
            const offset = dueDate.getTimezoneOffset();
            const localDate = new Date(dueDate.getTime() - (offset * 60 * 1000));
            this.elements.taskDueDate.value = localDate.toISOString().slice(0, 16);
        } else {
            this.elements.taskDueDate.value = '';
        }
        
        if (this.editor) {
            this.editor.value(task.description || '');
        }
        
        // Load watchers
        this.loadWatchers(task.watchers || []);
    }

    loadWatchers(watcherIds) {
        this.elements.watchersList.innerHTML = '';
        
        watcherIds.forEach(userId => {
            const user = this.users.find(u => u.id === userId);
            if (user) {
                const watcherEl = document.createElement('div');
                watcherEl.className = 'badge bg-secondary';
                watcherEl.innerHTML = `
                    ${user.full_name || user.username}
                    <button class="btn btn-sm" onclick="taskManager.removeWatcher(${userId})" style="background: none; border: none; color: white; padding: 0 0 0 0.5rem;">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                this.elements.watchersList.appendChild(watcherEl);
            }
        });
    }

    async loadComments(taskId) {
        try {
            const response = await fetch(`/api/task-management/${taskId}/comments`);
            if (response.ok) {
                const comments = await response.json();
                this.renderComments(comments);
            }
        } catch (error) {
            console.error('Error loading comments:', error);
        }
    }

    renderComments(comments) {
        this.elements.commentsList.innerHTML = '';
        
        comments.forEach(comment => {
            this.appendComment(comment);
        });
    }

    appendComment(comment) {
        const commentEl = document.createElement('div');
        commentEl.className = 'comment';
        
        commentEl.innerHTML = `
            <div class="avatar">
                ${(comment.author?.full_name || comment.author?.username || 'Unknown')?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
            </div>
            <div class="comment-body">
                <div class="comment-header">
                    <span class="comment-author">${comment.author?.full_name || comment.author?.username || 'Unknown User'}</span>
                    <span class="comment-time">${this.formatTime(comment.created_at)}</span>
                </div>
                <div class="comment-text">${this.escapeHtml(comment.body)}</div>
            </div>
        `;
        
        this.elements.commentsList.appendChild(commentEl);
    }

    async loadActivity(taskId) {
        try {
            const response = await fetch(`/api/task-management/${taskId}/activity`);
            if (response.ok) {
                const activities = await response.json();
                this.renderActivity(activities);
            }
        } catch (error) {
            console.error('Error loading activity:', error);
        }
    }

    renderActivity(activities) {
        this.elements.activityList.innerHTML = '';
        
        activities.forEach(activity => {
            const activityEl = document.createElement('div');
            activityEl.className = 'activity-item';
            
            const icon = this.getActivityIcon(activity.action);
            const description = this.getActivityDescription(activity);
            
            activityEl.innerHTML = `
                <div class="activity-icon">
                    <i class="fas fa-${icon}"></i>
                </div>
                <div class="activity-content">
                    ${description}
                    <div class="activity-time">${this.formatTime(activity.created_at)}</div>
                </div>
            `;
            
            this.elements.activityList.appendChild(activityEl);
        });
    }

    getActivityIcon(action) {
        const icons = {
            'created': 'plus',
            'updated': 'edit',
            'status_changed': 'exchange-alt',
            'assigned': 'user-plus',
            'comment_added': 'comment',
            'attachment_added': 'paperclip'
        };
        return icons[action] || 'info';
    }

    getActivityDescription(activity) {
        const user = activity.user?.full_name || activity.user?.username || 'Unknown User';
        
        switch (activity.action) {
            case 'created':
                return `<strong>${user}</strong> created this task`;
            case 'status_changed':
                return `<strong>${user}</strong> changed status from <em>${activity.details.from}</em> to <em>${activity.details.to}</em>`;
            case 'assigned':
                return `<strong>${user}</strong> assigned this task to <strong>${activity.details.assignee}</strong>`;
            case 'comment_added':
                return `<strong>${user}</strong> added a comment`;
            default:
                return `<strong>${user}</strong> ${activity.action.replace('_', ' ')}`;
        }
    }

    async handleTaskSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(this.elements.taskForm);
        const taskData = {
            title: formData.get('title'),
            description: this.editor ? this.editor.value() : formData.get('description'),
            status: formData.get('status'),
            priority: formData.get('priority'),
            assignedTo: formData.get('assignedTo') || null,
            due_date: formData.get('due_date') || null
        };
        
        const taskId = formData.get('id');
        
        try {
            const url = taskId ? `/api/task-management/${taskId}/update` : '/api/task-management/create';
            const method = taskId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(taskData)
            });
            
            if (response.ok) {
                const savedTask = await response.json();
                
                if (taskId) {
                    // Update existing task
                    const index = this.tasks.findIndex(t => t.id === parseInt(taskId));
                    if (index !== -1) {
                        this.tasks[index] = savedTask;
                    }
                    this.showNotification('Task updated successfully', 'success');
                } else {
                    // Add new task
                    this.tasks.push(savedTask);
                    this.showNotification('Task created successfully', 'success');
                }
                
                this.renderAllTasks();
                this.closeTaskDrawer();
                
                // Emit socket event
                this.socket.emit(taskId ? 'task:update' : 'task:create', savedTask);
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save task');
            }
        } catch (error) {
            console.error('Error saving task:', error);
            this.showNotification(error.message || 'Error saving task', 'error');
        }
    }

    async updateTaskStatus(taskId, newStatus) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task || task.status === newStatus) return;
        
        const oldStatus = task.status;
        task.status = newStatus;
        
        try {
            const response = await fetch(`/api/task-management/${taskId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update task status');
            }
            
            this.showNotification('Task status updated', 'success');
            this.socket.emit('task:update', task);
        } catch (error) {
            console.error('Error updating task status:', error);
            // Revert on error
            task.status = oldStatus;
            this.renderAllTasks();
            this.showNotification('Error updating task status', 'error');
        }
        
        this.updateCounts();
    }

    async deleteTask() {
        if (!this.selectedTaskId) return;
        
        if (!confirm('Are you sure you want to delete this task?')) return;
        
        try {
            const response = await fetch(`/api/task-management/${this.selectedTaskId}/delete`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.tasks = this.tasks.filter(t => t.id !== this.selectedTaskId);
                this.renderAllTasks();
                this.closeTaskDrawer();
                this.showNotification('Task deleted successfully', 'success');
                this.socket.emit('task:delete', this.selectedTaskId);
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete task');
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            this.showNotification(error.message || 'Error deleting task', 'error');
        }
    }

    async addComment() {
        const comment = this.elements.newComment.value.trim();
        if (!comment || !this.selectedTaskId) return;
        
        try {
            const response = await fetch(`/api/task-management/${this.selectedTaskId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ body: comment })
            });
            
            if (response.ok) {
                const newComment = await response.json();
                this.appendComment(newComment);
                this.elements.newComment.value = '';
                this.socket.emit('comment:add', { task_id: this.selectedTaskId, ...newComment });
            } else {
                throw new Error('Failed to add comment');
            }
        } catch (error) {
            console.error('Error adding comment:', error);
            this.showNotification('Error adding comment', 'error');
        }
    }

    addWatcher(userId) {
        if (!userId || !this.selectedTaskId) return;
        
        const task = this.tasks.find(t => t.id === this.selectedTaskId);
        if (!task) return;
        
        if (!task.watchers) task.watchers = [];
        if (task.watchers.includes(parseInt(userId))) return;
        
        task.watchers.push(parseInt(userId));
        this.loadWatchers(task.watchers);
        this.elements.addWatcher.value = '';
        
        // Save to server
        this.updateTaskWatchers(this.selectedTaskId, task.watchers);
    }

    removeWatcher(userId) {
        if (!this.selectedTaskId) return;
        
        const task = this.tasks.find(t => t.id === this.selectedTaskId);
        if (!task || !task.watchers) return;
        
        task.watchers = task.watchers.filter(id => id !== userId);
        this.loadWatchers(task.watchers);
        
        // Save to server
        this.updateTaskWatchers(this.selectedTaskId, task.watchers);
    }

    async updateTaskWatchers(taskId, watchers) {
        try {
            const response = await fetch(`/api/task-management/${taskId}/watchers`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ watchers })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update watchers');
            }
        } catch (error) {
            console.error('Error updating watchers:', error);
        }
    }

    filterTasks() {
        const status = this.elements.filterStatus.value;
        const priority = this.elements.filterPriority.value;
        const assignee = this.elements.filterAssignee.value;
        const search = this.elements.searchTasks.value.toLowerCase();
        
        const rows = this.elements.taskTableBody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const task = this.tasks.find(t => t.id === parseInt(row.dataset.taskId));
            if (!task) return;
            
            let show = true;
            
            if (status && task.status !== status) show = false;
            if (priority && task.priority !== priority) show = false;
            if (assignee && task.assignedTo != assignee) show = false;
            if (search && !task.title.toLowerCase().includes(search) && 
                !task.description?.toLowerCase().includes(search)) show = false;
            
            row.style.display = show ? '' : 'none';
        });
    }

    updateTaskElement(task, oldTask) {
        // Update kanban card
        const card = document.querySelector(`.task-card[data-task-id="${task.id}"]`);
        if (card) {
            if (task.status !== oldTask.status) {
                // Move to new column
                const newContainer = this.getContainerByStatus(task.status);
                if (newContainer) {
                    card.remove();
                    newContainer.appendChild(this.createTaskCard(task));
                }
            } else {
                // Update in place
                const newCard = this.createTaskCard(task);
                card.replaceWith(newCard);
            }
        }
        
        // Update table row
        const row = document.querySelector(`tr[data-task-id="${task.id}"]`);
        if (row) {
            const newRow = this.createTaskRow(task);
            row.replaceWith(newRow);
        }
        
        this.updateCounts();
    }

    removeTaskElement(taskId) {
        // Remove from kanban
        const card = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
        if (card) card.remove();
        
        // Remove from table
        const row = document.querySelector(`tr[data-task-id="${taskId}"]`);
        if (row) row.remove();
        
        this.updateCounts();
    }

    updateUserCursor(data) {
        let cursor = document.querySelector(`.user-cursor[data-user-id="${data.user_id}"]`);
        
        if (!cursor) {
            cursor = document.createElement('div');
            cursor.className = 'user-cursor';
            cursor.dataset.userId = data.user_id;
            cursor.dataset.user = data.username;
            document.body.appendChild(cursor);
        }
        
        cursor.style.left = `${data.x}px`;
        cursor.style.top = `${data.y}px`;
        
        // Remove cursor after inactivity
        clearTimeout(cursor.removeTimeout);
        cursor.removeTimeout = setTimeout(() => cursor.remove(), 5000);
    }

    removeUserCursor(userId) {
        const cursor = document.querySelector(`.user-cursor[data-user-id="${userId}"]`);
        if (cursor) cursor.remove();
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            info: 'info-circle'
        };
        
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas fa-${icons[type] || icons.info}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-message">${message}</div>
            </div>
        `;
        
        this.elements.notificationContainer.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (seconds < 60) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    closeLightbox() {
        this.elements.imageLightbox.classList.remove('open');
    }

    showPreviousImage() {
        if (this.imageGallery.length <= 1) return;
        this.currentImageIndex = (this.currentImageIndex - 1 + this.imageGallery.length) % this.imageGallery.length;
        this.updateLightboxImage();
    }

    showNextImage() {
        if (this.imageGallery.length <= 1) return;
        this.currentImageIndex = (this.currentImageIndex + 1) % this.imageGallery.length;
        this.updateLightboxImage();
    }

    updateLightboxImage() {
        const currentImage = this.imageGallery[this.currentImageIndex];
        this.elements.lightboxImage.src = currentImage.url;
        this.elements.lightboxFilename.textContent = currentImage.filename;
        this.elements.lightboxCounter.textContent = `${this.currentImageIndex + 1} / ${this.imageGallery.length}`;
        
        // Show/hide navigation buttons
        const showNav = this.imageGallery.length > 1;
        this.elements.lightboxPrev.style.display = showNav ? 'block' : 'none';
        this.elements.lightboxNext.style.display = showNav ? 'block' : 'none';
    }

    openImageLightbox(attachmentId, attachments) {
        // Build image gallery from all image attachments
        this.imageGallery = attachments
            .filter(att => this.isImageFile(att.filename))
            .map(att => ({
                id: att.id,
                filename: att.filename,
                url: `/api/task-management/attachments/${att.id}/download?preview=true`
            }));
            
        if (this.imageGallery.length === 0) return;
        
        // Find current image index
        this.currentImageIndex = this.imageGallery.findIndex(img => img.id == attachmentId);
        if (this.currentImageIndex === -1) this.currentImageIndex = 0;
        
        // Show lightbox
        this.elements.imageLightbox.classList.add('open');
        this.updateLightboxImage();
    }

    isImageFile(filename) {
        const imageExtensions = ['jpg', 'jpeg', 'jfif', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'tif'];
        const ext = filename.split('.').pop().toLowerCase();
        return imageExtensions.includes(ext);
    }

    // File attachment methods
    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        this.uploadFiles(files);
    }

    handleDragOver(event) {
        event.preventDefault();
        this.elements.fileUploadArea.classList.add('drag-over');
    }

    handleDragLeave(event) {
        event.preventDefault();
        this.elements.fileUploadArea.classList.remove('drag-over');
    }

    handleFileDrop(event) {
        event.preventDefault();
        this.elements.fileUploadArea.classList.remove('drag-over');
        const files = Array.from(event.dataTransfer.files);
        this.uploadFiles(files);
    }

    async uploadFiles(files) {
        if (!this.selectedTaskId) {
            this.showNotification('Selecteer eerst een taak', 'error');
            return;
        }

        for (const file of files) {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                this.showNotification(`Bestand ${file.name} is te groot (max 10MB)`, 'error');
                continue;
            }

            await this.uploadSingleFile(file);
        }
    }

    async uploadSingleFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('task_id', this.selectedTaskId);

        // Create attachment item with progress
        const attachmentItem = this.createAttachmentItem({
            id: 'temp-' + Date.now(),
            filename: file.name,
            size: file.size,
            uploading: true
        });

        this.elements.attachmentsList.appendChild(attachmentItem);

        try {
            const response = await fetch(`/api/task-management/${this.selectedTaskId}/attachments`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const attachment = await response.json();
                // Replace temp item with real attachment
                const realAttachmentItem = this.createAttachmentItem(attachment);
                this.elements.attachmentsList.replaceChild(realAttachmentItem, attachmentItem);
                this.showNotification('Bestand geüpload', 'success');
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            attachmentItem.remove();
            this.showNotification(`Fout bij uploaden van ${file.name}`, 'error');
        }
    }

    async loadAttachments(taskId) {
        try {
            const response = await fetch(`/api/task-management/${taskId}/attachments`);
            if (response.ok) {
                const attachments = await response.json();
                this.renderAttachments(attachments);
            }
        } catch (error) {
            console.error('Error loading attachments:', error);
        }
    }

    renderAttachments(attachments) {
        this.elements.attachmentsList.innerHTML = '';
        // Store attachments for lightbox gallery
        this.currentTaskAttachments = attachments;
        
        // Separate images from other files
        const imageAttachments = attachments.filter(att => this.isImageFile(att.filename));
        const otherAttachments = attachments.filter(att => !this.isImageFile(att.filename));
        
        // Render image gallery if there are images
        const imageGallery = document.getElementById('imageGallery');
        const imageGallerySection = document.getElementById('imageGallerySection');
        
        if (imageAttachments.length > 0 && imageGallery) {
            if (imageGallerySection) imageGallerySection.style.display = 'block';
            imageGallery.style.display = 'grid';
            imageGallery.innerHTML = imageAttachments.map(att => `
                <div class="gallery-item" onclick="taskManager.openImageLightbox('${att.id}', taskManager.currentTaskAttachments)">
                    <img src="/api/task-management/attachments/${att.id}/download?preview=true" 
                         alt="${this.escapeHtml(att.filename)}"
                         loading="lazy"
                         onerror="this.parentElement.style.display='none';"
                         onload="this.parentElement.style.opacity='1';"
                         style="opacity: 0.5;">
                    <div class="gallery-item-overlay">
                        <i class="fas fa-search-plus"></i>
                    </div>
                </div>
            `).join('');
        } else {
            if (imageGallerySection) imageGallerySection.style.display = 'none';
            if (imageGallery) imageGallery.style.display = 'none';
        }
        
        // Render all attachments in list view
        attachments.forEach(attachment => {
            const attachmentItem = this.createAttachmentItem(attachment);
            this.elements.attachmentsList.appendChild(attachmentItem);
        });
    }

    createAttachmentItem(attachment) {
        const li = document.createElement('li');
        li.className = 'attachment-item';
        li.dataset.attachmentId = attachment.id;

        const isImage = this.isImageFile(attachment.filename);
        const icon = this.getFileIcon(attachment.filename);
        const size = this.formatFileSize(attachment.size);

        li.innerHTML = `
            ${!attachment.uploading ? `<input type="checkbox" class="attachment-checkbox" onchange="taskManager.updateBulkActions()">` : ''}
            <div class="attachment-icon ${this.getFileTypeClass(attachment.filename)}">
                ${isImage && !attachment.uploading ? 
                    `<img src="/api/task-management/attachments/${attachment.id}/download?preview=true" 
                          alt="${this.escapeHtml(attachment.filename)}" 
                          class="attachment-thumbnail"
                          onclick="taskManager.openImageLightbox('${attachment.id}', taskManager.currentTaskAttachments)"
                          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                     <i class="fas fa-${icon}" style="display: none;"></i>` :
                    `<i class="fas fa-${icon}"></i>`
                }
            </div>
            <div class="attachment-info">
                <div class="attachment-name">${this.escapeHtml(attachment.filename)}</div>
                <div class="attachment-meta">${size}</div>
                ${attachment.uploading ? '<div class="upload-progress"><div class="upload-progress-bar" style="width: 50%"></div></div>' : ''}
            </div>
            <div class="attachment-actions">
                ${!attachment.uploading ? `
                    ${isImage ? `
                        <button class="btn btn-sm btn-primary" onclick="taskManager.openImageLightbox('${attachment.id}', taskManager.currentTaskAttachments)" title="Bekijk afbeelding">
                            <i class="fas fa-eye"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-secondary" onclick="taskManager.downloadAttachment('${attachment.id}', '${attachment.filename}')" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="taskManager.deleteAttachment('${attachment.id}')" title="Verwijder">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </div>
        `;

        return li;
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const icons = {
            // Images
            'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'svg': 'image',
            // Documents
            'pdf': 'file-pdf', 'doc': 'file-word', 'docx': 'file-word',
            'xls': 'file-excel', 'xlsx': 'file-excel',
            'ppt': 'file-powerpoint', 'pptx': 'file-powerpoint',
            // Archives
            'zip': 'file-archive', 'rar': 'file-archive', '7z': 'file-archive',
            // Text
            'txt': 'file-alt', 'csv': 'file-csv',
            // Code
            'js': 'file-code', 'html': 'file-code', 'css': 'file-code', 'php': 'file-code'
        };
        return icons[ext] || 'file';
    }

    getFileTypeClass(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) return 'file-image';
        if (['pdf'].includes(ext)) return 'file-pdf';
        if (['doc', 'docx'].includes(ext)) return 'file-doc';
        if (['xls', 'xlsx'].includes(ext)) return 'file-excel';
        if (['zip', 'rar', '7z'].includes(ext)) return 'file-archive';
        return 'file-default';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    async downloadAttachment(attachmentId, filename) {
        try {
            const response = await fetch(`/api/task-management/attachments/${attachmentId}/download`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                throw new Error('Download failed');
            }
        } catch (error) {
            console.error('Error downloading attachment:', error);
            this.showNotification('Fout bij downloaden', 'error');
        }
    }

    async deleteAttachment(attachmentId) {
        if (!confirm('Weet je zeker dat je dit bestand wilt verwijderen?')) return;

        try {
            const response = await fetch(`/api/task-management/attachments/${attachmentId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // Remove from current attachments array
                if (this.currentTaskAttachments) {
                    this.currentTaskAttachments = this.currentTaskAttachments.filter(att => att.id != attachmentId);
                    // Re-render attachments without reloading the entire task
                    this.renderAttachments(this.currentTaskAttachments);
                } else {
                    // Fallback: just remove the element
                    const attachmentItem = document.querySelector(`[data-attachment-id="${attachmentId}"]`);
                    if (attachmentItem) attachmentItem.remove();
                }
                
                this.showNotification('Bestand verwijderd', 'success');
            } else {
                throw new Error('Delete failed');
            }
        } catch (error) {
            console.error('Error deleting attachment:', error);
            this.showNotification('Fout bij verwijderen', 'error');
        }
    }

    // Bulk selection functionality
    toggleSelectAll(checked) {
        const checkboxes = document.querySelectorAll('.attachment-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
            const item = checkbox.closest('.attachment-item');
            if (checked) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        this.updateBulkActions();
    }

    updateBulkActions() {
        const checkboxes = document.querySelectorAll('.attachment-checkbox');
        const checkedBoxes = document.querySelectorAll('.attachment-checkbox:checked');
        const bulkActions = document.getElementById('bulkActions');
        const bulkActionsInfo = document.getElementById('bulkActionsInfo');
        const selectAllCheckbox = document.getElementById('selectAllAttachments');

        // Update item appearance
        checkboxes.forEach(checkbox => {
            const item = checkbox.closest('.attachment-item');
            if (checkbox.checked) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });

        // Update bulk actions visibility and info
        if (checkedBoxes.length > 0) {
            bulkActions.classList.add('show');
            bulkActionsInfo.textContent = `${checkedBoxes.length} bestand${checkedBoxes.length > 1 ? 'en' : ''} geselecteerd`;
        } else {
            bulkActions.classList.remove('show');
        }

        // Update select all checkbox state
        if (checkboxes.length === 0) {
            selectAllCheckbox.indeterminate = false;
            selectAllCheckbox.checked = false;
        } else if (checkedBoxes.length === checkboxes.length) {
            selectAllCheckbox.indeterminate = false;
            selectAllCheckbox.checked = true;
        } else if (checkedBoxes.length > 0) {
            selectAllCheckbox.indeterminate = true;
        } else {
            selectAllCheckbox.indeterminate = false;
            selectAllCheckbox.checked = false;
        }
    }

    clearSelection() {
        this.toggleSelectAll(false);
    }

    async bulkDeleteAttachments() {
        const checkedBoxes = document.querySelectorAll('.attachment-checkbox:checked');
        
        if (checkedBoxes.length === 0) {
            this.showNotification('Geen bestanden geselecteerd', 'warning');
            return;
        }

        if (!confirm(`Weet je zeker dat je ${checkedBoxes.length} bestand${checkedBoxes.length > 1 ? 'en' : ''} wilt verwijderen?`)) {
            return;
        }

        const attachmentIds = Array.from(checkedBoxes).map(checkbox => 
            checkbox.closest('.attachment-item').dataset.attachmentId
        );

        let successCount = 0;
        let errorCount = 0;

        // Delete attachments one by one
        for (const attachmentId of attachmentIds) {
            try {
                const response = await fetch(`/api/task-management/attachments/${attachmentId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    successCount++;
                    // Remove from current attachments array
                    if (this.currentTaskAttachments) {
                        this.currentTaskAttachments = this.currentTaskAttachments.filter(att => att.id != attachmentId);
                    }
                } else {
                    errorCount++;
                }
            } catch (error) {
                console.error('Error deleting attachment:', attachmentId, error);
                errorCount++;
            }
        }

        // Re-render attachments
        if (this.currentTaskAttachments) {
            this.renderAttachments(this.currentTaskAttachments);
        }

        // Show result notification
        if (successCount > 0 && errorCount === 0) {
            this.showNotification(`${successCount} bestand${successCount > 1 ? 'en' : ''} verwijderd`, 'success');
        } else if (successCount > 0 && errorCount > 0) {
            this.showNotification(`${successCount} bestand${successCount > 1 ? 'en' : ''} verwijderd, ${errorCount} fout${errorCount > 1 ? 'en' : ''}`, 'warning');
        } else {
            this.showNotification('Fout bij verwijderen van bestanden', 'error');
        }

        this.clearSelection();
    }
}

// Initialize the task manager when DOM is loaded
// document.addEventListener('DOMContentLoaded', () => {
//     window.taskManager = new TaskManager();
// });

// Track mouse movement for live cursors
document.addEventListener('mousemove', throttle((e) => {
    if (window.taskManager?.socket?.connected) {
        window.taskManager.socket.emit('cursor:move', {
            x: e.clientX,
            y: e.clientY
        });
    }
}, 100));

// Utility function for throttling
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Load header on page load  
$(document).ready(function() {
    // Laad eventueel een header in (optioneel)
    $("#header-placeholder").load("/header.html", function() {
        // Header HTML is loaded, its own script should have run.
        // Now, ensure Bootstrap components (like dropdowns) are initialized for the newly added content.
        if (typeof bootstrap !== 'undefined' && typeof bootstrap.Dropdown === 'function') {
            var dropdownElementList = [].slice.call(document.querySelectorAll('#header-placeholder [data-bs-toggle="dropdown"]'));
            dropdownElementList.forEach(function (dropdownToggleEl) {
                new bootstrap.Dropdown(dropdownToggleEl);
            });
            console.log('Bootstrap dropdowns in header re-initialized.');
        } else {
            console.warn('Bootstrap Dropdown function not found. Header dropdowns might not work.');
        }
        
        initializeTaskManager();
    });

    function initializeTaskManager() {
        // Initialize TaskManager after header is loaded
        console.log('Initializing TaskManager...');
        window.taskManager = new TaskManager();
    }

    // Make sure the old initializeHeaderFunctionality is completely removed.
    // The following is a placeholder to ensure the diff tool removes the old function.
    // REMOVE_OLD_INITIALIZE_HEADER_FUNCTIONALITY_BLOCK
}); 