const dgram = require('dgram');

class NetworkDiscovery {
    constructor() {
        this.discoveryPort = 9610;
        this.broadcastAddress = '255.255.255.255';
        this.serverPort = 9611;
        this.socket = null;
        this.broadcastInterval = null;
    }

    // Server side: Broadcast server existence
    async startBroadcasting(serverPort = this.serverPort) {
        return new Promise((resolve, reject) => {
            try {
                this.serverPort = serverPort;
                this.socket = dgram.createSocket('udp4');
                
                this.socket.on('error', (err) => {
                    console.error('Discovery socket error:', err);
                    reject(err);
                });
                
                this.socket.bind(() => {
                    this.socket.setBroadcast(true);
                    console.log(`🎯 Discovery server broadcasting on port ${this.discoveryPort}`);
                    
                    // Broadcast every 3 seconds
                    this.broadcastInterval = setInterval(() => {
                        const message = JSON.stringify({
                            type: 'server-announce',
                            port: this.serverPort,
                            timestamp: Date.now(),
                            app: 'army-exam-invigilator'
                        });
                        
                        this.socket.send(message, this.discoveryPort, this.broadcastAddress, (err) => {
                            if (err) console.error('Broadcast error:', err);
                        });
                    }, 3000);
                    
                    resolve();
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }

    // Client side: Discover servers
    discoverServer(timeout = 10000) {
        return new Promise((resolve) => {
            const socket = dgram.createSocket('udp4');
            const servers = new Map();
            
            socket.on('error', (err) => {
                console.error('Discovery client error:', err);
                socket.close();
                resolve(null);
            });
            
            socket.bind(this.discoveryPort, () => {
                socket.setBroadcast(true);
                console.log('🔍 Searching for exam servers...');
                
                socket.on('message', (msg, rinfo) => {
                    try {
                        const data = JSON.parse(msg.toString());
                        if (data.type === 'server-announce' && data.app === 'army-exam-invigilator') {
                            const serverKey = `${rinfo.address}:${data.port}`;
                            servers.set(serverKey, {
                                ip: rinfo.address,
                                port: data.port,
                                timestamp: data.timestamp,
                                lastSeen: Date.now()
                            });
                            
                            console.log(`✅ Found server: ${rinfo.address}:${data.port}`);
                        }
                    } catch (error) {
                        console.error('Error parsing discovery message:', error);
                    }
                });
            });
            
            // Return the first server found after timeout
            setTimeout(() => {
                socket.close();
                
                if (servers.size > 0) {
                    const latestServer = Array.from(servers.values())
                        .sort((a, b) => b.lastSeen - a.lastSeen)[0];
                    resolve(latestServer);
                } else {
                    console.log('❌ No servers found');
                    resolve(null);
                }
            }, timeout);
        });
    }

    stopBroadcasting() {
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
            this.broadcastInterval = null;
        }
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        console.log('📡 Discovery broadcasting stopped');
    }

    // Alias for backward compatibility
    stopDiscovery() {
        return this.stopBroadcasting();
    }
}

module.exports = NetworkDiscovery;