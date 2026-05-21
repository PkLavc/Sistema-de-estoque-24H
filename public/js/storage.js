/**
 * Storage wrapper that uses localStorage for guest mode and API for regular users
 */

class DataStorage {
    constructor() {
        this.isGuest = false;
        this.storagePrefix = 'guest_';
    }

    setGuestMode(isGuest) {
        this.isGuest = isGuest;
    }

    // Generic localStorage operations
    _saveToLocalStorage(key, data) {
        try {
            localStorage.setItem(this.storagePrefix + key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Error saving to localStorage:', e);
            return false;
        }
    }

    _loadFromLocalStorage(key) {
        try {
            const data = localStorage.getItem(this.storagePrefix + key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Error loading from localStorage:', e);
            return null;
        }
    }

    _deleteFromLocalStorage(key) {
        try {
            localStorage.removeItem(this.storagePrefix + key);
            return true;
        } catch (e) {
            console.error('Error deleting from localStorage:', e);
            return false;
        }
    }

    // Events API
    async getEvents() {
        if (this.isGuest) {
            return this._loadFromLocalStorage('events') || [];
        }
        const response = await fetch('/api/events');
        return response.json();
    }

    async createEvent(event) {
        if (this.isGuest) {
            const events = this._loadFromLocalStorage('events') || [];
            event.id = Date.now();
            events.push(event);
            this._saveToLocalStorage('events', events);
            return { success: true, event };
        }
        const response = await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });
        return response.json();
    }

    async updateEvent(id, updates) {
        if (this.isGuest) {
            const events = this._loadFromLocalStorage('events') || [];
            const index = events.findIndex(e => e.id === id);
            if (index !== -1) {
                events[index] = { ...events[index], ...updates };
                this._saveToLocalStorage('events', events);
                return { success: true };
            }
            return { success: false, error: 'Event not found' };
        }
        const response = await fetch(`/api/events/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        return response.json();
    }

    async deleteEvent(id) {
        if (this.isGuest) {
            let events = this._loadFromLocalStorage('events') || [];
            events = events.filter(e => e.id !== id);
            this._saveToLocalStorage('events', events);
            return { success: true };
        }
        const response = await fetch(`/api/events/${id}`, {
            method: 'DELETE'
        });
        return response.json();
    }

    // Equipment API
    async getEquipments() {
        if (this.isGuest) {
            return this._loadFromLocalStorage('equipments') || [];
        }
        const response = await fetch('/api/equipments');
        return response.json();
    }

    async createEquipment(equipment) {
        if (this.isGuest) {
            const equipments = this._loadFromLocalStorage('equipments') || [];
            equipment.id = Date.now();
            equipments.push(equipment);
            this._saveToLocalStorage('equipments', equipments);
            return { success: true, equipment };
        }
        const response = await fetch('/api/equipments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(equipment)
        });
        return response.json();
    }

    async updateEquipment(id, updates) {
        if (this.isGuest) {
            const equipments = this._loadFromLocalStorage('equipments') || [];
            const index = equipments.findIndex(e => e.id === id);
            if (index !== -1) {
                equipments[index] = { ...equipments[index], ...updates };
                this._saveToLocalStorage('equipments', equipments);
                return { success: true };
            }
            return { success: false, error: 'Equipment not found' };
        }
        const response = await fetch(`/api/equipments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        return response.json();
    }

    async deleteEquipment(id) {
        if (this.isGuest) {
            let equipments = this._loadFromLocalStorage('equipments') || [];
            equipments = equipments.filter(e => e.id !== id);
            this._saveToLocalStorage('equipments', equipments);
            return { success: true };
        }
        const response = await fetch(`/api/equipments/${id}`, {
            method: 'DELETE'
        });
        return response.json();
    }

    // Cables API
    async getCables() {
        if (this.isGuest) {
            return this._loadFromLocalStorage('cables') || [];
        }
        const response = await fetch('/api/cables');
        return response.json();
    }

    async createCable(cable) {
        if (this.isGuest) {
            const cables = this._loadFromLocalStorage('cables') || [];
            cable.id = Date.now();
            cables.push(cable);
            this._saveToLocalStorage('cables', cables);
            return { success: true, cable };
        }
        const response = await fetch('/api/cables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cable)
        });
        return response.json();
    }

