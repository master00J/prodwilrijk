// App.js
const { useState, useEffect } = React;
import { ChatModal } from './ChatComponents.js';
import { createSocketInstance } from './socket.js';

const LoginForm = ({ onLogin }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (response.ok) {
                onLogin();
            } else {
                const data = await response.json();
                alert(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (response.ok) {
                alert('Registration successful. You will be approved by admin before you can login.');
                setIsRegistering(false);
            } else {
                const data = await response.json();
                alert(data.error || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
        }
    };

    return (
        <div className="container mt-5">
            <h2>{isRegistering ? 'Register' : 'Login'}</h2>
            <form onSubmit={isRegistering ? handleRegister : handleSubmit}>
                <div className="mb-3">
                    <label className="form-label">Username</label>
                    <input
                        type="text"
                        className="form-control"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>
                <div className="mb-3">
                    <label className="form-label">Password</label>
                    <input
                        type="password"
                        className="form-control"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit" className="btn btn-primary">
                    {isRegistering ? 'Create Account' : 'Login'}
                </button>
            </form>
            <div className="mt-3">
                <button
                    onClick={() => setIsRegistering(!isRegistering)}
                    className="btn btn-link"
                >
                    {isRegistering ? 'Back to Login' : 'Create an Account'}
                </button>
            </div>
        </div>
    );
};

const TaskManager = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [completedTasks, setCompletedTasks] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showAddTask, setShowAddTask] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [filterPriority, setFilterPriority] = useState('');

    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        assignedTo: '',
        frequency: 'daily',
        priority: 'Medium',
        dueDate: ''
    });

    const [usersList, setUsersList] = useState([]);
    const [showChatUsersModal, setShowChatUsersModal] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [socketInstance, setSocketInstance] = useState(null);

    const [dashboardStats, setDashboardStats] = useState({
        dueToday: 0,
        overdue: 0,
        completedThisWeek: 0
    });

    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        checkAuthentication();
    }, []);

    const checkAuthentication = async () => {
        try {
            const response = await fetch('/api/checkAuth', { credentials: 'include' });
            const data = await response.json();
            setIsAuthenticated(data.isAuthenticated);
            setUser(data.user || null);
            if (data.isAuthenticated) {
                await loadTasks();
                await loadDashboardStats();
                const interval = setInterval(() => {
                    loadTasks();
                    loadDashboardStats();
                }, 60000);

                const socket = createSocketInstance();
                setSocketInstance(socket);

                socket.on('receive_message', (msg) => {
                    if (!selectedUser || selectedUser.id !== msg.sender_id) {
                        setUnreadCount(prev => prev + 1);
                    }
                });

                setIsLoading(false);
                return () => {
                    clearInterval(interval);
                    if (socket) socket.disconnect();
                };
            } else {
                setIsLoading(false);
            }
        } catch (error) {
            console.error('Auth check error:', error);
            setIsLoading(false);
        }
    };

    const loadDashboardStats = async () => {
        const response = await fetch('/api/task_stats', { credentials: 'include' });
        const data = await response.json();
        setDashboardStats(data);
    };

    const handleLogin = () => {
        checkAuthentication();
    };

    const handleLogout = async () => {
        await fetch('/api/logout', { method: 'POST', credentials: 'include' });
        setIsAuthenticated(false);
        setUser(null);
        setTasks([]);
        setCompletedTasks([]);
        if (socketInstance) socketInstance.disconnect();
    };

    const loadTasks = async () => {
        try {
            const response = await fetch('/api/tasks', { credentials: 'include' });
            const data = await response.json();
            setTasks(data.tasks || []);
            setCompletedTasks(data.completedTasks || []);
        } catch (error) {
            console.error('Error loading tasks:', error);
            setTasks([]);
            setCompletedTasks([]);
        }
    };

    const markTaskComplete = async (taskId) => {
        try {
            await fetch(`/api/tasks/${taskId}/complete`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            loadTasks();
            loadDashboardStats();
        } catch (error) {
            console.error('Error marking task complete:', error);
        }
    };

    const addNewTask = async () => {
        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTask)
            });
            if (!response.ok) {
                const data = await response.json();
                alert(data.error || 'Error adding task.');
            }
            setShowAddTask(false);
            setNewTask({
                title: '',
                description: '',
                assignedTo: '',
                frequency: 'daily',
                priority: 'Medium',
                dueDate: ''
            });
            loadTasks();
            loadDashboardStats();
        } catch (error) {
            console.error('Error adding task:', error);
        }
    };

    const getBadgeClass = (priority) => {
        switch (priority) {
            case 'High':
                return 'bg-danger';
            case 'Medium':
                return 'bg-warning text-dark';
            case 'Low':
                return 'bg-success';
            default:
                return 'bg-secondary';
        }
    };

    const openChatUsersModal = async () => {
        try {
            const response = await fetch('/api/users', { credentials: 'include' });
            const data = await response.json();
            setUsersList(data.filter(u => u.username !== user.username));
            setShowChatUsersModal(true);
        } catch (error) {
            console.error('Error loading users:', error);
        }
    };

    const startChatWithUser = (selectedUser) => {
        setSelectedUser(selectedUser);
        setShowChatUsersModal(false);
        setShowChatModal(true);
    };

    const handleChatClose = () => {
        setShowChatModal(false);
        setSelectedUser(null);
    };

    const handleMessagesRead = (userId) => {
        setUnreadCount(0);
    };

    if (isLoading) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <LoginForm onLogin={handleLogin} />;
    }

    const sortedTasks = [...tasks].sort((a, b) => {
        const priorities = { High: 1, Medium: 2, Low: 3 };
        return priorities[a.priority] - priorities[b.priority];
    });

    const filteredTasks = sortedTasks.filter((task) => {
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPriority = filterPriority ? task.priority === filterPriority : true;
        return matchesSearch && matchesPriority;
    });

    return (
        <div>
            <nav className="navbar navbar-expand-lg navbar-light bg-light">
                <div className="container-fluid">
                    <a className="navbar-brand" href="/">
                        <i className="fas fa-home"></i> Foresco
                    </a>
                    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                        <span className="navbar-toggler-icon"></span>
                    </button>

                    <div className="collapse navbar-collapse" id="navbarNav">
                        <ul className="navbar-nav me-auto mb-2 mb-lg-0"></ul>
                        <span className="navbar-text me-3">
                            Logged in as: {(user && user.username) ? user.username : 'User'}
                        </span>
                        <div className="btn-group me-2" style={{ position: 'relative' }}>
                            <button onClick={openChatUsersModal} className="btn btn-outline-secondary">
                                <i className="fas fa-comments me-1"></i>Messages
                                {unreadCount > 0 && (
                                    <span className="notification-badge">{unreadCount}</span>
                                )}
                            </button>
                        </div>
                        <button onClick={handleLogout} className="btn btn-outline-danger">
                            Logout
                        </button>
                    </div>
                </div>
            </nav>

            <div className="container my-4">
                <div className="mb-4">
                    <div className="row text-center">
                        <div className="col">
                            <h5>Due Today</h5>
                            <span className="badge bg-info">{dashboardStats.dueToday}</span>
                        </div>
                        <div className="col">
                            <h5>Overdue</h5>
                            <span className="badge bg-danger">{dashboardStats.overdue}</span>
                        </div>
                        <div className="col">
                            <h5>Completed This Week</h5>
                            <span className="badge bg-success">{dashboardStats.completedThisWeek}</span>
                        </div>
                    </div>
                </div>

                <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
                    <h1 className="h3"><i className="fas fa-tasks me-2"></i>Task List</h1>
                    <div className="btn-group">
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="btn btn-primary"
                        >
                            <i className="fas fa-list me-2"></i>
                            {showHistory ? 'Show Tasks' : 'Show History'}
                        </button>
                        <button
                            onClick={() => setShowAddTask(true)}
                            className="btn btn-success"
                        >
                            <i className="fas fa-plus me-2"></i>
                            New Task
                        </button>
                    </div>
                </div>

                {!showHistory && (
                    <div className="mb-4">
                        <div className="row g-2">
                            <div className="col-md-6">
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search tasks..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="col-md-6">
                                <select
                                    className="form-select"
                                    value={filterPriority}
                                    onChange={(e) => setFilterPriority(e.target.value)}
                                >
                                    <option value="">All Priorities</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {showAddTask && (
                    <div className="modal show d-block" tabIndex="-1">
                        <div className="modal-dialog">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">Add New Task</h5>
                                    <button
                                        type="button"
                                        className="btn-close"
                                        onClick={() => setShowAddTask(false)}
                                    ></button>
                                </div>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label">Title</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={newTask.title}
                                            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Description</label>
                                        <textarea
                                            className="form-control"
                                            value={newTask.description}
                                            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                        ></textarea>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Assigned To</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={newTask.assignedTo}
                                            onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Frequency</label>
                                        <select
                                            className="form-select"
                                            value={newTask.frequency}
                                            onChange={(e) => setNewTask({ ...newTask, frequency: e.target.value })}
                                        >
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Priority</label>
                                        <select
                                            className="form-select"
                                            value={newTask.priority}
                                            onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                                        >
                                            <option value="High">High</option>
                                            <option value="Medium">Medium</option>
                                            <option value="Low">Low</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Due Date</label>
                                        <input
                                            type="date"
                                            className="form-control"
                                            value={newTask.dueDate}
                                            onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setShowAddTask(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-success"
                                        onClick={addNewTask}
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!showHistory ? (
                    <div className="row">
                        {filteredTasks.map((task) => {
                            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
                            const lastCompleted = task.lastCompleted ? new Date(task.lastCompleted) : null;
                            const now = new Date();
                            let progress = 0;
                            if (task.frequency !== 'one-time') {
                                const totalInterval = task.frequency === 'daily' ? 1 : (task.frequency === 'weekly' ? 7 : 30);
                                if (lastCompleted) {
                                    const diffDays = Math.floor((now - lastCompleted) / (1000*60*60*24));
                                    const remaining = Math.max(totalInterval - diffDays, 0);
                                    progress = ((totalInterval - remaining) / totalInterval) * 100;
                                }
                            }

                            return (
                                <div key={task.id} className="col-md-6">
                                    <div className={`card task-card ${isOverdue ? 'overdue' : ''}`}>
                                        <div className="card-body">
                                            <div className="d-flex justify-content-between">
                                                <h5 className="card-title">
                                                    <span className={`badge ${getBadgeClass(task.priority)}`}>
                                                        {task.priority}
                                                    </span>
                                                    {task.title}
                                                </h5>
                                                <button
                                                    onClick={() => markTaskComplete(task.id)}
                                                    className="btn btn-sm btn-success"
                                                >
                                                    <i className="fas fa-check-circle"></i>
                                                </button>
                                            </div>
                                            <h6 className="card-subtitle mb-2 text-muted">
                                                <i className="fas fa-user me-1"></i>
                                                <span className="username">{task.assignedTo}</span>
                                            </h6>
                                            <p className="card-text">{task.description}</p>
                                            <p className="card-text">
                                                <small className="text-muted">
                                                    <i className="fas fa-redo me-1"></i> Frequency: {task.frequency}
                                                    {task.dueDate && (
                                                        <span>
                                                            {' '}| <i className="fas fa-calendar-alt me-1"></i> Due: {new Date(task.dueDate).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </small>
                                            </p>
                                            {task.frequency !== 'one-time' && (
                                                <div className="progress" style={{height:'5px'}}>
                                                    <div className="progress-bar" role="progressbar" style={{width: `${progress}%`}} aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="list-group">
                        {completedTasks.length > 0 ? (
                            completedTasks.map((task) => (
                                <div key={task.id} className="list-group-item">
                                    <h5 className="mb-1">{task.title}</h5>
                                    <p className="mb-1">{task.description}</p>
                                    <small className="text-muted">
                                        Completed by: {task.completedBy} on {new Date(task.completedAt).toLocaleString()}
                                    </small>
                                </div>
                            ))
                        ) : (
                            <p className="text-center">No completed tasks.</p>
                        )}
                    </div>
                )}
            </div>

            {showChatUsersModal && (
                <div className="modal show d-block">
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Select user to chat with</h5>
                                <button type="button" className="btn-close" onClick={() => setShowChatUsersModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                {usersList.length > 0 ? (
                                    <ul className="list-group">
                                        {usersList.map(u => (
                                            <li
                                                key={u.id}
                                                className="list-group-item d-flex justify-content-between align-items-center"
                                            >
                                                <span>{u.username}</span>
                                                <button
                                                    className="btn btn-sm btn-primary"
                                                    onClick={() => startChatWithUser(u)}
                                                >
                                                    Chat
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>No other users found.</p>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setShowChatUsersModal(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ChatModal
                show={showChatModal}
                onClose={handleChatClose}
                currentUser={user}
                selectedUser={selectedUser}
                socket={socketInstance}
                onMessagesRead={handleMessagesRead}
            />
        </div>
    );
};

// Renderen in de index.html
ReactDOM.createRoot(document.getElementById('root')).render(<TaskManager />);
