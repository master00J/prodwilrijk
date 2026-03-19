// TaskNotification.js - Add this to your project
const TaskNotification = () => {
    const [tasks, setTasks] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [stats, setStats] = useState({
        overdueCount: 0,
        dueTodayCount: 0,
        assignedToMeCount: 0
    });
    const dropdownRef = useRef(null);
    
    // Fetch tasks and calculate stats
    const fetchTasks = async () => {
        try {
            const response = await fetch('/api/tasks', { credentials: 'include' });
            const data = await response.json();
            
            if (data.tasks) {
                setTasks(data.tasks.slice(0, 5)); // Get the 5 most recent/important tasks
                
                // Calculate stats
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                
                const overdue = data.tasks.filter(task => 
                    task.dueDate && new Date(task.dueDate) < today
                );
                
                const dueToday = data.tasks.filter(task => 
                    task.dueDate && 
                    new Date(task.dueDate) >= today && 
                    new Date(task.dueDate) < tomorrow
                );
                
                // Get current user
                const userResponse = await fetch('/api/checkAuth', { credentials: 'include' });
                const userData = await userResponse.json();
                
                const assignedToMe = userData.isAuthenticated ? 
                    data.tasks.filter(task => 
                        task.assignedTo === userData.user.username
                    ) : [];
                
                setStats({
                    overdueCount: overdue.length,
                    dueTodayCount: dueToday.length,
                    assignedToMeCount: assignedToMe.length
                });
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
        }
    };
    
    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    
    // Fetch tasks on component mount and every 5 minutes
    useEffect(() => {
        fetchTasks();
        const interval = setInterval(fetchTasks, 300000); // 5 minutes
        
        return () => clearInterval(interval);
    }, []);
    
    // Mark task as complete
    const completeTask = async (taskId) => {
        try {
            await fetch(`/api/tasks/${taskId}/complete`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            fetchTasks(); // Refresh tasks
        } catch (error) {
            console.error('Error completing task:', error);
        }
    };
    
    // Calculate total notification count
    const totalNotifications = stats.overdueCount + stats.dueTodayCount;
    
    // Determine badge color (danger for overdue, warning for due today)
    const getBadgeClass = () => {
        if (stats.overdueCount > 0) return "bg-danger";
        if (stats.dueTodayCount > 0) return "bg-warning text-dark";
        return "bg-info";
    };
    
    // Get task priority badge class
    const getPriorityBadgeClass = (priority) => {
        switch (priority) {
            case 'High': return 'bg-danger';
            case 'Medium': return 'bg-warning text-dark';
            case 'Low': return 'bg-success';
            default: return 'bg-secondary';
        }
    };
    
    // Format date to show how many days overdue or remaining
    const formatTaskDate = (dateString) => {
        const dueDate = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const diffTime = dueDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            return `${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'dag' : 'dagen'} te laat`;
        } else if (diffDays === 0) {
            return 'Vandaag';
        } else if (diffDays === 1) {
            return 'Morgen';
        } else {
            return `${diffDays} dagen resterend`;
        }
    };
    
    return (
        <div className="nav-item dropdown" ref={dropdownRef} style={{ position: 'relative' }}>
            <a
                className="nav-link"
                href="#"
                role="button"
                onClick={() => setShowDropdown(!showDropdown)}
                style={{ display: 'flex', alignItems: 'center' }}
            >
                <i className="fas fa-tasks me-1"></i>
                <span className="d-none d-md-inline">Taken</span>
                {totalNotifications > 0 && (
                    <span className={`badge ${getBadgeClass()} ms-1`}>{totalNotifications}</span>
                )}
            </a>
            
            {showDropdown && (
                <div className="dropdown-menu dropdown-menu-end show" style={{ minWidth: '300px', maxWidth: '350px' }}>
                    <h6 className="dropdown-header">Taak Overzicht</h6>
                    
                    <div className="px-3 py-2 d-flex justify-content-between">
                        <span className="badge bg-danger me-1">{stats.overdueCount} Te Laat</span>
                        <span className="badge bg-warning text-dark me-1">{stats.dueTodayCount} Vandaag</span>
                        <span className="badge bg-info">{stats.assignedToMeCount} Voor Mij</span>
                    </div>
                    
                    <div className="dropdown-divider"></div>
                    
                    {tasks.length > 0 ? (
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {tasks.map(task => {
                                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
                                return (
                                    <div key={task.id} className="dropdown-item" style={{ whiteSpace: 'normal' }}>
                                        <div className="d-flex justify-content-between align-items-start">
                                            <div>
                                                <div className="d-flex align-items-center">
                                                    <span className={`badge ${getPriorityBadgeClass(task.priority)} me-1`}>
                                                        {task.priority}
                                                    </span>
                                                    <strong>{task.title}</strong>
                                                </div>
                                                <small className="text-muted d-block">
                                                    <i className="fas fa-user-circle me-1"></i>{task.assignedTo}
                                                </small>
                                                {task.dueDate && (
                                                    <small className={`d-block ${isOverdue ? 'text-danger' : 'text-muted'}`}>
                                                        <i className="fas fa-calendar-alt me-1"></i>
                                                        {formatTaskDate(task.dueDate)}
                                                    </small>
                                                )}
                                            </div>
                                            <button
                                                className="btn btn-sm btn-outline-success mt-1"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    completeTask(task.id);
                                                }}
                                                title="Markeer als voltooid"
                                            >
                                                <i className="fas fa-check"></i>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="dropdown-item text-center">
                            <span className="text-muted">Geen openstaande taken</span>
                        </div>
                    )}
                    
                    <div className="dropdown-divider"></div>
                    
                    <a className="dropdown-item text-center" href="/tasks.html">
                        <i className="fas fa-list me-1"></i> Alle taken bekijken
                    </a>
                    <a className="dropdown-item text-center" href="/tasks.html" onClick={(e) => {
                        e.preventDefault();
                        window.location.href = '/tasks.html?action=add';
                    }}>
                        <i className="fas fa-plus me-1"></i> Nieuwe taak
                    </a>
                </div>
            )}
        </div>
    );
};

// Export the component to be used in the header
export default TaskNotification;