    async updateCable(id, updates) {
        if (this.isGuest) {
            const cables = this._loadFromLocalStorage('cables') || [];
            const index = cables.findIndex(c => c.id === id);
            if (index !== -1) {
                cables[index] = { ...cables[index], ...updates };
                this._saveToLocalStorage('cables', cables);
                return { success: true };
            }
            return { success: false, error: 'Cable not found' };
        }
        const response = await fetch(`/api/cables/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        return response.json();
    }

    async deleteCable(id) {
        if (this.isGuest) {
            let cables = this._loadFromLocalStorage('cables') || [];
            cables = cables.filter(c => c.id !== id);
            this._saveToLocalStorage('cables', cables);
            return { success: true };
        }
        const response = await fetch(`/api/cables/${id}`, {
            method: 'DELETE'
        });
        return response.json();
    }

    // Other Items API
    async getOtherItems() {
        if (this.isGuest) {
            return this._loadFromLocalStorage('otherItems') || [];
        }
        const response = await fetch('/api/other-items');
        return response.json();
    }

    async createOtherItem(item) {
        if (this.isGuest) {
            const items = this._loadFromLocalStorage('otherItems') || [];
            item.id = Date.now();
            items.push(item);
            this._saveToLocalStorage('otherItems', items);
            return { success: true, item };
        }
        const response = await fetch('/api/other-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        });
        return response.json();
    }

    async updateOtherItem(id, updates) {
        if (this.isGuest) {
            const items = this._loadFromLocalStorage('otherItems') || [];
            const index = items.findIndex(i => i.id === id);
            if (index !== -1) {
                items[index] = { ...items[index], ...updates };
                this._saveToLocalStorage('otherItems', items);
                return { success: true };
            }
            return { success: false, error: 'Item not found' };
        }
        const response = await fetch(`/api/other-items/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        return response.json();
    }

    async deleteOtherItem(id) {
        if (this.isGuest) {
            let items = this._loadFromLocalStorage('otherItems') || [];
            items = items.filter(i => i.id !== id);
            this._saveToLocalStorage('otherItems', items);
            return { success: true };
        }
        const response = await fetch(`/api/other-items/${id}`, {
            method: 'DELETE'
        });
        return response.json();
    }

    // Users API (only for admin, guests can still add users to localStorage)
    async getUsers() {
        if (this.isGuest) {
            return this._loadFromLocalStorage('users') || [];
        }
        const response = await fetch('/api/users');
        if (!response.ok) return [];
        return response.json();
    }

    async createUser(user) {
        if (this.isGuest) {
            const users = this._loadFromLocalStorage('users') || [];
            user.id = Date.now();
            users.push(user);
            this._saveToLocalStorage('users', users);
            return { success: true, user };
        }
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        });
        return response.json();
    }

    async updateUserPassword(userId, newPassword) {
        if (this.isGuest) {
            const users = this._loadFromLocalStorage('users') || [];
            const index = users.findIndex(u => u.id === userId);
            if (index !== -1) {
                // Note: In guest mode, passwords are stored in localStorage for demo purposes only.
                // This is intentional as guest data is temporary and local to the browser.
                // In production mode (non-guest), passwords are handled securely by the server.
                users[index].password = newPassword;
                this._saveToLocalStorage('users', users);
                return { success: true };
            }
            return { success: false, error: 'User not found' };
        }
        const response = await fetch(`/api/users/${userId}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: newPassword })
        });
        return response.json();
    }

    async deleteUser(userId) {
        if (this.isGuest) {
            let users = this._loadFromLocalStorage('users') || [];
            users = users.filter(u => u.id !== userId);
            this._saveToLocalStorage('users', users);
            return { success: true };
        }
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE'
        });
        return response.json();
    }

    // Clear all guest data
    clearGuestData() {
        const keys = ['events', 'equipments', 'cables', 'otherItems', 'users'];
        keys.forEach(key => this._deleteFromLocalStorage(key));
    }
}

// Export global instance
const storage = new DataStorage();
