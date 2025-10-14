// services/mongoConnectionPool.js
const { MongoClient } = require('mongodb');

class MongoConnectionPool {
    constructor() {
        this.client = null;
        this.db = null;
        this.isConnected = false;
        this.connectionPromise = null;
    }

    async connect() {
        if (this.isConnected && this.client) {
            return this.db;
        }

        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = this._establishConnection();
        return this.connectionPromise;
    }

    async _establishConnection() {
        try {
            this.client = new MongoClient(process.env.MONGODB_URI, {
                maxPoolSize: 10, // Maintain up to 10 socket connections
                serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
                socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
                maxIdleTimeMS: 30000 // Close connections after 30 seconds of inactivity
                // Removed bufferMaxEntries as it's deprecated
            });

            await this.client.connect();
            this.db = this.client.db(process.env.MONGODB_DB);
            this.isConnected = true;
            this.connectionPromise = null;

            console.log('MongoDB connection pool established');
            return this.db;
        } catch (error) {
            console.error('Failed to establish MongoDB connection:', error);
            this.connectionPromise = null;
            throw error;
        }
    }

    async getCollection(collectionName) {
        const db = await this.connect();
        return db.collection(collectionName);
    }

    async close() {
        if (this.client) {
            await this.client.close();
            this.client = null;
            this.db = null;
            this.isConnected = false;
            console.log('MongoDB connection pool closed');
        }
    }

    // Graceful shutdown
    setupGracefulShutdown() {
        process.on('SIGINT', async () => {
            await this.close();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            await this.close();
            process.exit(0);
        });
    }
}

// Singleton instance
const mongoPool = new MongoConnectionPool();
mongoPool.setupGracefulShutdown();

module.exports = mongoPool;
