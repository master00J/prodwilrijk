// ChatComponents.js
const { useState, useEffect, useRef } = React;

export const ChatModal = ({ show, onClose, currentUser, selectedUser, socket, onMessagesRead }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [file, setFile] = useState(null);

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const markMessagesAsRead = async () => {
        if (selectedUser && currentUser) {
            await fetch(`/api/messages/mark_read/${selectedUser.id}`, {
                method: 'POST',
                credentials: 'include'
            });
            onMessagesRead(selectedUser.id);
        }
    };

    useEffect(() => {
        if (show && selectedUser && currentUser && currentUser.id !== selectedUser.id) {
            const fetchMessages = async () => {
                const response = await fetch(`/api/messages/${selectedUser.id}`, { credentials: 'include' });
                const data = await response.json();
                setMessages(Array.isArray(data) ? data : []);
                markMessagesAsRead();
            };
            fetchMessages();
        }
    }, [show, selectedUser, currentUser]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (!socket) return;
        const handleReceiveMessage = (msg) => {
            if ((msg.sender_id === selectedUser.id && msg.receiver_id === currentUser.id) ||
                (msg.sender_id === currentUser.id && msg.receiver_id === selectedUser.id)) {
                setMessages(prev => [...prev, msg]);
                if (msg.sender_id === selectedUser.id) {
                    markMessagesAsRead();
                }
            }
        };

        const handleMessageSent = (msg) => {
            if (msg.sender_id === currentUser.id && msg.receiver_id === selectedUser.id) {
                setMessages(prev => [...prev, msg]);
            }
        };

        socket.on('receive_message', handleReceiveMessage);
        socket.on('message_sent', handleMessageSent);

        return () => {
            socket.off('receive_message', handleReceiveMessage);
            socket.off('message_sent', handleMessageSent);
        };
    }, [socket, selectedUser, currentUser]);

    const uploadFile = async () => {
        const formData = new FormData();
        formData.append('file', file);
        const resp = await fetch('/api/messages/upload', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        const data = await resp.json();
        return data.url;
    };

    const sendMessage = async () => {
        if (!newMessage.trim() && !file) return;
        let fileUrl = null;
        if (file) {
            fileUrl = await uploadFile();
        }
        socket.emit('send_message', {
            receiverId: selectedUser.id,
            message: newMessage.trim(),
            fileUrl: fileUrl
        });
        setNewMessage('');
        setFile(null);
    };

    if (!show || !selectedUser) return null;

    return (
        <div className="modal show d-block" tabIndex="-1">
            <div className="modal-dialog modal-lg">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">Chat with {selectedUser.username}</h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>
                    <div className="modal-body">
                        <div className="chat-messages">
                            {messages.map((msg) => {
                                const isSelf = msg.sender_id === currentUser.id;
                                return (
                                    <div className={`chat-message ${isSelf ? 'self' : 'other'}`} key={msg.id}>
                                        <p>
                                            <strong>{isSelf ? currentUser.username : selectedUser.username}: </strong>
                                            {msg.message}
                                            {msg.fileUrl && (
                                                <div>
                                                    <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">View attachment</a>
                                                </div>
                                            )}
                                        </p>
                                        {msg.is_read && <span className="read-receipt">Seen</span>}
                                        <small className="text-muted d-block">
                                            {new Date(msg.timestamp).toLocaleTimeString()}
                                        </small>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef}></div>
                        </div>
                        <div className="input-group mb-2">
                            <input
                                type="file"
                                className="form-control"
                                onChange={e => setFile(e.target.files[0])}
                            />
                        </div>
                        <div className="input-group">
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Type your message..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') sendMessage();
                                }}
                            />
                            <button className="btn btn-primary" onClick={sendMessage}>
                                Send
                            </button>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={onClose}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Eventueel kun je een ChatUsersModal component maken en hier exporteren als je wilt.
