// socket.js
export function createSocketInstance() {
    // socket.io client code
    const socket = io({ withCredentials: true });
    return socket;
}
