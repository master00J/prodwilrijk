// TaskManager.js

// Import React hooks
const { useState, useEffect } = React;

const LoginForm = ({ onLogin }) => {
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

    return (
        <div className="container mt-5">
            <h2>Login</h2>
            <form onSubmit={handleSubmit}>
                <div className="mb-3">
                    <label className="form-label">Gebruikersnaam</label>
                    <input
                        type="text"
                        className="form-control"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>
                <div className="mb-3">
                    <label className="form-label">Wachtwoord</label>
                    <input
                        type="password"
                        className="form-control"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit" className="btn btn-primary">Inloggen</button>
            </form>
        </div>
    );
};

const TaskManager = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [tasks, setTasks] = useState([]);
    const [completedTasks, setCompletedTasks] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showAddTask, setShowAddTask] = useState(false);
    const [user, setUser] = useState(null);

    // New state variables for search and filter
    const [searchQuery, setSearchQuery] = useState('');
    const [filterPriority, setFilterPriority] = useState('');

    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        assignedTo: '',
        frequency: 'daily',
        priority: 'Medium',
        dueDate: '',
    });

    useEffect(() => {
        checkAuthentication();
    }, []);

    const checkAuthentication = async () => {
        try {
            const response = await fetch('/api/checkAuth', { credentials: 'include' });
            const data = await response.json();
            setIsAuthenticated(data.isAuthenticated);
            setUser(data.user);
            if (data.isAuthenticated) {
                loadTasks();
                const interval = setInterval(loadTasks, 60000); // Refresh every minute
                return () => clearInterval(interval);
            }
        } catch (error) {
            console.error('Auth check error:', error);
        }
    };

    const handleLogin = () => {
        setIsAuthenticated(true);
        checkAuthentication();
    };

    const handleLogout = async () => {
        await fetch('/api/logout', { method: 'POST', credentials: 'include' });
        setIsAuthenticated(false);
        setUser(null);
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
        } catch (error) {
            console.error('Error marking task complete:', error);
        }
    };

    const addNewTask = async () => {
        try {
            await fetch('/api/tasks', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTask)
            });
            setShowAddTask(false);
            setNewTask({
                title: '',
                description: '',
                assignedTo: '',
                frequency: 'daily',
                priority: 'Medium',
                dueDate: '',
            });
            loadTasks();
        } catch (error) {
            console.error('Error adding task:', error);
        }
    };

    // Sort tasks by priority
    const sortedTasks = [...tasks].sort((a, b) => {
        const priorities = { High: 1, Medium: 2, Low: 3 };
        return priorities[a.priority] - priorities[b.priority];
    });

    // Filter tasks based on search query and priority
    const filteredTasks = sortedTasks.filter((task) => {
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPriority = filterPriority ? task.priority === filterPriority : true;
        return matchesSearch && matchesPriority;
    });

    // Function to get badge class based on priority
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

    if (!isAuthenticated) {
        return <LoginForm onLogin={handleLogin} />;
    }

    return (
        <div>
            {/* Navbar with User Info and Logout */}
            <nav className="navbar navbar-expand-lg navbar-light bg-light">
                <div className="container-fluid">
                    <a className="navbar-brand" href="/">
                        <i className="fas fa-home"></i> Foresco
                    </a>
                    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                        <span className="navbar-toggler-icon"></span>
                    </button>

                    <div className="collapse navbar-collapse" id="navbarNav">
                        {/* Your navbar links here */}
                        <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                            {/* ... */}
                        </ul>

                        <span className="navbar-text me-3">
                            Ingelogd als: {user.username}
                        </span>
                        <button onClick={handleLogout} className="btn btn-outline-danger">
                            Uitloggen
                        </button>
                    </div>
                </div>
            </nav>

            <div className="container my-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
                    <h1 className="h3"><i className="fas fa-tasks me-2"></i>Foresco Taken</h1>
                    <div className="btn-group">
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="btn btn-primary"
                        >
                            <i className="fas fa-list me-2"></i>
                            {showHistory ? 'Toon Taken' : 'Toon Geschiedenis'}
                        </button>
                        <button
                            onClick={() => setShowAddTask(true)}
                            className="btn btn-success"
                        >
                            <i className="fas fa-plus me-2"></i>
                            Nieuwe Taak
                        </button>
                    </div>
                </div>

                {/* Search and Filter */}
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
                                    <h5 className="modal-title">Nieuwe Taak Toevoegen</h5>
                                    <button
                                        type="button"
                                        className="btn-close"
                                        onClick={() => setShowAddTask(false)}
                                    ></button>
                                </div>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label">Titel</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={newTask.title}
                                            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Beschrijving</label>
                                        <textarea
                                            className="form-control"
                                            value={newTask.description}
                                            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                        ></textarea>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Toegewezen Aan</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={newTask.assignedTo}
                                            onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Frequentie</label>
                                        <select
                                            className="form-select"
                                            value={newTask.frequency}
                                            onChange={(e) => setNewTask({ ...newTask, frequency: e.target.value })}
                                        >
                                            <option value="daily">Dagelijks</option>
                                            <option value="weekly">Wekelijks</option>
                                            <option value="monthly">Maandelijks</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Prioriteit</label>
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
                                        <label className="form-label">Vervaldatum</label>
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
                                        Annuleren
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-success"
                                        onClick={addNewTask}
                                    >
                                        Toevoegen
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
                                                <i className="fas fa-user me-1"></i> {task.assignedTo}
                                            </h6>
                                            <p className="card-text">{task.description}</p>
                                            <p className="card-text">
                                                <small className="text-muted">
                                                    <i className="fas fa-redo me-1"></i> Frequentie: {task.frequency}
                                                    {task.dueDate && (
                                                        <span>
                                                            {' '}| <i className="fas fa-calendar-alt me-1"></i> Vervaldatum: {new Date(task.dueDate).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </small>
                                            </p>
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
                                        Voltooid door: {task.completedBy} op {new Date(task.completedAt).toLocaleString()}
                                    </small>
                                </div>
                            ))
                        ) : (
                            <p className="text-center">Geen voltooide taken.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// Render the TaskManager component into the root div
ReactDOM.createRoot(document.getElementById('root')).render(<TaskManager />);
