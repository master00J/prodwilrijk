// Task Management System - Complete Version
class TaskManager {
    constructor() {
        this.tasks = [];
        this.originalTasks = []; // Store original unfiltered tasks
        this.users = [];
        this.currentUser = null;
        this.socket = null;
        this.editor = null;
        this.drake = null;
        this.selectedTaskId = null;
        this.savedFilters = [];
        this.milestones = [];
        this.subtasks = [];
        this.selectedTasks = new Set();
        this.currentSearchResults = null;
        this.currentFilter = null; // Track current filter
        
        this.init();
    }

    async init() {
        // Check authentication first
        const authResult = await this.checkAuth();
        if (!authResult) {
            return; // Stop initialization if not authenticated
        }
        
        // Remove all required attributes to prevent validation errors on hidden forms
        this.removeAllRequiredAttributes();
        
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
        await this.loadSavedFilters();
        await this.loadMilestones();
        
        // Ensure tasks are rendered immediately after loading
        this.renderAllTasks();
    }

    removeAllRequiredAttributes() {
        // Remove all required attributes from all form fields to prevent validation errors
        const requiredFields = document.querySelectorAll('[required]');
        requiredFields.forEach(field => {
            field.removeAttribute('required');
            field.dataset.wasRequired = 'true'; // Remember it was required for manual validation
        });
        console.log(`Removed required attributes from ${requiredFields.length} fields`);
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
            taskType: document.getElementById('taskType'),
            customTaskType: document.getElementById('customTaskType'),
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
            filterType: document.getElementById('filterType'),
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

        // Advanced Search Elements
        this.advancedSearchElements = {
            modal: document.getElementById('advancedSearchModal'),
            btn: document.getElementById('advancedSearchBtn'),
            form: document.getElementById('advancedSearchForm'),
            query: document.getElementById('advancedSearchQuery'),
            executeBtn: document.getElementById('executeAdvancedSearch'),
            searchInTitle: document.getElementById('searchInTitle'),
            searchInDescription: document.getElementById('searchInDescription'),
            searchInComments: document.getElementById('searchInComments'),
            searchInAttachments: document.getElementById('searchInAttachments'),
            status: document.getElementById('advancedSearchStatus'),
            priority: document.getElementById('advancedSearchPriority'),
            type: document.getElementById('advancedSearchType'),
            assignee: document.getElementById('advancedSearchAssignee'),
            dateFrom: document.getElementById('advancedSearchDateFrom'),
            dateTo: document.getElementById('advancedSearchDateTo')
        };

        // Bulk Actions Elements
        this.bulkElements = {
            bar: document.getElementById('bulkActionsBar'),
            info: document.getElementById('bulkActionsInfo'),
            statusSelect: document.getElementById('bulkStatusSelect'),
            prioritySelect: document.getElementById('bulkPrioritySelect'),
            assigneeSelect: document.getElementById('bulkAssigneeSelect'),
            deleteBtn: document.getElementById('bulkDeleteBtn'),
            clearBtn: document.getElementById('clearSelectionBtn'),
            selectAllTasks: document.getElementById('selectAllTasks')
        };

        // Saved Filters Elements
        this.filterElements = {
            savedFiltersBtn: document.getElementById('savedFiltersBtn'),
            savedFiltersMenu: document.getElementById('savedFiltersMenu'),
            saveCurrentFilterBtn: document.getElementById('saveCurrentFilterBtn'),
            saveFilterModal: document.getElementById('saveFilterModal'),
            filterName: document.getElementById('filterName'),
            setAsDefault: document.getElementById('setAsDefault'),
            saveFilterBtn: document.getElementById('saveFilterBtn')
        };

        // Subtasks Elements
        this.subtaskElements = {
            addBtn: document.getElementById('addSubtaskBtn'),
            form: document.getElementById('subtaskForm'),
            title: document.getElementById('subtaskTitle'),
            priority: document.getElementById('subtaskPriority'),
            assignee: document.getElementById('subtaskAssignee'),
            dueDate: document.getElementById('subtaskDueDate'),
            description: document.getElementById('subtaskDescription'),
            saveBtn: document.getElementById('saveSubtaskBtn'),
            cancelBtn: document.getElementById('cancelSubtaskBtn'),
            list: document.getElementById('subtasksList')
        };

        // Milestones Elements
        this.milestoneElements = {
            btn: document.getElementById('milestonesBtn'),
            modal: document.getElementById('milestonesModal'),
            createBtn: document.getElementById('createMilestoneBtn'),
            form: document.getElementById('milestoneForm'),
            title: document.getElementById('milestoneTitle'),
            color: document.getElementById('milestoneColor'),
            description: document.getElementById('milestoneDescription'),
            dueDate: document.getElementById('milestoneDueDate'),
            saveBtn: document.getElementById('saveMilestoneBtn'),
            cancelBtn: document.getElementById('cancelMilestoneBtn'),
            list: document.getElementById('milestonesList'),
            taskMilestone: document.getElementById('taskMilestone')
        };

        // Notification Settings Elements
        this.notificationElements = {
            btn: document.getElementById('notificationSettingsBtn'),
            modal: document.getElementById('notificationSettingsModal'),
            taskAssigned: document.getElementById('notifyTaskAssigned'),
            taskCommented: document.getElementById('notifyTaskCommented'),
            taskStatusChanged: document.getElementById('notifyTaskStatusChanged'),
            taskDueSoon: document.getElementById('notifyTaskDueSoon'),
            taskOverdue: document.getElementById('notifyTaskOverdue'),
            saveBtn: document.getElementById('saveNotificationSettingsBtn')
        };
        
        // Profile Settings Elements
        this.profileElements = {
            btn: document.getElementById('profileSettingsBtn'),
            modal: document.getElementById('profileSettingsModal'),
            username: document.getElementById('profileUsername'),
            fullName: document.getElementById('profileFullName'),
            email: document.getElementById('profileEmail'),
            role: document.getElementById('profileRole'),
            saveBtn: document.getElementById('saveProfileBtn')
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
        
        // Create task - with null check
        if (this.elements.createTaskBtn) {
            this.elements.createTaskBtn.addEventListener('click', () => this.openTaskDrawer());
        } else {
            console.error('Create task button not found in DOM');
        }
        
        // Drawer controls - with null checks
        if (this.elements.closeDrawerBtn) {
            this.elements.closeDrawerBtn.addEventListener('click', () => this.closeTaskDrawer());
        } else {
            console.error('Close drawer button not found in DOM');
        }
        
        if (this.elements.drawerOverlay) {
            this.elements.drawerOverlay.addEventListener('click', () => this.closeTaskDrawer());
        } else {
            console.error('Drawer overlay not found in DOM');
        }
        
        // Form submission - with null check
        if (this.elements.taskForm) {
            this.elements.taskForm.addEventListener('submit', (e) => this.handleTaskSubmit(e));
        } else {
            console.error('Task form not found in DOM');
        }
        
        // Delete task - with null check
        if (this.elements.deleteTaskBtn) {
            this.elements.deleteTaskBtn.addEventListener('click', () => this.deleteTask());
        } else {
            console.error('Delete task button not found in DOM');
        }
        
        // Add comment - with null checks
        if (this.elements.addCommentBtn) {
            this.elements.addCommentBtn.addEventListener('click', () => this.addComment());
        } else {
            console.error('Add comment button not found in DOM');
        }
        
        if (this.elements.newComment) {
            this.elements.newComment.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.addComment();
                }
            });
        } else {
            console.error('New comment input not found in DOM');
        }
        
        // Add watcher - optional feature (only setup if element exists)
        if (this.elements.addWatcher) {
            this.elements.addWatcher.addEventListener('change', (e) => this.addWatcher(e.target.value));
        }
        
        // File upload listeners - optional feature (only setup if elements exist)
        if (this.elements.fileUploadArea && this.elements.fileInput) {
            this.elements.fileUploadArea.addEventListener('click', () => this.elements.fileInput.click());
            this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
            
            // Drag and drop for file upload
            this.elements.fileUploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
            this.elements.fileUploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            this.elements.fileUploadArea.addEventListener('drop', (e) => this.handleFileDrop(e));
        }
        
        // Mobile menu - optional feature (only setup if elements exist)
        if (this.elements.mobileMenuToggle && this.elements.sidebar) {
            this.elements.mobileMenuToggle.addEventListener('click', () => {
                this.elements.sidebar.classList.toggle('open');
            });
        }
        
        // Table filters - with null checks for core functionality
        const filters = [this.elements.filterStatus, this.elements.filterPriority, this.elements.filterType, this.elements.filterAssignee];
        filters.forEach((filter, index) => {
            if (filter) {
                filter.addEventListener('change', () => this.filterTasks());
            }
        });
        
        if (this.elements.searchTasks) {
            this.elements.searchTasks.addEventListener('input', () => this.filterTasks());
        }
        
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

        // Image lightbox event listeners - optional features (only setup if elements exist)
        if (this.elements.lightboxClose) {
            this.elements.lightboxClose.addEventListener('click', () => this.closeLightbox());
        }
        
        if (this.elements.lightboxPrev) {
            this.elements.lightboxPrev.addEventListener('click', () => this.showPreviousImage());
        }
        
        if (this.elements.lightboxNext) {
            this.elements.lightboxNext.addEventListener('click', () => this.showNextImage());
        }
        
        // Close lightbox on background click - optional feature
        if (this.elements.imageLightbox) {
            this.elements.imageLightbox.addEventListener('click', (e) => {
                if (e.target === this.elements.imageLightbox) {
                    this.closeLightbox();
                }
            });
        }

        // Keyboard navigation for lightbox
        document.addEventListener('keydown', (e) => {
            if (this.elements.imageLightbox && this.elements.imageLightbox.classList.contains('open')) {
                if (e.key === 'Escape') {
                    this.closeLightbox();
                } else if (e.key === 'ArrowLeft') {
                    this.showPreviousImage();
                } else if (e.key === 'ArrowRight') {
                    this.showNextImage();
                }
            }
        });

        // Advanced Search Event Listeners
        if (this.advancedSearchElements.btn) {
            this.advancedSearchElements.btn.addEventListener('click', () => this.openAdvancedSearch());
        }
        
        if (this.advancedSearchElements.executeBtn) {
            this.advancedSearchElements.executeBtn.addEventListener('click', () => this.executeAdvancedSearch());
        }

        // Bulk Actions Event Listeners
        if (this.bulkElements.selectAllTasks) {
            this.bulkElements.selectAllTasks.addEventListener('change', (e) => this.toggleSelectAllTasks(e.target.checked));
        }
        
        if (this.bulkElements.statusSelect) {
            this.bulkElements.statusSelect.addEventListener('change', (e) => this.bulkUpdateStatus(e.target.value));
        }
        
        if (this.bulkElements.prioritySelect) {
            this.bulkElements.prioritySelect.addEventListener('change', (e) => this.bulkUpdatePriority(e.target.value));
        }
        
        if (this.bulkElements.assigneeSelect) {
            this.bulkElements.assigneeSelect.addEventListener('change', (e) => this.bulkUpdateAssignee(e.target.value));
        }
        
        if (this.bulkElements.deleteBtn) {
            this.bulkElements.deleteBtn.addEventListener('click', () => this.bulkDeleteTasks());
        }
        
        if (this.bulkElements.clearBtn) {
            this.bulkElements.clearBtn.addEventListener('click', () => this.clearTaskSelection());
        }

        // Saved Filters Event Listeners
        if (this.filterElements.saveCurrentFilterBtn) {
            this.filterElements.saveCurrentFilterBtn.addEventListener('click', () => this.openSaveFilterModal());
        }
        
        if (this.filterElements.saveFilterBtn) {
            this.filterElements.saveFilterBtn.addEventListener('click', () => this.saveCurrentFilter());
        }

        // Subtasks Event Listeners
        if (this.subtaskElements.addBtn) {
            this.subtaskElements.addBtn.addEventListener('click', () => this.showSubtaskForm());
        }
        
        if (this.subtaskElements.saveBtn) {
            this.subtaskElements.saveBtn.addEventListener('click', () => this.saveSubtask());
        }
        
        if (this.subtaskElements.cancelBtn) {
            this.subtaskElements.cancelBtn.addEventListener('click', () => this.hideSubtaskForm());
        }

        // Milestones Event Listeners
        if (this.milestoneElements.btn) {
            this.milestoneElements.btn.addEventListener('click', () => this.openMilestonesModal());
        }
        
        if (this.milestoneElements.createBtn) {
            this.milestoneElements.createBtn.addEventListener('click', () => this.showMilestoneForm());
        }
        
        if (this.milestoneElements.saveBtn) {
            this.milestoneElements.saveBtn.addEventListener('click', () => this.saveMilestone());
        }
        
        if (this.milestoneElements.cancelBtn) {
            this.milestoneElements.cancelBtn.addEventListener('click', () => this.hideMilestoneForm());
        }

        // Notification Settings Event Listeners
        if (this.notificationElements.btn) {
            this.notificationElements.btn.addEventListener('click', () => this.openNotificationSettings());
        }
        
        if (this.notificationElements.saveBtn) {
            this.notificationElements.saveBtn.addEventListener('click', () => this.saveNotificationSettings());
        }
        
        // Profile Settings Event Listeners
        if (this.profileElements.btn) {
            this.profileElements.btn.addEventListener('click', () => this.openProfileSettings());
        }
        
        if (this.profileElements.saveBtn) {
            this.profileElements.saveBtn.addEventListener('click', () => this.saveProfileSettings());
        }
    }

    // Custom task type handling
    handleTypeChange(value) {
        if (value === 'custom') {
            this.elements.customTaskType.style.display = 'block';
            this.elements.customTaskType.focus();
        } else {
            this.elements.customTaskType.style.display = 'none';
            this.elements.customTaskType.value = '';
        }
    }

    getTaskTypeValue() {
        if (this.elements.taskType.value === 'custom') {
            return this.elements.customTaskType.value.trim() || 'task';
        }
        return this.elements.taskType.value || 'task';
    }

    setTaskTypeValue(type) {
        const predefinedTypes = ['task', 'bug', 'feature', 'enhancement', 'story', 'epic'];
        
        if (predefinedTypes.includes(type)) {
            this.elements.taskType.value = type;
            this.elements.customTaskType.style.display = 'none';
            this.elements.customTaskType.value = '';
        } else {
            this.elements.taskType.value = 'custom';
            this.elements.customTaskType.style.display = 'block';
            this.elements.customTaskType.value = type;
        }
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
        // Connect to Socket.IO server - works with external server setup
        console.log('Initializing Socket.IO connection...');
        
        this.socket = io({
            transports: ['polling', 'websocket'], // Try polling first, then websocket
            upgrade: true, // Allow upgrading to websocket
            timeout: 30000, // 30 second timeout
            forceNew: false,
            autoConnect: true,
            withCredentials: true // Important for session cookies
        });
        
        this.socket.on('connect', () => {
            console.log('Socket.IO connected successfully!');
            // Join the task updates room
            this.socket.emit('join_tasks');
            this.showNotification('Connected to real-time updates', 'success');
        });
        
        this.socket.on('connect_error', (error) => {
            console.log('Socket.IO connection error:', error.message);
            // Don't show notification - let it fail silently and retry
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('Socket.IO disconnected:', reason);
            if (reason === 'io server disconnect') {
                // The disconnection was initiated by the server, reconnect manually
                this.socket.connect();
            }
        });
        
        this.socket.on('reconnect', (attemptNumber) => {
            console.log('Socket.IO reconnected after', attemptNumber, 'attempts');
            this.socket.emit('join_tasks');
            this.showNotification('Reconnected to real-time updates', 'success');
        });
        
        this.socket.on('reconnect_error', (error) => {
            console.log('Socket.IO reconnection error:', error.message);
        });
        
        this.socket.on('reconnect_failed', () => {
            console.log('Socket.IO reconnection failed - operating in offline mode');
        });
        
        // Real-time task updates
        this.socket.on('task:created', (task) => {
            // Check if task already exists to prevent duplicates
            const existsInOriginal = this.originalTasks.some(t => t.id === task.id);
            const existsInFiltered = this.tasks.some(t => t.id === task.id);
            
            if (!existsInOriginal) {
                this.originalTasks.push(task);
            }
            
            if (this.shouldTaskBeVisible(task) && !existsInFiltered) {
                this.tasks.push(task);
                this.renderTask(task);
            }
            
            this.updateCounts();
            if (task.created_by !== this.currentUser?.id) {
                this.showNotification(`New task created: ${task.title}`, 'info');
            }
        });
        
        this.socket.on('task:updated', (task) => {
            // Update in original tasks
            const originalIndex = this.originalTasks.findIndex(t => t.id === task.id);
            if (originalIndex !== -1) {
                const oldTask = this.originalTasks[originalIndex];
                this.originalTasks[originalIndex] = task;
                
                // Update in filtered tasks
                const index = this.tasks.findIndex(t => t.id === task.id);
                if (index !== -1) {
                    this.tasks[index] = task;
                    this.updateTaskElement(task, oldTask);
                } else if (this.shouldTaskBeVisible(task)) {
                    // Task should now be visible, add it (but check if it doesn't already exist)
                    const alreadyExists = this.tasks.some(t => t.id === task.id);
                    if (!alreadyExists) {
                        this.tasks.push(task);
                        this.renderTask(task);
                    }
                }
                
                if (this.selectedTaskId === task.id) {
                    this.loadTaskDetails(task.id);
                }
            }
        });
        
        this.socket.on('task:deleted', (taskId) => {
            this.originalTasks = this.originalTasks.filter(t => t.id !== taskId);
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
            this.updateUserCursor(data);
        });
        
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
        
        // Populate bulk assignee dropdown
        if (this.bulkElements.assigneeSelect) {
            this.bulkElements.assigneeSelect.innerHTML = '<option value="">Toewijzen aan...</option>' + assigneeOptions;
        }
    }

    async loadTasks() {
        try {
            console.log('Loading tasks...');
            const response = await fetch('/api/task-management/list');
            console.log('Tasks response status:', response.status);
            
            if (response.ok) {
                this.originalTasks = await response.json();
                this.tasks = [...this.originalTasks]; // Copy for display
                console.log('Tasks loaded:', this.tasks.length, 'tasks');
                console.log('Tasks with watchers:', this.tasks.filter(t => t.watchers && t.watchers.length > 0).map(t => ({id: t.id, title: t.title, watchers: t.watchers})));
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
        console.log('Rendering all tasks...', this.tasks.length);
        // Clear existing tasks
        this.elements.todoTasks.innerHTML = '';
        this.elements.inProgressTasks.innerHTML = '';
        this.elements.doneTasks.innerHTML = '';
        this.elements.taskTableBody.innerHTML = '';
        
        // Render tasks
        this.tasks.forEach(task => this.renderTask(task));
        this.updateCounts();
    }

    renderFilteredTasks(filteredTasks) {
        console.log('Rendering filtered tasks...', filteredTasks.length);
        // Clear existing tasks
        this.elements.todoTasks.innerHTML = '';
        this.elements.inProgressTasks.innerHTML = '';
        this.elements.doneTasks.innerHTML = '';
        this.elements.taskTableBody.innerHTML = '';
        
        // Render filtered tasks
        filteredTasks.forEach(task => this.renderTask(task));
        this.updateFilteredCounts(filteredTasks);
    }

    updateFilteredCounts(filteredTasks) {
        const counts = {
            'todo': 0,
            'in-progress': 0,
            'done': 0
        };
        
        filteredTasks.forEach(task => {
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
            <div style="margin: 0.5rem 0;">
                <span class="task-type-badge ${this.getTaskTypeBadgeClass(task.task_type || 'task')}">
                    <i class="task-type-icon ${this.getTaskTypeIcon(task.task_type || 'task')}"></i>
                    ${this.formatTaskType(task.task_type || 'task')}
                </span>
            </div>
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
                <input type="checkbox" class="task-checkbox" onchange="taskManager.handleTaskSelection(${task.id}, this.checked)">
            </td>
            <td>
                <a href="#" onclick="taskManager.openTaskDrawer(${task.id}); return false;" style="text-decoration: none; color: inherit;">
                    <strong>${this.escapeHtml(task.title)}</strong>
                </a>
            </td>
            <td>
                <span class="task-type-badge ${this.getTaskTypeBadgeClass(task.task_type || 'task')}">
                    <i class="task-type-icon ${this.getTaskTypeIcon(task.task_type || 'task')}"></i>
                    ${this.formatTaskType(task.task_type || 'task')}
                </span>
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

    formatTaskType(type) {
        // For predefined types, return formatted names
        const typeNames = {
            'task': 'Task',
            'bug': 'Bug',
            'feature': 'Feature',
            'enhancement': 'Enhancement',
            'story': 'Story',
            'epic': 'Epic'
        };
        
        // Return formatted name for predefined types, or capitalize custom types
        return typeNames[type] || type.charAt(0).toUpperCase() + type.slice(1);
    }

    getTaskTypeBadgeClass(type) {
        const predefinedTypes = ['task', 'bug', 'feature', 'enhancement', 'story', 'epic'];
        
        if (predefinedTypes.includes(type)) {
            return type;
        }
        
        // For custom types, use default task styling
        return 'task';
    }

    getTaskTypeIcon(type) {
        const icons = {
            'task': 'fas fa-tasks',
            'bug': 'fas fa-bug',
            'feature': 'fas fa-lightbulb',
            'enhancement': 'fas fa-chart-line',
            'story': 'fas fa-book',
            'epic': 'fas fa-mountain'
        };
        
        return icons[type] || 'fas fa-tasks';
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
        console.log('Loading tasks by view:', view);
        
        // Store the current filter
        this.currentFilter = { type: 'view', value: view };
        
        let filteredTasks;
        
        switch (view) {
            case 'my-tasks':
                console.log('Filtering my tasks for user:', this.currentUser?.id);
                filteredTasks = this.originalTasks.filter(t => t.assignedTo == this.currentUser?.id);
                console.log('My tasks found:', filteredTasks.length);
                break;
            case 'watching':
                console.log('Filtering watching tasks for user:', this.currentUser?.id);
                console.log('All tasks loaded:', this.originalTasks.length);
                filteredTasks = this.originalTasks.filter(t => {
                    const watchers = t.watchers || t.watching || t.watched_by || t.followers;
                    console.log('Checking if task', t.id, 'is watched by user', this.currentUser?.id);
                    console.log('Task watchers:', watchers);
                    
                    if (!watchers || !Array.isArray(watchers)) {
                        console.log('No watchers array found');
                        return false;
                    }
                    
                    const isWatching = watchers.includes(this.currentUser?.id) || watchers.includes(String(this.currentUser?.id));
                    console.log('User is watching:', isWatching);
                    return isWatching;
                });
                console.log('Watching tasks found:', filteredTasks.length);
                break;
            case 'tasks':
            default:
                // Show all tasks
                filteredTasks = [...this.originalTasks];
                this.currentFilter = null; // Reset filter for "all tasks"
                break;
        }
        
        // Update the display tasks and render
        this.tasks = filteredTasks;
        this.renderAllTasks();
    }

    applyQuickFilter(filter) {
        console.log('Applying quick filter:', filter);
        
        // Store the current filter
        this.currentFilter = { type: 'quick', value: filter };
        
        const [key, value] = filter.split(':');
        let filteredTasks;
        
        switch (key) {
            case 'priority':
                filteredTasks = this.originalTasks.filter(t => t.priority === value);
                break;
            case 'due':
                if (value === 'today') {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    filteredTasks = this.originalTasks.filter(t => {
                        if (!t.due_date) return false;
                        const dueDate = new Date(t.due_date);
                        return dueDate >= today && dueDate < tomorrow;
                    });
                } else if (value === 'overdue') {
                    const now = new Date();
                    filteredTasks = this.originalTasks.filter(t => {
                        if (!t.due_date) return false;
                        return new Date(t.due_date) < now && t.status !== 'done';
                    });
                }
                break;
            default:
                filteredTasks = [...this.originalTasks];
                break;
        }
        
        // Update the display tasks and render
        this.tasks = filteredTasks;
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
        
        // Reset current task attachments to prevent showing images from other tasks
        this.currentTaskAttachments = [];
        
        // Hide image gallery section
        const imageGallerySection = document.getElementById('imageGallerySection');
        const imageGallery = document.getElementById('imageGallery');
        if (imageGallerySection) imageGallerySection.style.display = 'none';
        if (imageGallery) imageGallery.innerHTML = '';
        
        // Reset custom task type field
        this.elements.customTaskType.style.display = 'none';
        this.elements.customTaskType.value = '';
        
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
        
        // Load subtasks
        await this.loadSubtasks(taskId);
    }

    populateTaskForm(task) {
        document.getElementById('drawerTitle').textContent = 'Edit Task';
        this.elements.deleteTaskBtn.style.display = 'block';
        
        // Populate form fields
        this.elements.taskId.value = task.id;
        this.elements.taskTitle.value = task.title;
        this.elements.taskStatus.value = task.status;
        this.elements.taskPriority.value = task.priority;
        
        // Handle task type (including custom types)
        this.setTaskTypeValue(task.task_type || 'task');
        
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
        
        // Set milestone
        if (this.milestoneElements.taskMilestone) {
            this.milestoneElements.taskMilestone.value = task.milestone_id || '';
        }
        
        if (this.editor) {
            this.editor.value(task.description || '');
        }
        
        // Load watchers
        console.log('Task watchers from populateTaskForm:', task.watchers);
        this.loadWatchers(task.watchers || []);
    }

    loadWatchers(watcherIds) {
        console.log('Loading watchers:', watcherIds);
        this.elements.watchersList.innerHTML = '';
        
        if (!watcherIds || !Array.isArray(watcherIds)) {
            console.log('No watchers to load');
            return;
        }
        
        watcherIds.forEach(userId => {
            const user = this.users.find(u => u.id === userId);
            console.log('Looking for user with ID:', userId, 'found:', user);
            
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
            } else {
                console.warn('User not found for watcher ID:', userId);
            }
        });
        
        console.log('Loaded', watcherIds.length, 'watchers');
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
        commentEl.dataset.commentId = comment.id;
        
        const isOwnComment = comment.author?.id === this.currentUser?.id;
        const editedText = comment.edited ? ' <span class="comment-edited">(bewerkt)</span>' : '';
        
        commentEl.innerHTML = `
            <div class="avatar">
                ${(comment.author?.full_name || comment.author?.username || 'Unknown')?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
            </div>
            <div class="comment-body">
                <div class="comment-header">
                    <span class="comment-author">${comment.author?.full_name || comment.author?.username || 'Unknown User'}</span>
                    <span class="comment-time">${this.formatTime(comment.created_at)}${editedText}</span>
                    ${isOwnComment ? `
                        <div class="comment-actions">
                            <button type="button" class="btn btn-sm btn-link comment-edit-btn" onclick="taskManager.editComment(${comment.id})" title="Bewerken">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-link comment-delete-btn" onclick="taskManager.deleteComment(${comment.id})" title="Verwijderen">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
                <div class="comment-text" id="comment-text-${comment.id}">${this.escapeHtml(comment.body)}</div>
                <div class="comment-edit-form" id="comment-edit-${comment.id}" style="display: none;">
                    <textarea class="form-control comment-edit-textarea" rows="3">${this.escapeHtml(comment.body)}</textarea>
                    <div class="comment-edit-actions mt-2">
                        <button type="button" class="btn btn-sm btn-primary" onclick="taskManager.saveCommentEdit(${comment.id})">Opslaan</button>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="taskManager.cancelCommentEdit(${comment.id})">Annuleren</button>
                    </div>
                </div>
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
        
        // Manual validation for required fields
        const title = this.elements.taskTitle.value.trim();
        if (!title) {
            this.showNotification('Taak titel is verplicht', 'warning');
            this.elements.taskTitle.focus();
            return;
        }
        
        const formData = new FormData(this.elements.taskForm);
        
        // Get current watchers from the task if we're updating
        let currentWatchers = [];
        if (this.selectedTaskId) {
            const currentTask = this.tasks.find(t => t.id === this.selectedTaskId) || 
                               this.originalTasks.find(t => t.id === this.selectedTaskId);
            if (currentTask && currentTask.watchers) {
                currentWatchers = currentTask.watchers;
            }
        }
        
        const taskData = {
            title: title,
            description: this.editor ? this.editor.value() : formData.get('description'),
            status: formData.get('status'),
            priority: formData.get('priority'),
            task_type: this.getTaskTypeValue(),
            assignedTo: formData.get('assignedTo') || null,
            due_date: formData.get('due_date') || null,
            milestone_id: this.milestoneElements.taskMilestone ? this.milestoneElements.taskMilestone.value || null : null,
            watchers: currentWatchers // Include current watchers to preserve them
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
                    const originalIndex = this.originalTasks.findIndex(t => t.id === parseInt(taskId));
                    
                    // Ensure watchers are preserved in the saved task
                    savedTask.watchers = currentWatchers;
                    
                    if (originalIndex !== -1) {
                        this.originalTasks[originalIndex] = savedTask;
                    }
                    if (index !== -1) {
                        this.tasks[index] = savedTask;
                    }
                    this.showNotification('Task updated successfully', 'success');
                    
                    // Don't reload task details to preserve watchers and description
                    // Just update the editor with the current description to ensure it's preserved
                    if (this.editor) {
                        this.editor.value(taskData.description || '');
                    }
                } else {
                    // Add new task - check if it doesn't already exist
                    const alreadyExists = this.originalTasks.some(t => t.id === savedTask.id);
                    if (!alreadyExists) {
                        this.originalTasks.push(savedTask);
                    }
                    
                    // Check if new task should be visible in current filter
                    if (this.shouldTaskBeVisible(savedTask)) {
                        const alreadyInFiltered = this.tasks.some(t => t.id === savedTask.id);
                        if (!alreadyInFiltered) {
                            this.tasks.push(savedTask);
                        }
                    }
                    
                    this.showNotification('Task created successfully', 'success');
                    this.closeTaskDrawer();
                }
                
                this.renderAllTasks();
                
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
                this.originalTasks = this.originalTasks.filter(t => t.id !== this.selectedTaskId);
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

    editComment(commentId) {
        const commentEl = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (!commentEl) return;
        
        const textEl = commentEl.querySelector(`#comment-text-${commentId}`);
        const editEl = commentEl.querySelector(`#comment-edit-${commentId}`);
        
        textEl.style.display = 'none';
        editEl.style.display = 'block';
        
        // Focus on textarea
        const textarea = editEl.querySelector('.comment-edit-textarea');
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }

    cancelCommentEdit(commentId) {
        const commentEl = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (!commentEl) return;
        
        const textEl = commentEl.querySelector(`#comment-text-${commentId}`);
        const editEl = commentEl.querySelector(`#comment-edit-${commentId}`);
        
        textEl.style.display = 'block';
        editEl.style.display = 'none';
    }

    async saveCommentEdit(commentId) {
        const commentEl = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (!commentEl) return;
        
        const textarea = commentEl.querySelector('.comment-edit-textarea');
        const newText = textarea.value.trim();
        
        if (!newText) {
            this.showNotification('Reactie mag niet leeg zijn', 'error');
            return;
        }
        
        try {
            const response = await fetch(`/api/task-management/comments/${commentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ body: newText })
            });
            
            if (response.ok) {
                const updatedComment = await response.json();
                
                // Update the comment text
                const textEl = commentEl.querySelector(`#comment-text-${commentId}`);
                textEl.innerHTML = this.escapeHtml(newText);
                
                // Add edited indicator
                const timeEl = commentEl.querySelector('.comment-time');
                if (!timeEl.querySelector('.comment-edited')) {
                    timeEl.innerHTML += ' <span class="comment-edited">(bewerkt)</span>';
                }
                
                this.cancelCommentEdit(commentId);
                this.showNotification('Reactie bijgewerkt', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Fout bij het bijwerken van reactie');
            }
        } catch (error) {
            console.error('Error updating comment:', error);
            this.showNotification(error.message || 'Fout bij het bijwerken van reactie', 'error');
        }
    }

    async deleteComment(commentId) {
        if (!confirm('Weet je zeker dat je deze reactie wilt verwijderen?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/task-management/comments/${commentId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                // Remove comment from DOM
                const commentEl = document.querySelector(`[data-comment-id="${commentId}"]`);
                if (commentEl) {
                    commentEl.remove();
                }
                
                this.showNotification('Reactie verwijderd', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Fout bij het verwijderen van reactie');
            }
        } catch (error) {
            console.error('Error deleting comment:', error);
            this.showNotification(error.message || 'Fout bij het verwijderen van reactie', 'error');
        }
    }

    addWatcher(userId) {
        if (!userId || !this.selectedTaskId) return;
        
        console.log('Adding watcher:', userId, 'to task:', this.selectedTaskId);
        
        // Find task in both arrays
        const task = this.tasks.find(t => t.id === this.selectedTaskId);
        const originalTask = this.originalTasks.find(t => t.id === this.selectedTaskId);
        
        if (!task || !originalTask) {
            console.error('Task not found for adding watcher');
            return;
        }
        
        // Initialize watchers array if it doesn't exist
        if (!task.watchers) task.watchers = [];
        if (!originalTask.watchers) originalTask.watchers = [];
        
        // Check if watcher already exists in either array
        const userIdInt = parseInt(userId);
        if (task.watchers.includes(userIdInt) || originalTask.watchers.includes(userIdInt)) {
            console.log('User is already a watcher');
            return;
        }
        
        // Add to both arrays
        task.watchers.push(userIdInt);
        originalTask.watchers.push(userIdInt);
        
        // Remove duplicates before sending to server
        const uniqueWatchers = [...new Set(task.watchers)];
        task.watchers = uniqueWatchers;
        originalTask.watchers = uniqueWatchers;
        
        console.log('Updated watchers (deduplicated):', task.watchers);
        
        this.loadWatchers(task.watchers);
        this.elements.addWatcher.value = '';
        
        // Save to server
        this.updateTaskWatchers(this.selectedTaskId, task.watchers);
    }

    removeWatcher(userId) {
        if (!this.selectedTaskId) return;
        
        console.log('Removing watcher:', userId, 'from task:', this.selectedTaskId);
        
        // Find task in both arrays
        const task = this.tasks.find(t => t.id === this.selectedTaskId);
        const originalTask = this.originalTasks.find(t => t.id === this.selectedTaskId);
        
        if (!task || !originalTask || !task.watchers || !originalTask.watchers) {
            console.error('Task or watchers not found for removing watcher');
            return;
        }
        
        // Remove from both arrays
        task.watchers = task.watchers.filter(id => id !== userId);
        originalTask.watchers = originalTask.watchers.filter(id => id !== userId);
        
        console.log('Updated watchers after removal:', task.watchers);
        
        this.loadWatchers(task.watchers);
        
        // Save to server
        this.updateTaskWatchers(this.selectedTaskId, task.watchers);
    }

    async updateTaskWatchers(taskId, watchers) {
        try {
            console.log('Updating watchers on server for task:', taskId, 'watchers:', watchers);
            
            const response = await fetch(`/api/task-management/${taskId}/watchers`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ watchers })
            });
            
            if (response.ok) {
                const serverResponse = await response.json();
                console.log('Watchers updated successfully on server, received response:', serverResponse);
                
                // Extract watchers from server response
                const updatedWatchers = serverResponse.watchers || [];
                
                // Update both task arrays with the server response
                const taskIndex = this.tasks.findIndex(t => t.id === taskId);
                const originalTaskIndex = this.originalTasks.findIndex(t => t.id === taskId);
                
                if (taskIndex !== -1) {
                    this.tasks[taskIndex] = { ...this.tasks[taskIndex], watchers: updatedWatchers };
                }
                if (originalTaskIndex !== -1) {
                    this.originalTasks[originalTaskIndex] = { ...this.originalTasks[originalTaskIndex], watchers: updatedWatchers };
                }
                
                console.log('Local tasks updated with server watchers:', updatedWatchers);
                this.showNotification('Volger bijgewerkt', 'success');
            } else {
                const errorText = await response.text();
                console.error('Failed to update watchers:', response.status, errorText);
                throw new Error('Failed to update watchers');
            }
        } catch (error) {
            console.error('Error updating watchers:', error);
            this.showNotification('Fout bij bijwerken volger', 'error');
        }
    }

    filterTasks() {
        const status = this.elements.filterStatus.value;
        const priority = this.elements.filterPriority.value;
        const type = this.elements.filterType.value;
        const assignee = this.elements.filterAssignee.value;
        const search = this.elements.searchTasks.value.toLowerCase();
        
        const rows = this.elements.taskTableBody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const task = this.tasks.find(t => t.id === parseInt(row.dataset.taskId));
            if (!task) return;
            
            let show = true;
            
            if (status && task.status !== status) show = false;
            if (priority && task.priority !== priority) show = false;
            if (type && (task.task_type || 'task') !== type) show = false;
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
                this.showNotification('Bestand geupload', 'success');
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

    // Image lightbox methods
    closeLightbox() {
        if (!this.elements.imageLightbox) return;
        this.elements.imageLightbox.classList.remove('open');
    }

    showPreviousImage() {
        if (!this.elements.imageLightbox || this.imageGallery.length <= 1) return;
        this.currentImageIndex = (this.currentImageIndex - 1 + this.imageGallery.length) % this.imageGallery.length;
        this.updateLightboxImage();
    }

    showNextImage() {
        if (!this.elements.imageLightbox || this.imageGallery.length <= 1) return;
        this.currentImageIndex = (this.currentImageIndex + 1) % this.imageGallery.length;
        this.updateLightboxImage();
    }

    updateLightboxImage() {
        if (!this.elements.imageLightbox || !this.elements.lightboxImage || !this.elements.lightboxFilename || !this.elements.lightboxCounter) return;
        
        const currentImage = this.imageGallery[this.currentImageIndex];
        this.elements.lightboxImage.src = currentImage.url;
        this.elements.lightboxFilename.textContent = currentImage.filename;
        this.elements.lightboxCounter.textContent = `${this.currentImageIndex + 1} / ${this.imageGallery.length}`;
        
        // Show/hide navigation buttons
        const showNav = this.imageGallery.length > 1;
        if (this.elements.lightboxPrev) {
            this.elements.lightboxPrev.style.display = showNav ? 'block' : 'none';
        }
        if (this.elements.lightboxNext) {
            this.elements.lightboxNext.style.display = showNav ? 'block' : 'none';
        }
    }

    openImageLightbox(attachmentId, attachments) {
        // Check if lightbox elements exist, if not, just return silently
        if (!this.elements.imageLightbox) {
            console.log('Lightbox not available - opening image in new tab as fallback');
            // Fallback: open image in new tab
            const attachment = attachments.find(att => att.id == attachmentId);
            if (attachment) {
                window.open(`/api/task-management/attachments/${attachment.id}/download`, '_blank');
            }
            return;
        }
        
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

    // ===== ADVANCED SEARCH METHODS =====
    
    openAdvancedSearch() {
        // Populate assignee dropdown
        if (this.advancedSearchElements.assignee) {
            const assigneeOptions = this.users.map(user => 
                `<option value="${user.id}">${user.full_name || user.username}</option>`
            ).join('');
            this.advancedSearchElements.assignee.innerHTML = '<option value="">Alle</option>' + assigneeOptions;
        }
        
        // Show modal
        const modal = new bootstrap.Modal(this.advancedSearchElements.modal);
        modal.show();
    }

    async executeAdvancedSearch() {
        const searchData = {
            query: this.advancedSearchElements.query.value.trim(),
            searchIn: {
                title: this.advancedSearchElements.searchInTitle.checked,
                description: this.advancedSearchElements.searchInDescription.checked,
                comments: this.advancedSearchElements.searchInComments.checked,
                attachments: this.advancedSearchElements.searchInAttachments.checked
            },
            filters: {
                status: this.advancedSearchElements.status.value,
                priority: this.advancedSearchElements.priority.value,
                type: this.advancedSearchElements.type.value,
                assignee: this.advancedSearchElements.assignee.value,
                dateFrom: this.advancedSearchElements.dateFrom.value,
                dateTo: this.advancedSearchElements.dateTo.value
            }
        };

        if (!searchData.query) {
            this.showNotification('Voer een zoekterm in', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/task-management/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(searchData)
            });

            if (response.ok) {
                const results = await response.json();
                this.currentSearchResults = results;
                this.displaySearchResults(results, searchData.query);
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(this.advancedSearchElements.modal);
                modal.hide();
            } else {
                throw new Error('Search failed');
            }
        } catch (error) {
            console.error('Error executing search:', error);
            this.showNotification('Fout bij zoeken', 'error');
        }
    }

    displaySearchResults(results, query) {
        // Show search results info
        const searchInfo = document.createElement('div');
        searchInfo.className = 'search-results-info';
        searchInfo.innerHTML = `
            <i class="fas fa-search"></i>
            Zoekresultaten voor "${query}": ${results.length} taken gevonden
            <button class="btn btn-sm btn-secondary float-end" onclick="taskManager.clearSearchResults()">
                <i class="fas fa-times"></i>
                Wissen
            </button>
        `;
        
        // Insert before kanban view
        this.elements.kanbanView.parentNode.insertBefore(searchInfo, this.elements.kanbanView);
        
        // Highlight search terms in results
        this.highlightSearchTerms(results, query);
        
        // Render filtered results
        this.renderFilteredTasks(results);
    }

    highlightSearchTerms(tasks, query) {
        const terms = query.toLowerCase().split(' ').filter(term => term.length > 2);
        
        tasks.forEach(task => {
            terms.forEach(term => {
                if (task.title && task.title.toLowerCase().includes(term)) {
                    task.title = task.title.replace(new RegExp(`(${term})`, 'gi'), '<span class="search-highlight">$1</span>');
                }
                if (task.description && task.description.toLowerCase().includes(term)) {
                    task.description = task.description.replace(new RegExp(`(${term})`, 'gi'), '<span class="search-highlight">$1</span>');
                }
            });
        });
    }

    clearSearchResults() {
        // Remove search info
        const searchInfo = document.querySelector('.search-results-info');
        if (searchInfo) {
            searchInfo.remove();
        }
        
        // Clear search results
        this.currentSearchResults = null;
        
        // Render all tasks
        this.renderAllTasks();
    }

    // ===== BULK ACTIONS METHODS =====
    
    toggleSelectAllTasks(checked) {
        const checkboxes = document.querySelectorAll('.task-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
            const taskId = parseInt(checkbox.closest('tr').dataset.taskId);
            if (checked) {
                this.selectedTasks.add(taskId);
            } else {
                this.selectedTasks.delete(taskId);
            }
        });
        this.updateBulkActionsBar();
    }

    updateBulkActionsBar() {
        const selectedCount = this.selectedTasks.size;
        
        if (selectedCount > 0) {
            this.bulkElements.bar.style.display = 'flex';
            this.bulkElements.info.textContent = `${selectedCount} taken geselecteerd`;
        } else {
            this.bulkElements.bar.style.display = 'none';
        }
        
        // Update select all checkbox
        const allCheckboxes = document.querySelectorAll('.task-checkbox');
        const checkedCheckboxes = document.querySelectorAll('.task-checkbox:checked');
        
        if (allCheckboxes.length === 0) {
            this.bulkElements.selectAllTasks.indeterminate = false;
            this.bulkElements.selectAllTasks.checked = false;
        } else if (checkedCheckboxes.length === allCheckboxes.length) {
            this.bulkElements.selectAllTasks.indeterminate = false;
            this.bulkElements.selectAllTasks.checked = true;
        } else if (checkedCheckboxes.length > 0) {
            this.bulkElements.selectAllTasks.indeterminate = true;
        } else {
            this.bulkElements.selectAllTasks.indeterminate = false;
            this.bulkElements.selectAllTasks.checked = false;
        }
    }

    async bulkUpdateStatus(status) {
        if (!status || this.selectedTasks.size === 0) return;
        
        const taskIds = Array.from(this.selectedTasks);
        
        try {
            const response = await fetch('/api/task-management/bulk-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    taskIds,
                    updates: { status }
                })
            });
            
            if (response.ok) {
                // Update local tasks
                taskIds.forEach(taskId => {
                    const task = this.tasks.find(t => t.id === taskId);
                    if (task) {
                        task.status = status;
                    }
                });
                
                this.renderAllTasks();
                this.clearTaskSelection();
                this.showNotification(`${taskIds.length} taken bijgewerkt`, 'success');
            } else {
                throw new Error('Bulk update failed');
            }
        } catch (error) {
            console.error('Error bulk updating status:', error);
            this.showNotification('Fout bij bijwerken van taken', 'error');
        }
        
        // Reset select
        this.bulkElements.statusSelect.value = '';
    }

    async bulkUpdatePriority(priority) {
        if (!priority || this.selectedTasks.size === 0) return;
        
        const taskIds = Array.from(this.selectedTasks);
        
        try {
            const response = await fetch('/api/task-management/bulk-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    taskIds,
                    updates: { priority }
                })
            });
            
            if (response.ok) {
                // Update local tasks
                taskIds.forEach(taskId => {
                    const task = this.tasks.find(t => t.id === taskId);
                    if (task) {
                        task.priority = priority;
                    }
                });
                
                this.renderAllTasks();
                this.clearTaskSelection();
                this.showNotification(`${taskIds.length} taken bijgewerkt`, 'success');
            } else {
                throw new Error('Bulk update failed');
            }
        } catch (error) {
            console.error('Error bulk updating priority:', error);
            this.showNotification('Fout bij bijwerken van taken', 'error');
        }
        
        // Reset select
        this.bulkElements.prioritySelect.value = '';
    }

    async bulkUpdateAssignee(assigneeId) {
        if (!assigneeId || this.selectedTasks.size === 0) return;
        
        const taskIds = Array.from(this.selectedTasks);
        
        try {
            const response = await fetch('/api/task-management/bulk-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    taskIds,
                    updates: { assignedTo: assigneeId }
                })
            });
            
            if (response.ok) {
                // Update local tasks
                taskIds.forEach(taskId => {
                    const task = this.tasks.find(t => t.id === taskId);
                    if (task) {
                        task.assignedTo = parseInt(assigneeId);
                    }
                });
                
                this.renderAllTasks();
                this.clearTaskSelection();
                this.showNotification(`${taskIds.length} taken bijgewerkt`, 'success');
            } else {
                throw new Error('Bulk update failed');
            }
        } catch (error) {
            console.error('Error bulk updating assignee:', error);
            this.showNotification('Fout bij bijwerken van taken', 'error');
        }
        
        // Reset select
        this.bulkElements.assigneeSelect.value = '';
    }

    async bulkDeleteTasks() {
        if (this.selectedTasks.size === 0) {
            this.showNotification('Geen taken geselecteerd', 'warning');
            return;
        }
        
        if (!confirm(`Weet je zeker dat je ${this.selectedTasks.size} taken wilt verwijderen?`)) {
            return;
        }
        
        const taskIds = Array.from(this.selectedTasks);
        
        try {
            const response = await fetch('/api/task-management/bulk-delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ taskIds })
            });
            
            if (response.ok) {
                // Remove from local tasks
                this.tasks = this.tasks.filter(task => !taskIds.includes(task.id));
                
                this.renderAllTasks();
                this.clearTaskSelection();
                this.showNotification(`${taskIds.length} taken verwijderd`, 'success');
            } else {
                throw new Error('Bulk delete failed');
            }
        } catch (error) {
            console.error('Error bulk deleting tasks:', error);
            this.showNotification('Fout bij verwijderen van taken', 'error');
        }
    }

    clearTaskSelection() {
        this.selectedTasks.clear();
        document.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        this.updateBulkActionsBar();
    }

    handleTaskSelection(taskId, checked) {
        if (checked) {
            this.selectedTasks.add(taskId);
        } else {
            this.selectedTasks.delete(taskId);
        }
        this.updateBulkActionsBar();
    }

    // ===== SAVED FILTERS METHODS =====
    
    openSaveFilterModal() {
        const modal = new bootstrap.Modal(this.filterElements.saveFilterModal);
        modal.show();
    }

    async saveCurrentFilter() {
        const filterName = this.filterElements.filterName.value.trim();
        const setAsDefault = this.filterElements.setAsDefault.checked;
        
        // Manual validation
        if (!filterName) {
            this.showNotification('Voer een filter naam in', 'warning');
            this.filterElements.filterName.focus();
            return;
        }
        
        const currentFilters = {
            status: this.elements.filterStatus.value,
            priority: this.elements.filterPriority.value,
            type: this.elements.filterType.value,
            assignee: this.elements.filterAssignee.value,
            search: this.elements.searchTasks.value
        };
        
        try {
            const response = await fetch('/api/task-management/saved-filters', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: filterName,
                    filters: currentFilters,
                    isDefault: setAsDefault
                })
            });
            
            if (response.ok) {
                const savedFilter = await response.json();
                this.savedFilters.push(savedFilter);
                this.updateSavedFiltersMenu();
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(this.filterElements.saveFilterModal);
                modal.hide();
                
                // Reset form
                this.filterElements.filterName.value = '';
                this.filterElements.setAsDefault.checked = false;
                
                this.showNotification('Filter opgeslagen', 'success');
            } else {
                throw new Error('Failed to save filter');
            }
        } catch (error) {
            console.error('Error saving filter:', error);
            this.showNotification('Fout bij opslaan filter', 'error');
        }
    }

    async loadSavedFilters() {
        try {
            const response = await fetch('/api/task-management/saved-filters');
            if (response.ok) {
                this.savedFilters = await response.json();
                this.updateSavedFiltersMenu();
            }
        } catch (error) {
            console.error('Error loading saved filters:', error);
        }
    }

    updateSavedFiltersMenu() {
        const menu = this.filterElements.savedFiltersMenu;
        
        // Clear existing filters (keep the save button)
        const saveBtn = menu.querySelector('#saveCurrentFilterBtn').parentElement;
        const divider = menu.querySelector('.dropdown-divider');
        
        // Remove all items after divider
        let nextElement = divider.nextElementSibling;
        while (nextElement) {
            const toRemove = nextElement;
            nextElement = nextElement.nextElementSibling;
            toRemove.remove();
        }
        
        // Add saved filters
        this.savedFilters.forEach(filter => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="saved-filter-item">
                    <div>
                        <div class="saved-filter-name">${this.escapeHtml(filter.name)}</div>
                        ${filter.isDefault ? '<div class="saved-filter-default">Standaard</div>' : ''}
                    </div>
                    <div class="saved-filter-actions">
                        <button class="btn btn-sm btn-link" onclick="taskManager.applySavedFilter(${filter.id})" title="Toepassen">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="saved-filter-delete" onclick="taskManager.deleteSavedFilter(${filter.id})" title="Verwijderen">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            menu.appendChild(li);
        });
    }

    applySavedFilter(filterId) {
        const filter = this.savedFilters.find(f => f.id === filterId);
        if (!filter) return;
        
        // Apply filters
        this.elements.filterStatus.value = filter.filters.status || '';
        this.elements.filterPriority.value = filter.filters.priority || '';
        this.elements.filterType.value = filter.filters.type || '';
        this.elements.filterAssignee.value = filter.filters.assignee || '';
        this.elements.searchTasks.value = filter.filters.search || '';
        
        // Trigger filter
        this.filterTasks();
        
        this.showNotification(`Filter "${filter.name}" toegepast`, 'success');
    }

    async deleteSavedFilter(filterId) {
        if (!confirm('Weet je zeker dat je dit filter wilt verwijderen?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/task-management/saved-filters/${filterId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.savedFilters = this.savedFilters.filter(f => f.id !== filterId);
                this.updateSavedFiltersMenu();
                this.showNotification('Filter verwijderd', 'success');
            } else {
                throw new Error('Failed to delete filter');
            }
        } catch (error) {
            console.error('Error deleting filter:', error);
            this.showNotification('Fout bij verwijderen filter', 'error');
        }
    }

    // ===== SUBTASKS METHODS =====
    
    showSubtaskForm() {
        if (!this.selectedTaskId) {
            this.showNotification('Selecteer eerst een taak', 'warning');
            return;
        }
        
        if (this.subtaskElements.form) {
            // Populate assignee dropdown
            const assigneeOptions = this.users.map(user => 
                `<option value="${user.id}">${user.full_name || user.username}</option>`
            ).join('');
            this.subtaskElements.assignee.innerHTML = '<option value="">Niet toegewezen</option>' + assigneeOptions;
            
            this.subtaskElements.form.style.display = 'block';
            
            // Restore required attributes when showing
            const fields = this.subtaskElements.form.querySelectorAll('[data-was-required="true"]');
            fields.forEach(field => {
                field.setAttribute('required', '');
                field.removeAttribute('data-was-required');
            });
            
            this.subtaskElements.title.focus();
        }
    }

    hideSubtaskForm() {
        if (this.subtaskElements.form) {
            this.subtaskElements.form.style.display = 'none';
            
            // Remove required attributes when hiding
            const requiredFields = this.subtaskElements.form.querySelectorAll('[required]');
            requiredFields.forEach(field => {
                field.removeAttribute('required');
                field.dataset.wasRequired = 'true'; // Remember it was required
            });
            
            this.resetSubtaskForm();
        }
    }

    resetSubtaskForm() {
        this.subtaskElements.title.value = '';
        this.subtaskElements.priority.value = 'medium';
        this.subtaskElements.assignee.value = '';
        this.subtaskElements.dueDate.value = '';
        this.subtaskElements.description.value = '';
    }

    async saveSubtask() {
        const title = this.subtaskElements.title.value.trim();
        const priority = this.subtaskElements.priority.value;
        const assignee = this.subtaskElements.assignee.value;
        const dueDate = this.subtaskElements.dueDate.value;
        const description = this.subtaskElements.description.value.trim();
        
        // Manual validation since we removed required attributes
        if (!title) {
            this.showNotification('Subtaak titel is verplicht', 'warning');
            this.subtaskElements.title.focus();
            return;
        }
        
        try {
            const response = await fetch('/api/task-management/subtasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    parent_task_id: this.selectedTaskId,
                    title,
                    priority,
                    assignedTo: assignee || null,
                    due_date: dueDate || null,
                    description
                })
            });
            
            if (response.ok) {
                const subtask = await response.json();
                this.showNotification('Subtaak aangemaakt', 'success');
                this.hideSubtaskForm();
                await this.loadSubtasks(this.selectedTaskId);
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Fout bij aanmaken subtaak', 'error');
            }
        } catch (error) {
            console.error('Error creating subtask:', error);
            this.showNotification('Fout bij aanmaken subtaak', 'error');
        }
    }

    async loadSubtasks(taskId) {
        try {
            const response = await fetch(`/api/task-management/${taskId}/subtasks`);
            if (response.ok) {
                this.subtasks = await response.json();
                this.renderSubtasks();
            }
        } catch (error) {
            console.error('Error loading subtasks:', error);
        }
    }

    renderSubtasks() {
        this.subtaskElements.list.innerHTML = '';
        
        this.subtasks.forEach(subtask => {
            const subtaskEl = this.createSubtaskElement(subtask);
            this.subtaskElements.list.appendChild(subtaskEl);
        });
    }

    createSubtaskElement(subtask) {
        const assignee = this.users.find(u => u.id == subtask.assignedTo);
        const dueDate = subtask.due_date ? new Date(subtask.due_date) : null;
        
        const div = document.createElement('div');
        div.className = 'subtask-item';
        div.dataset.subtaskId = subtask.id;
        
        div.innerHTML = `
            <input type="checkbox" class="subtask-checkbox" ${subtask.status === 'done' ? 'checked' : ''} 
                   onchange="taskManager.toggleSubtaskStatus(${subtask.id}, this.checked)">
            <div class="subtask-content">
                <div class="subtask-title">${this.escapeHtml(subtask.title)}</div>
                <div class="subtask-meta">
                    <span class="subtask-status ${subtask.status}">${this.formatStatus(subtask.status)}</span>
                    <span class="subtask-priority priority-${subtask.priority}">${subtask.priority}</span>
                    ${assignee ? `<span>👤 ${assignee.full_name || assignee.username}</span>` : ''}
                    ${dueDate ? `<span>📅 ${this.formatDate(dueDate)}</span>` : ''}
                </div>
            </div>
            <div class="subtask-actions">
                <button class="subtask-action-btn" onclick="taskManager.editSubtask(${subtask.id})" title="Bewerken">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="subtask-action-btn" onclick="taskManager.deleteSubtask(${subtask.id})" title="Verwijderen">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        return div;
    }

    async toggleSubtaskStatus(subtaskId, completed) {
        const status = completed ? 'done' : 'todo';
        
        try {
            const response = await fetch(`/api/task-management/subtasks/${subtaskId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });
            
            if (response.ok) {
                const subtask = this.subtasks.find(s => s.id === subtaskId);
                if (subtask) {
                    subtask.status = status;
                    if (completed) {
                        subtask.completed_at = new Date().toISOString();
                    } else {
                        subtask.completed_at = null;
                    }
                }
                this.renderSubtasks();
            } else {
                throw new Error('Failed to update subtask status');
            }
        } catch (error) {
            console.error('Error updating subtask status:', error);
            this.showNotification('Fout bij bijwerken subtaak', 'error');
        }
    }

    async deleteSubtask(subtaskId) {
        if (!confirm('Weet je zeker dat je deze subtaak wilt verwijderen?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/task-management/subtasks/${subtaskId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.subtasks = this.subtasks.filter(s => s.id !== subtaskId);
                this.renderSubtasks();
                this.showNotification('Subtaak verwijderd', 'success');
            } else {
                throw new Error('Failed to delete subtask');
            }
        } catch (error) {
            console.error('Error deleting subtask:', error);
            this.showNotification('Fout bij verwijderen subtaak', 'error');
        }
    }

    // ===== MILESTONES METHODS =====
    
    openMilestonesModal() {
        this.loadMilestones();
        const modal = new bootstrap.Modal(this.milestoneElements.modal);
        modal.show();
    }

    showMilestoneForm() {
        this.milestoneElements.form.style.display = 'block';
        this.milestoneElements.title.focus();
    }

    hideMilestoneForm() {
        this.milestoneElements.form.style.display = 'none';
        this.resetMilestoneForm();
    }

    resetMilestoneForm() {
        this.milestoneElements.title.value = '';
        this.milestoneElements.color.value = '#3b82f6';
        this.milestoneElements.description.value = '';
        this.milestoneElements.dueDate.value = '';
    }

    async saveMilestone() {
        const title = this.milestoneElements.title.value.trim();
        const color = this.milestoneElements.color.value;
        const description = this.milestoneElements.description.value.trim();
        const dueDate = this.milestoneElements.dueDate.value;
        
        // Manual validation since we removed required attributes
        if (!title) {
            this.showNotification('Mijlpaal titel is verplicht', 'warning');
            this.milestoneElements.title.focus();
            return;
        }
        
        if (!dueDate) {
            this.showNotification('Einddatum is verplicht', 'warning');
            this.milestoneElements.dueDate.focus();
            return;
        }
        
        try {
            const response = await fetch('/api/task-management/milestones', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title,
                    color,
                    description,
                    due_date: dueDate
                })
            });
            
            if (response.ok) {
                const milestone = await response.json();
                this.showNotification('Mijlpaal aangemaakt', 'success');
                this.hideMilestoneForm();
                await this.loadMilestones();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Fout bij aanmaken mijlpaal', 'error');
            }
        } catch (error) {
            console.error('Error creating milestone:', error);
            this.showNotification('Fout bij aanmaken mijlpaal', 'error');
        }
    }

    async loadMilestones() {
        try {
            const response = await fetch('/api/task-management/milestones');
            if (response.ok) {
                this.milestones = await response.json();
                this.renderMilestones();
                this.updateMilestoneSelects();
            }
        } catch (error) {
            console.error('Error loading milestones:', error);
        }
    }

    renderMilestones() {
        this.milestoneElements.list.innerHTML = '';
        
        this.milestones.forEach(milestone => {
            const milestoneEl = this.createMilestoneElement(milestone);
            this.milestoneElements.list.appendChild(milestoneEl);
        });
    }

    createMilestoneElement(milestone) {
        const dueDate = new Date(milestone.due_date);
        const now = new Date();
        const isOverdue = dueDate < now && milestone.status !== 'completed';
        
        // Calculate progress based on associated tasks
        const associatedTasks = this.tasks.filter(t => t.milestone_id === milestone.id);
        const completedTasks = associatedTasks.filter(t => t.status === 'done');
        const progress = associatedTasks.length > 0 ? (completedTasks.length / associatedTasks.length) * 100 : 0;
        
        const div = document.createElement('div');
        div.className = 'milestone-item';
        div.style.setProperty('--milestone-color', milestone.color);
        
        div.innerHTML = `
            <div class="milestone-header">
                <h6 class="milestone-title">${this.escapeHtml(milestone.title)}</h6>
                <div>
                    <span class="milestone-status ${isOverdue ? 'overdue' : (progress === 100 ? 'completed' : 'pending')}">
                        ${isOverdue ? 'Verlopen' : (progress === 100 ? 'Voltooid' : 'Lopend')}
                    </span>
                    <button class="btn btn-sm btn-danger ms-2" onclick="taskManager.deleteMilestone(${milestone.id})" title="Verwijderen">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            ${milestone.description ? `<p class="text-muted">${this.escapeHtml(milestone.description)}</p>` : ''}
            <div class="milestone-progress">
                <div class="milestone-progress-bar">
                    <div class="milestone-progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="milestone-progress-text">
                    ${completedTasks.length}/${associatedTasks.length} taken voltooid (${Math.round(progress)}%)
                </div>
            </div>
            <div class="milestone-due-date">
                <i class="fas fa-calendar"></i>
                Einddatum: ${this.formatDate(dueDate)}
            </div>
        `;
        
        return div;
    }

    updateMilestoneSelects() {
        const milestoneOptions = this.milestones.map(milestone => 
            `<option value="${milestone.id}">${milestone.title}</option>`
        ).join('');
        
        if (this.milestoneElements.taskMilestone) {
            this.milestoneElements.taskMilestone.innerHTML = '<option value="">Geen mijlpaal</option>' + milestoneOptions;
        }
    }

    async deleteMilestone(milestoneId) {
        if (!confirm('Weet je zeker dat je deze mijlpaal wilt verwijderen?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/task-management/milestones/${milestoneId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.milestones = this.milestones.filter(m => m.id !== milestoneId);
                this.renderMilestones();
                this.updateMilestoneSelects();
                this.showNotification('Mijlpaal verwijderd', 'success');
            } else {
                throw new Error('Failed to delete milestone');
            }
        } catch (error) {
            console.error('Error deleting milestone:', error);
            this.showNotification('Fout bij verwijderen mijlpaal', 'error');
        }
    }

    // ===== NOTIFICATION SETTINGS METHODS =====
    
    async openNotificationSettings() {
        // Load current settings
        await this.loadNotificationSettings();
        
        const modal = new bootstrap.Modal(this.notificationElements.modal);
        modal.show();
    }

    async loadNotificationSettings() {
        try {
            const response = await fetch('/api/task-management/notification-settings');
            if (response.ok) {
                const settings = await response.json();
                
                // Update checkboxes based on settings
                this.notificationElements.taskAssigned.checked = settings.task_assigned || false;
                this.notificationElements.taskCommented.checked = settings.task_commented || false;
                this.notificationElements.taskStatusChanged.checked = settings.task_status_changed || false;
                this.notificationElements.taskDueSoon.checked = settings.task_due_soon || false;
                this.notificationElements.taskOverdue.checked = settings.task_overdue || false;
            } else {
                // Set default values if no settings found
                this.notificationElements.taskAssigned.checked = true;
                this.notificationElements.taskCommented.checked = true;
                this.notificationElements.taskStatusChanged.checked = true;
                this.notificationElements.taskDueSoon.checked = true;
                this.notificationElements.taskOverdue.checked = true;
            }
        } catch (error) {
            console.error('Error loading notification settings:', error);
            this.showNotification('Fout bij laden notificatie instellingen', 'error');
        }
    }

    async saveNotificationSettings() {
        try {
            const settings = {
                task_assigned: this.notificationElements.taskAssigned.checked,
                task_commented: this.notificationElements.taskCommented.checked,
                task_status_changed: this.notificationElements.taskStatusChanged.checked,
                task_due_soon: this.notificationElements.taskDueSoon.checked,
                task_overdue: this.notificationElements.taskOverdue.checked
            };
            
            const response = await fetch('/api/task-management/notification-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });
            
            if (response.ok) {
                this.showNotification('Notificatie instellingen opgeslagen', 'success');
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(this.notificationElements.modal);
                if (modal) {
                    modal.hide();
                }
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Fout bij opslaan instellingen', 'error');
            }
        } catch (error) {
            console.error('Error saving notification settings:', error);
            this.showNotification('Fout bij opslaan instellingen', 'error');
        }
    }
    
    // Test email notification
    async testEmailNotification() {
        try {
            const email = prompt('Voer je email adres in voor de test:');
            if (!email) return;
            
            const type = prompt('Voer notificatie type in (task_assigned, task_commented, task_status_changed, task_due_soon, task_overdue):', 'task_assigned');
            if (!type) return;
            
            const response = await fetch('/api/task-management/test-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, type })
            });
            
            if (response.ok) {
                this.showNotification('Test email verzonden!', 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Fout bij verzenden test email', 'error');
            }
        } catch (error) {
            console.error('Error sending test email:', error);
            this.showNotification('Fout bij verzenden test email', 'error');
        }
    }

    async openProfileSettings() {
        // Load current user data
        await this.loadProfileSettings();
        
        const modal = new bootstrap.Modal(this.profileElements.modal);
        modal.show();
    }
    
    async loadProfileSettings() {
        try {
            const response = await fetch('/api/task-management/profile');
            if (response.ok) {
                const user = await response.json();
                
                // Populate form fields
                this.profileElements.username.value = user.username || '';
                this.profileElements.fullName.value = user.full_name || '';
                this.profileElements.email.value = user.email || '';
                this.profileElements.role.value = user.role || 'member';
            } else {
                console.error('Failed to load profile settings');
                this.showNotification('Fout bij laden profiel gegevens', 'error');
            }
        } catch (error) {
            console.error('Error loading profile settings:', error);
            this.showNotification('Fout bij laden profiel gegevens', 'error');
        }
    }

    async saveProfileSettings() {
        const fullName = this.profileElements.fullName.value.trim();
        const email = this.profileElements.email.value.trim();
        
        if (!fullName) {
            this.showNotification('Volledige naam is verplicht', 'warning');
            return;
        }
        
        if (!email) {
            this.showNotification('Email adres is verplicht', 'warning');
            return;
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showNotification('Ongeldig email adres formaat', 'warning');
            return;
        }
        
        try {
            const response = await fetch('/api/task-management/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fullName, email })
            });
            
            if (response.ok) {
                this.showNotification('Profiel opgeslagen', 'success');
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(this.profileElements.modal);
                if (modal) {
                    modal.hide();
                }
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Fout bij opslaan profiel', 'error');
            }
        } catch (error) {
            console.error('Error saving profile:', error);
            this.showNotification('Fout bij opslaan profiel', 'error');
        }
    }

    shouldTaskBeVisible(task) {
        if (!this.currentFilter) {
            return true; // No filter, show all tasks
        }
        
        if (this.currentFilter.type === 'view') {
            switch (this.currentFilter.value) {
                case 'my-tasks':
                    return task.assignedTo == this.currentUser?.id;
                case 'watching':
                    const watchers = task.watchers || task.watching || task.watched_by || task.followers;
                    console.log('Checking if task', task.id, 'is watched by user', this.currentUser?.id);
                    console.log('Task watchers:', watchers);
                    
                    if (!watchers || !Array.isArray(watchers)) {
                        console.log('No watchers array found');
                        return false;
                    }
                    
                    const isWatching = watchers.includes(this.currentUser?.id) || watchers.includes(String(this.currentUser?.id));
                    console.log('User is watching:', isWatching);
                    return isWatching;
                case 'tasks':
                default:
                    return true;
            }
        }
        
        if (this.currentFilter.type === 'quick') {
            const [key, value] = this.currentFilter.value.split(':');
            switch (key) {
                case 'priority':
                    return task.priority === value;
                case 'due':
                    if (value === 'today') {
                        if (!task.due_date) return false;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const tomorrow = new Date(today);
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        const dueDate = new Date(task.due_date);
                        return dueDate >= today && dueDate < tomorrow;
                    } else if (value === 'overdue') {
                        if (!task.due_date) return false;
                        const now = new Date();
                        return new Date(task.due_date) < now && task.status !== 'done';
                    }
                    break;
            }
        }
        
        return true;
    }
}

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
}); 